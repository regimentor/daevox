from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from playwright.async_api import Browser, Page, Playwright, async_playwright
from playwright.async_api import Error as PlaywrightError

from websearch.config import Settings
from websearch.models.errors import ServiceError
from websearch.observability import safe_url
from websearch.security.url_validator import URLValidator

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class BrowserFetchResult:
    requested_url: str
    final_url: str
    status_code: int
    content_type: str
    html: str
    fragment: str | None


class BrowserService:
    def __init__(self, settings: Settings, validator: URLValidator):
        self.settings = settings
        self.validator = validator
        self._playwright: Playwright | None = None
        self.browser: Browser | None = None
        self._semaphore = asyncio.Semaphore(settings.browser_max_concurrency)

    @property
    def ready(self) -> bool:
        return self.browser is not None and self.browser.is_connected()

    async def start(self) -> None:
        if not self.settings.browser_enabled:
            logger.info("browser rendering disabled", extra={"event": "browser_disabled"})
            return
        started = time.perf_counter()
        try:
            playwright = await async_playwright().start()
            self._playwright = playwright
            self.browser = await playwright.chromium.launch(headless=True)
            logger.info(
                "Chromium started",
                extra={
                    "event": "browser_started",
                    "browser_ready": self.ready,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
        except Exception:
            logger.exception(
                "Could not start Chromium; browser rendering will be unavailable",
                extra={
                    "event": "browser_start_failed",
                    "browser_ready": False,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            if self._playwright is not None:
                await self._playwright.stop()
            self._playwright = None
            self.browser = None

    async def stop(self) -> None:
        logger.info("stopping browser", extra={"event": "browser_stopping"})
        if self.browser is not None:
            try:
                await self.browser.close()
            except Exception:
                logger.warning("Chromium connection was already closed during shutdown")
            self.browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                logger.warning("Playwright connection was already closed during shutdown")
            self._playwright = None
        logger.info("browser stopped", extra={"event": "browser_stopped", "browser_ready": False})

    async def fetch(self, url: str) -> BrowserFetchResult:
        started = time.perf_counter()
        logger.info(
            "browser fetch started",
            extra={
                "event": "browser_fetch_started",
                "requested_url": safe_url(url),
                "browser_ready": self.ready,
                "timeout_ms": self.settings.browser_render_timeout,
            },
        )
        checked = await self.validator.validate(url)
        if not self.ready:
            logger.warning(
                "browser fetch unavailable",
                extra={"event": "browser_fetch_unavailable", "requested_url": safe_url(url)},
            )
            raise ServiceError("browser_error", "Chromium browser is not available", 503)
        assert self.browser is not None
        try:
            async with self._semaphore:
                result = await asyncio.wait_for(
                    self._fetch_in_context(checked.request_url, checked.fragment),
                    timeout=self.settings.browser_render_timeout / 1000,
                )
                logger.info(
                    "browser fetch completed",
                    extra={
                        "event": "browser_fetch_completed",
                        "requested_url": safe_url(url),
                        "final_url": safe_url(result.final_url),
                        "status_code": result.status_code,
                        "content_type": result.content_type,
                        "content_length": len(result.html.encode("utf-8")),
                        "elapsed_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
                return result
        except TimeoutError as exc:
            logger.warning(
                "browser fetch timed out",
                extra={
                    "event": "browser_fetch_timeout",
                    "requested_url": safe_url(url),
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            raise ServiceError("browser_timeout", "Browser rendering timed out", 408) from exc
        except ServiceError:
            raise
        except PlaywrightError as exc:
            logger.warning(
                "Playwright page failed",
                extra={
                    "event": "browser_fetch_failed",
                    "requested_url": safe_url(url),
                    "error_type": type(exc).__name__,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            raise ServiceError(
                "browser_error", "Browser could not load the requested page", 502
            ) from exc

    async def _fetch_in_context(self, url: str, fragment: str | None) -> BrowserFetchResult:
        assert self.browser is not None
        context = await self.browser.new_context(
            java_script_enabled=True,
            accept_downloads=False,
            service_workers="block",
            user_agent=self.settings.user_agent,
        )
        blocked_urls: list[str] = []
        blocked_resource_count = 0

        async def handle_route(route) -> None:
            request = route.request
            resource_type = request.resource_type
            if resource_type in {"image", "media", "font"} or (
                resource_type == "stylesheet" and self.settings.browser_block_stylesheets
            ):
                nonlocal blocked_resource_count
                blocked_resource_count += 1
                await route.abort("blockedbyclient")
                return
            request_url = request.url
            if request_url == "about:blank":
                await route.continue_()
                return
            try:
                await self.validator.validate(request_url)
            except ServiceError:
                blocked_urls.append(request_url)
                logger.warning(
                    "browser subrequest blocked by SSRF policy",
                    extra={
                        "event": "browser_subrequest_blocked",
                        "requested_url": safe_url(request_url),
                        "resource_type": resource_type,
                        "blocked_count": len(blocked_urls),
                    },
                )
                await route.abort("blockedbyclient")
                return
            await route.continue_()

        await context.route("**/*", handle_route)
        page: Page | None = None
        try:
            page = await context.new_page()
            page.set_default_navigation_timeout(self.settings.browser_navigation_timeout)
            try:
                response = await page.goto(url, wait_until="domcontentloaded")
            except PlaywrightError as exc:
                if blocked_urls:
                    raise ServiceError(
                        "blocked_url", "Browser navigation was blocked by SSRF policy", 403
                    ) from exc
                raise
            if self.settings.browser_stabilization_timeout:
                await page.wait_for_timeout(self.settings.browser_stabilization_timeout)
            if blocked_urls and response is None:
                raise ServiceError(
                    "blocked_url", "Browser navigation was blocked by SSRF policy", 403
                )
            html = await page.content()
            if len(html.encode("utf-8")) > self.settings.http_max_response_bytes:
                raise ServiceError(
                    "response_too_large", "Rendered page exceeds the configured size limit", 413
                )
            content_type = "text/html"
            status_code = response.status if response is not None else 200
            return BrowserFetchResult(
                requested_url=url,
                final_url=page.url,
                status_code=status_code,
                content_type=content_type,
                html=html,
                fragment=fragment,
            )
        finally:
            logger.debug(
                "browser context closing",
                extra={
                    "event": "browser_context_closing",
                    "requested_url": safe_url(url),
                    "blocked_count": len(blocked_urls),
                    "blocked_resource_count": blocked_resource_count,
                },
            )
            if page is not None:
                await page.close()
            await context.close()
