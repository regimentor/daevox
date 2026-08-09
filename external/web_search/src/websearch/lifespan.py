from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from websearch.cache.memory import MemoryTTLCache
from websearch.config import Settings
from websearch.security.url_validator import URLValidator
from websearch.services.browser_service import BrowserService
from websearch.services.fetch_service import HTTPFetchService
from websearch.services.search_service import DDGSSearchProvider, SearchService

logger = logging.getLogger(__name__)


class AppResources:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.http_client: httpx.AsyncClient | None = None
        self.validator = URLValidator()
        self.browser = BrowserService(settings, self.validator)
        self.search_provider = DDGSSearchProvider(settings)
        self.search: SearchService | None = None
        self.fetch: HTTPFetchService | None = None
        self.search_cache: MemoryTTLCache = MemoryTTLCache(settings.cache_max_items)
        self.open_cache: MemoryTTLCache = MemoryTTLCache(settings.cache_max_items)

    @property
    def ready(self) -> bool:
        return (
            self.http_client is not None
            and self.search is not None
            and self.fetch is not None
            and self.browser.ready
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    logger.info(
        "application startup",
        extra={
            "event": "startup",
            "browser_ready": False,
            "cache_size": settings.cache_max_items,
            "timeout_ms": round(settings.http_read_timeout * 1000),
        },
    )
    resources = AppResources(settings)
    timeout = httpx.Timeout(
        connect=settings.http_connect_timeout,
        read=settings.http_read_timeout,
        write=settings.http_write_timeout,
        pool=settings.http_pool_timeout,
    )
    resources.http_client = httpx.AsyncClient(
        timeout=timeout,
        verify=True,
        headers={"User-Agent": settings.user_agent},
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
    )
    resources.fetch = HTTPFetchService(resources.http_client, settings, resources.validator)
    resources.search = SearchService(resources.search_provider, settings, resources.search_cache)
    await resources.browser.start()
    app.state.resources = resources
    logger.info(
        "application ready",
        extra={
            "event": "ready",
            "browser_ready": resources.browser.ready,
            "cache_size": settings.cache_max_items,
        },
    )
    try:
        yield
    finally:
        logger.info("application shutdown", extra={"event": "shutdown"})
        await resources.browser.stop()
        if resources.http_client is not None:
            await resources.http_client.aclose()
        await resources.search_cache.clear()
        await resources.open_cache.clear()
