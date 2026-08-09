from __future__ import annotations

import json
import logging
import time
from typing import Literal, cast

from fastapi import APIRouter, Request

from websearch.models.errors import ServiceError
from websearch.models.open import OpenMeta, OpenRequest, OpenResponse
from websearch.observability import safe_url
from websearch.services.extraction_service import extract_html, looks_like_js_shell, truncate_text
from websearch.services.fetch_service import decode_text, pretty_json
from websearch.services.pdf_service import extract_pdf_text

router = APIRouter(prefix="/v1")
logger = logging.getLogger(__name__)


async def _open_http(payload: OpenRequest, resources):
    assert resources.fetch is not None
    fetched = await resources.fetch.fetch(payload.url)
    if fetched.content_type == "application/pdf":
        return (
            extract_pdf_text(fetched.body, resources.settings),
            "",
            "application/pdf",
            "pdf",
            fetched,
            None,
        )
    if fetched.content_type in {"text/html", "application/xhtml+xml"}:
        extracted = extract_html(decode_text(fetched.body), fetched.final_url)
        return extracted.markdown, extracted.title, fetched.content_type, "http", fetched, extracted
    if fetched.content_type in {"text/plain", "text/markdown"}:
        return decode_text(fetched.body), "", fetched.content_type, "http", fetched, None
    if fetched.content_type == "application/json":
        return pretty_json(fetched.body), "", fetched.content_type, "http", fetched, None
    raise ServiceError(
        "unsupported_content_type", "The requested content type is not supported", 415
    )


@router.post("/web_open", response_model=OpenResponse)
async def web_open(payload: OpenRequest, request: Request) -> OpenResponse:
    resources = request.app.state.resources
    started = time.perf_counter()
    logger.info(
        "web open started",
        extra={
            "event": "open_started",
            "url": safe_url(payload.url),
            "render": payload.render,
        },
    )
    cache_key = json.dumps(payload.model_dump(), sort_keys=True)
    cached = await resources.open_cache.get(cache_key)
    if cached is not None:
        logger.info(
            "open cache hit",
            extra={
                "event": "open_cache_hit",
                "cache": "open",
                "cache_hit": True,
                "url": safe_url(payload.url),
                "mode": cached.fetch_mode,
                "content_length": cached.char_count,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        return cached
    logger.debug(
        "open cache miss",
        extra={
            "event": "open_cache_miss",
            "cache": "open",
            "cache_hit": False,
            "url": safe_url(payload.url),
        },
    )

    if payload.render == "browser":
        logger.info(
            "open selecting browser mode",
            extra={"event": "open_mode_selected", "url": safe_url(payload.url), "mode": "browser"},
        )
        assert resources.browser is not None
        browser_result = await resources.browser.fetch(payload.url)
        extracted = extract_html(browser_result.html, browser_result.final_url)
        content, title, content_type, mode, fetched, extracted_data = (
            extracted.markdown,
            extracted.title,
            browser_result.content_type,
            "browser",
            browser_result,
            extracted,
        )
    else:
        try:
            content, title, content_type, mode, fetched, extracted_data = await _open_http(
                payload, resources
            )
        except ServiceError as exc:
            if payload.render != "auto" or exc.code != "extraction_failed":
                raise
            logger.info(
                "open falling back to browser after HTTP extraction failure",
                extra={
                    "event": "open_browser_fallback",
                    "url": safe_url(payload.url),
                    "reason": exc.code,
                },
            )
            browser_result = await resources.browser.fetch(payload.url)
            extracted = extract_html(browser_result.html, browser_result.final_url)
            content, title, content_type, mode, fetched, extracted_data = (
                extracted.markdown,
                extracted.title,
                browser_result.content_type,
                "browser",
                browser_result,
                extracted,
            )
        if (
            payload.render == "auto"
            and mode == "http"
            and extracted_data is not None
            and looks_like_js_shell(decode_text(fetched.body), extracted_data)
        ):
            logger.info(
                "open falling back to browser for JavaScript shell",
                extra={
                    "event": "open_browser_fallback",
                    "url": safe_url(payload.url),
                    "reason": "javascript_shell",
                },
            )
            browser_result = await resources.browser.fetch(payload.url)
            extracted = extract_html(browser_result.html, browser_result.final_url)
            content, title, content_type, mode, fetched, extracted_data = (
                extracted.markdown,
                extracted.title,
                browser_result.content_type,
                "browser",
                browser_result,
                extracted,
            )

    original_char_count = len(content)
    effective_max_chars = payload.max_chars or resources.settings.open_default_max_chars
    content, char_count, truncated = truncate_text(
        content, min(effective_max_chars, resources.settings.open_hard_max_chars)
    )
    final_url = fetched.final_url
    requested_fragment = fetched.fragment
    canonical = extracted_data.canonical_url if extracted_data is not None else None
    response = OpenResponse(
        url=payload.url,
        final_url=final_url,
        canonical_url=canonical,
        title=title,
        content_type=content_type,
        fetch_mode=cast(Literal["http", "browser", "pdf"], mode),
        status_code=fetched.status_code,
        content=content,
        char_count=char_count,
        original_char_count=original_char_count if truncated else None,
        truncated=truncated,
        meta=OpenMeta(
            elapsed_ms=round((time.perf_counter() - started) * 1000),
            requested_fragment=requested_fragment,
        ),
    )
    await resources.open_cache.set(cache_key, response, resources.settings.open_cache_ttl)
    logger.info(
        "web open completed",
        extra={
            "event": "open_completed",
            "url": safe_url(payload.url),
            "final_url": safe_url(final_url),
            "mode": mode,
            "status_code": fetched.status_code,
            "content_type": content_type,
            "content_length": len(content.encode("utf-8")),
            "original_chars": original_char_count,
            "meaningful_chars": char_count,
            "truncated": truncated,
            "cache": "open",
            "cache_ttl": resources.settings.open_cache_ttl,
            "elapsed_ms": response.meta.elapsed_ms,
        },
    )
    return response
