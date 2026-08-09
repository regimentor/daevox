import httpx
import pytest
import respx

from websearch.config import Settings
from websearch.models.errors import ServiceError
from websearch.security.url_validator import URLValidationResult
from websearch.services.fetch_service import HTTPFetchService


class FakeValidator:
    async def validate(self, url: str) -> URLValidationResult:
        from urllib.parse import urlsplit

        parsed = urlsplit(url)
        return URLValidationResult(
            url, url, parsed.hostname or "public.example", parsed.fragment or None
        )


class RedirectBlockingValidator(FakeValidator):
    async def validate(self, url: str) -> URLValidationResult:
        if "127.0.0.1" in url:
            raise ServiceError("blocked_url", "blocked", 403)
        return await super().validate(url)


@pytest.mark.asyncio
@respx.mock
async def test_redirect_is_followed_manually() -> None:
    respx.get("https://public.example/start").mock(
        return_value=httpx.Response(302, headers={"Location": "/final"})
    )
    respx.get("https://public.example/final").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/plain"}, text="ok")
    )
    settings = Settings()
    async with httpx.AsyncClient() as client:
        result = await HTTPFetchService(client, settings, FakeValidator()).fetch(
            "https://public.example/start"
        )
    assert result.final_url == "https://public.example/final"
    assert result.body == b"ok"


@pytest.mark.asyncio
@respx.mock
async def test_redirect_to_private_address_is_blocked() -> None:
    respx.get("https://public.example/start").mock(
        return_value=httpx.Response(302, headers={"Location": "http://127.0.0.1/admin"})
    )
    settings = Settings()
    async with httpx.AsyncClient() as client:
        with pytest.raises(ServiceError) as error:
            await HTTPFetchService(client, settings, RedirectBlockingValidator()).fetch(
                "https://public.example/start"
            )
    assert error.value.code == "blocked_url"
