import pytest

from websearch.models.errors import ServiceError
from websearch.security.url_validator import URLValidator


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "http://localhost",
        "http://localhost:3000",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://192.168.1.1",
        "http://169.254.169.254",
        "http://[::1]",
        "http://[fd00::1]",
        "https://user:password@example.com",
        "file:///etc/passwd",
    ],
)
async def test_private_or_unsafe_urls_are_rejected(url: str) -> None:
    with pytest.raises(ServiceError):
        await URLValidator().validate(url)


async def test_public_url_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "websearch.security.url_validator._resolve_all",
        lambda hostname, port: {"93.184.216.34"},
    )
    result = await URLValidator().validate("https://Example.com/docs#part")
    assert result.request_url == "https://Example.com/docs"
    assert result.hostname == "example.com"
    assert result.fragment == "part"


async def test_dns_rebinding_to_private_ip_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "websearch.security.url_validator._resolve_all",
        lambda hostname, port: {"93.184.216.34", "127.0.0.1"},
    )
    with pytest.raises(ServiceError) as error:
        await URLValidator().validate("https://evil.example")
    assert error.value.code == "blocked_url"
