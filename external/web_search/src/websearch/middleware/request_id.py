from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from websearch.config import Settings
from websearch.observability import request_id_context

_STRUCTURED_FIELDS = (
    "request_id",
    "method",
    "endpoint",
    "host",
    "operation",
    "status",
    "status_code",
    "elapsed_ms",
    "error_code",
    "error_type",
    "event",
    "url",
    "requested_url",
    "final_url",
    "hostname",
    "query_hash",
    "query_length",
    "backend",
    "region",
    "page",
    "max_results",
    "render",
    "mode",
    "fetch_mode",
    "cache",
    "cache_hit",
    "cache_size",
    "cache_ttl",
    "redirect_count",
    "redirect_location",
    "content_type",
    "content_length",
    "limit_bytes",
    "result_count",
    "raw_count",
    "skipped_count",
    "deduplicated_count",
    "resource_type",
    "blocked_count",
    "blocked_resource_count",
    "addresses_count",
    "browser_ready",
    "fragment_present",
    "meaningful_chars",
    "title_chars",
    "markdown_chars",
    "original_chars",
    "truncated",
    "pages",
    "limit_pages",
    "timeout_ms",
    "reason",
)


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None) or request_id_context.get()
        if request_id is not None:
            payload["request_id"] = request_id
        for key in _STRUCTURED_FIELDS:
            if key == "request_id":
                continue
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            exception_type, exception, _ = record.exc_info
            payload["exception"] = {
                "type": exception_type.__name__ if exception_type else "unknown",
                "message": str(exception),
            }
        return json.dumps(payload, ensure_ascii=False)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        request_id_token = request_id_context.set(request_id)
        started = time.perf_counter()
        logger = logging.getLogger("websearch.request")
        logger.info(
            "request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "endpoint": request.url.path,
                "host": request.url.hostname,
                "operation": request.url.path.rsplit("/", 1)[-1] or request.url.path,
            },
        )
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "unhandled request error",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "endpoint": request.url.path,
                    "status": 500,
                },
            )
            response = JSONResponse(
                {"error": {"code": "internal_error", "message": "Internal server error"}},
                status_code=500,
            )
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "endpoint": request.url.path,
                "host": request.url.hostname,
                "operation": request.url.path.rsplit("/", 1)[-1] or request.url.path,
                "status": response.status_code,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        request_id_context.reset(request_id_token)
        return response


class APIKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next) -> Response:
        if self.settings.api_key and request.url.path.startswith("/v1/"):
            authorization = request.headers.get("Authorization", "")
            if authorization != f"Bearer {self.settings.api_key}":
                logging.getLogger("websearch.auth").warning(
                    "request rejected: invalid API key",
                    extra={
                        "method": request.method,
                        "endpoint": request.url.path,
                        "reason": "missing_or_invalid_bearer_token",
                    },
                )
                return JSONResponse(
                    {"error": {"code": "invalid_request", "message": "Bearer API key required"}},
                    status_code=401,
                )
        return await call_next(request)
