from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit, urlunsplit

from websearch.models.errors import ServiceError
from websearch.observability import safe_url

logger = logging.getLogger(__name__)


class URLBlockedError(ServiceError):
    def __init__(self, message: str = "URL is blocked by SSRF policy"):
        super().__init__("blocked_url", message, 403)


class URLValidationError(ServiceError):
    def __init__(self, message: str = "URL is invalid"):
        super().__init__("invalid_url", message, 400)


@dataclass(frozen=True, slots=True)
class URLValidationResult:
    original_url: str
    request_url: str
    hostname: str
    fragment: str | None


def _is_private_or_reserved(value: str) -> bool:
    address = ipaddress.ip_address(value)
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    return any(
        (
            address.is_loopback,
            address.is_private,
            address.is_link_local,
            address.is_multicast,
            address.is_unspecified,
            address.is_reserved,
        )
    )


def _resolve_all(hostname: str, port: int) -> set[str]:
    try:
        records = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ServiceError("dns_resolution_failed", "Could not resolve URL hostname", 400) from exc
    addresses: set[str] = {str(record[4][0]) for record in records if record[4]}
    if not addresses:
        raise ServiceError("dns_resolution_failed", "URL hostname has no resolved addresses", 400)
    return addresses


def _parse_and_check_shape(url: str) -> tuple[SplitResult, str]:
    if any(ord(char) < 32 for char in url) or any(char.isspace() for char in url):
        raise URLValidationError("URL contains whitespace or control characters")
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise URLValidationError("URL could not be parsed") from exc
    if parsed.scheme.lower() not in {"http", "https"}:
        raise URLValidationError("Only http and https URLs are allowed")
    if not parsed.netloc or parsed.username is not None or parsed.password is not None:
        raise URLValidationError("URL must contain a hostname and no credentials")
    try:
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise URLValidationError("URL contains an invalid host or port") from exc
    if not hostname:
        raise URLValidationError("URL must contain a hostname")
    hostname = hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise URLBlockedError("localhost is blocked")
    if port is None:
        port = 443 if parsed.scheme.lower() == "https" else 80
    if not (1 <= port <= 65535):
        raise URLValidationError("URL contains an invalid port")
    return parsed, hostname


class URLValidator:
    """Validates every URL immediately before it is used for network I/O.

    DNS results are checked, but the HTTP client/browser still resolve independently;
    this intentionally does not claim to pin a socket to the checked IP.
    """

    async def validate(self, url: str) -> URLValidationResult:
        try:
            parsed, hostname = _parse_and_check_shape(url)
        except ServiceError as exc:
            logger.warning(
                "URL validation rejected request",
                extra={
                    "event": "url_validation_rejected",
                    "url": safe_url(url),
                    "error_code": exc.code,
                    "reason": exc.message,
                },
            )
            raise
        try:
            ip = ipaddress.ip_address(hostname)
        except ValueError:
            ip = None
        if ip is not None:
            if _is_private_or_reserved(str(ip)):
                logger.warning(
                    "URL validation blocked private address",
                    extra={
                        "event": "url_validation_blocked",
                        "url": safe_url(url),
                        "hostname": hostname,
                        "error_code": "blocked_url",
                    },
                )
                raise URLBlockedError()
        else:
            port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
            addresses = await asyncio.to_thread(_resolve_all, hostname, port)
            if any(_is_private_or_reserved(address) for address in addresses):
                logger.warning(
                    "URL validation blocked private DNS result",
                    extra={
                        "event": "url_validation_blocked",
                        "url": safe_url(url),
                        "hostname": hostname,
                        "addresses_count": len(addresses),
                        "error_code": "blocked_url",
                    },
                )
                raise URLBlockedError("URL hostname resolves to a private or reserved address")

        request_url = urlunsplit(
            (parsed.scheme.lower(), parsed.netloc, parsed.path or "/", parsed.query, "")
        )
        result = URLValidationResult(
            original_url=url,
            request_url=request_url,
            hostname=hostname,
            fragment=parsed.fragment or None,
        )
        logger.debug(
            "URL validation passed",
            extra={
                "event": "url_validation_passed",
                "url": safe_url(url),
                "hostname": hostname,
                "addresses_count": 1 if ip is not None else len(addresses),
                "fragment_present": result.fragment is not None,
            },
        )
        return result
