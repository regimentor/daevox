from __future__ import annotations

import hashlib
from contextvars import ContextVar
from urllib.parse import urlsplit, urlunsplit

request_id_context: ContextVar[str | None] = ContextVar("websearch_request_id", default=None)


def safe_url(value: str) -> str:
    """Return a log-safe URL without credentials, query parameters, or fragments."""

    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        if not parsed.scheme or not hostname:
            return "<invalid-url>"
        host = hostname.lower()
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        try:
            port = parsed.port
        except ValueError:
            port = None
        default_port = (parsed.scheme.lower() == "http" and port == 80) or (
            parsed.scheme.lower() == "https" and port == 443
        )
        netloc = host if port is None or default_port else f"{host}:{port}"
        return urlunsplit((parsed.scheme.lower(), netloc, parsed.path or "/", "", ""))
    except (TypeError, ValueError):
        return "<invalid-url>"


def query_digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
