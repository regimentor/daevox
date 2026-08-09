from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin

import httpx

from websearch.config import Settings
from websearch.models.errors import ServiceError
from websearch.observability import safe_url
from websearch.security.url_validator import URLValidator


@dataclass(slots=True)
class FetchResult:
    requested_url: str
    final_url: str
    status_code: int
    content_type: str
    body: bytes
    fragment: str | None


class PageFetcher(Protocol):
    async def fetch(self, url: str) -> FetchResult: ...


class HTTPFetchService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, validator: URLValidator):
        self.client = client
        self.settings = settings
        self.validator = validator

    async def fetch(self, url: str) -> FetchResult:
        started = time.perf_counter()
        logger = logging.getLogger(__name__)
        logger.info(
            "HTTP fetch started",
            extra={
                "event": "http_fetch_started",
                "requested_url": safe_url(url),
                "redirect_count": 0,
            },
        )
        checked = await self.validator.validate(url)
        current = checked.request_url
        fragment = checked.fragment
        for redirect_count in range(self.settings.max_redirects + 1):
            checked = await self.validator.validate(current)
            logger.debug(
                "HTTP request validated",
                extra={
                    "event": "http_request_validated",
                    "requested_url": safe_url(checked.request_url),
                    "redirect_count": redirect_count,
                    "fragment_present": checked.fragment is not None,
                },
            )
            try:
                async with self.client.stream(
                    "GET",
                    checked.request_url,
                    follow_redirects=False,
                    headers={
                        "Accept": (
                            "text/html,application/xhtml+xml,text/plain,text/markdown,"
                            "application/json,application/pdf;q=0.9"
                        )
                    },
                ) as response:
                    logger.info(
                        "HTTP response received",
                        extra={
                            "event": "http_response_received",
                            "requested_url": safe_url(checked.request_url),
                            "final_url": safe_url(str(response.url)),
                            "status_code": response.status_code,
                            "redirect_count": redirect_count,
                            "content_type": response.headers.get("content-type", "")
                            .split(";", 1)[0]
                            .strip()
                            .lower(),
                        },
                    )
                    if 300 <= response.status_code < 400:
                        location = response.headers.get("location")
                        if not location:
                            raise ServiceError(
                                "connection_failed", "Upstream redirect has no Location header", 502
                            )
                        current = urljoin(checked.request_url, location)
                        logger.info(
                            "HTTP redirect followed",
                            extra={
                                "event": "http_redirect",
                                "redirect_count": redirect_count + 1,
                                "redirect_location": safe_url(current),
                            },
                        )
                        continue
                    content_type = (
                        response.headers.get("content-type", "application/octet-stream")
                        .split(";", 1)[0]
                        .strip()
                        .lower()
                    )
                    limit = (
                        self.settings.pdf_max_bytes
                        if content_type == "application/pdf"
                        else self.settings.http_max_response_bytes
                    )
                    declared_length = response.headers.get("content-length")
                    if (
                        declared_length
                        and declared_length.isdigit()
                        and int(declared_length) > limit
                    ):
                        raise ServiceError(
                            "response_too_large",
                            "Upstream response exceeds the configured size limit",
                            413,
                        )
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > limit:
                            raise ServiceError(
                                "response_too_large",
                                "Upstream response exceeds the configured size limit",
                                413,
                            )
                    result = FetchResult(
                        requested_url=url,
                        final_url=str(response.url),
                        status_code=response.status_code,
                        content_type=content_type,
                        body=bytes(body),
                        fragment=fragment,
                    )
                    logger.info(
                        "HTTP fetch completed",
                        extra={
                            "event": "http_fetch_completed",
                            "requested_url": safe_url(url),
                            "final_url": safe_url(result.final_url),
                            "status_code": result.status_code,
                            "content_type": result.content_type,
                            "content_length": len(result.body),
                            "redirect_count": redirect_count,
                            "elapsed_ms": round((time.perf_counter() - started) * 1000),
                        },
                    )
                    return result
            except ServiceError as exc:
                logger.warning(
                    "HTTP fetch rejected or exceeded policy",
                    extra={
                        "event": "http_fetch_rejected",
                        "requested_url": safe_url(current),
                        "redirect_count": redirect_count,
                        "error_code": exc.code,
                        "reason": exc.message,
                        "elapsed_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
                raise
            except httpx.TimeoutException as exc:
                logger.warning(
                    "HTTP fetch timed out",
                    extra={
                        "event": "http_fetch_timeout",
                        "requested_url": safe_url(current),
                        "redirect_count": redirect_count,
                        "error_type": type(exc).__name__,
                        "elapsed_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
                raise ServiceError("fetch_timeout", "Page request timed out", 408) from exc
            except httpx.RequestError as exc:
                logger.warning(
                    "HTTP fetch failed",
                    extra={
                        "event": "http_fetch_failed",
                        "requested_url": safe_url(current),
                        "redirect_count": redirect_count,
                        "error_type": type(exc).__name__,
                        "elapsed_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
                raise ServiceError(
                    "connection_failed", "Could not connect to the requested URL", 502
                ) from exc
        logger.warning(
            "HTTP fetch stopped after redirect limit",
            extra={
                "event": "http_redirect_limit",
                "requested_url": safe_url(url),
                "redirect_count": self.settings.max_redirects,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        raise ServiceError("too_many_redirects", "Too many redirects", 400)


def decode_text(body: bytes) -> str:
    return body.decode("utf-8", errors="replace")


def pretty_json(body: bytes) -> str:
    try:
        return json.dumps(json.loads(decode_text(body)), ensure_ascii=False, indent=2)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ServiceError(
            "extraction_failed", "Response declared JSON but contained invalid JSON", 502
        ) from exc
