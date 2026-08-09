from types import SimpleNamespace

import pytest

from websearch.api.open import web_open
from websearch.models.errors import ServiceError
from websearch.models.open import OpenRequest
from websearch.services.browser_service import BrowserFetchResult


class EmptyCache:
    async def get(self, _key: str):
        return None

    async def set(self, _key: str, _value, _ttl: float) -> None:
        return None


class FailingHTTPFetch:
    async def fetch(self, _url: str):
        raise ServiceError("extraction_failed", "could not extract", 502)


class SuccessfulBrowserFetch:
    async def fetch(self, url: str) -> BrowserFetchResult:
        return BrowserFetchResult(
            requested_url=url,
            final_url=url,
            status_code=200,
            content_type="text/html",
            html="<html><head><title>Rendered</title></head><body>Rendered content</body></html>",
            fragment=None,
        )


@pytest.mark.asyncio
async def test_auto_mode_does_not_read_http_body_after_browser_fallback() -> None:
    resources = SimpleNamespace(
        fetch=FailingHTTPFetch(),
        browser=SuccessfulBrowserFetch(),
        open_cache=EmptyCache(),
        settings=SimpleNamespace(
            open_default_max_chars=50_000,
            open_hard_max_chars=200_000,
            open_cache_ttl=300.0,
        ),
    )
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(resources=resources)))

    response = await web_open(OpenRequest(url="https://example.com", render="auto"), request)

    assert response.fetch_mode == "browser"
    assert response.content == "Rendered content"
