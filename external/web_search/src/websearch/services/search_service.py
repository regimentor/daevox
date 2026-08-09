from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Protocol

import anyio
from ddgs import DDGS

from websearch.cache.memory import MemoryTTLCache
from websearch.config import Settings
from websearch.models.errors import ServiceError
from websearch.models.search import SearchMeta, SearchRequest, SearchResponse, SearchResult
from websearch.observability import query_digest

logger = logging.getLogger(__name__)


class SearchProvider(Protocol):
    async def search(self, request: SearchRequest) -> list[SearchResult]: ...


def _dedupe_key(url: str) -> str:
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    tracking = {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
    }
    parsed = urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("not an absolute HTTP URL")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("credentials are not accepted")
    if any(char.isspace() for char in url):
        raise ValueError("whitespace is not accepted")
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in tracking
    ]
    hostname = (parsed.hostname or "").lower().rstrip(".")
    netloc = hostname
    if parsed.port is not None and not (
        (parsed.scheme == "http" and parsed.port == 80)
        or (parsed.scheme == "https" and parsed.port == 443)
    ):
        netloc = f"{hostname}:{parsed.port}"
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    return urlunsplit((parsed.scheme.lower(), netloc, path, urlencode(query), ""))


def _run_ddgs(request: SearchRequest, timeout: float) -> list[dict[str, Any]]:
    return DDGS(timeout=max(1, round(timeout))).text(
        request.query,
        region=request.region,
        safesearch=request.safesearch,
        timelimit=request.timelimit,
        max_results=request.max_results,
        page=request.page,
        backend=request.backend,
    )


class DDGSSearchProvider:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._semaphore = asyncio.Semaphore(settings.search_max_concurrency)

    async def search(self, request: SearchRequest) -> list[SearchResult]:
        started = time.perf_counter()
        logger.info(
            "search provider request started",
            extra={
                "event": "provider_search_started",
                "query_hash": query_digest(request.query),
                "query_length": len(request.query),
                "backend": request.backend,
                "region": request.region,
                "page": request.page,
                "max_results": request.max_results,
                "timeout_ms": round(self.settings.search_timeout * 1000),
            },
        )
        if request.backend not in self.settings.search_backend_allowlist:
            logger.warning(
                "search backend rejected",
                extra={
                    "event": "provider_search_rejected",
                    "backend": request.backend,
                    "reason": "backend_not_allowlisted",
                },
            )
            raise ServiceError("invalid_request", "Requested search backend is not allowed", 422)
        try:
            async with self._semaphore:
                logger.debug(
                    "search provider concurrency slot acquired",
                    extra={"event": "provider_slot_acquired", "backend": request.backend},
                )
                with anyio.fail_after(self.settings.search_timeout):
                    raw = await anyio.to_thread.run_sync(
                        _run_ddgs,
                        request,
                        self.settings.search_timeout,
                        abandon_on_cancel=True,
                    )
        except TimeoutError as exc:
            logger.warning(
                "search provider timed out",
                extra={
                    "event": "provider_search_timeout",
                    "query_hash": query_digest(request.query),
                    "backend": request.backend,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            raise ServiceError("search_timeout", "Search request timed out", 408) from exc
        except Exception as exc:
            message = str(exc).lower()
            if any(token in message for token in ("rate", "429", "too many", "blocked")):
                logger.warning(
                    "search provider rate limited request",
                    extra={
                        "event": "provider_rate_limited",
                        "backend": request.backend,
                        "error_type": type(exc).__name__,
                        "elapsed_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
                raise ServiceError(
                    "search_rate_limited", "Search provider rate limited the request", 502
                ) from exc
            logger.warning(
                "DDGS search failed",
                extra={
                    "event": "provider_search_failed",
                    "backend": request.backend,
                    "error_type": type(exc).__name__,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            raise ServiceError(
                "search_backend_error", "Search backend temporarily unavailable", 502
            ) from exc

        results: list[SearchResult] = []
        seen: set[str] = set()
        skipped_count = 0
        deduplicated_count = 0
        for item in raw or []:
            if not isinstance(item, dict):
                skipped_count += 1
                continue
            url = item.get("href") or item.get("url")
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                skipped_count += 1
                continue
            try:
                key = _dedupe_key(url)
            except ValueError:
                skipped_count += 1
                continue
            if key in seen:
                deduplicated_count += 1
                continue
            seen.add(key)
            results.append(
                SearchResult(
                    position=len(results) + 1,
                    title=str(item.get("title") or "").strip(),
                    url=url,
                    snippet=str(item.get("body") or item.get("snippet") or "").strip(),
                )
            )
            if len(results) >= request.max_results:
                break
        logger.info(
            "search provider request completed",
            extra={
                "event": "provider_search_completed",
                "query_hash": query_digest(request.query),
                "backend": request.backend,
                "raw_count": len(raw or []),
                "result_count": len(results),
                "skipped_count": skipped_count,
                "deduplicated_count": deduplicated_count,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        return results


class SearchService:
    def __init__(
        self, provider: SearchProvider, settings: Settings, cache: MemoryTTLCache[SearchResponse]
    ):
        self.provider = provider
        self.settings = settings
        self.cache = cache

    async def search(self, request: SearchRequest) -> SearchResponse:
        key = json.dumps(request.model_dump(), sort_keys=True)
        cached = await self.cache.get(key)
        if cached is not None:
            logger.info(
                "search cache hit",
                extra={
                    "event": "search_cache_hit",
                    "cache": "search",
                    "cache_hit": True,
                    "query_hash": query_digest(request.query),
                    "result_count": len(cached.results),
                },
            )
            return cached
        logger.debug(
            "search cache miss",
            extra={
                "event": "search_cache_miss",
                "cache": "search",
                "cache_hit": False,
                "query_hash": query_digest(request.query),
            },
        )
        started = time.perf_counter()
        results = await self.provider.search(request)
        response = SearchResponse(
            query=request.query,
            results=results,
            meta=SearchMeta(
                count=len(results), elapsed_ms=round((time.perf_counter() - started) * 1000)
            ),
        )
        await self.cache.set(key, response, self.settings.search_cache_ttl)
        logger.info(
            "search response cached",
            extra={
                "event": "search_cache_set",
                "cache": "search",
                "cache_ttl": self.settings.search_cache_ttl,
                "query_hash": query_digest(request.query),
                "result_count": len(results),
                "elapsed_ms": response.meta.elapsed_ms,
            },
        )
        return response
