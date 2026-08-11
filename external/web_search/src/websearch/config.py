from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = Field(default=8080, ge=1, le=65535)
    api_key: str | None = None
    user_agent: str = "LocalAIWebSearch/1.0"

    search_timeout: float = Field(default=8.0, gt=0)
    search_max_concurrency: int = Field(default=4, ge=1)
    search_cache_ttl: float = Field(default=60.0, ge=0)

    http_connect_timeout: float = Field(default=5.0, gt=0)
    http_read_timeout: float = Field(default=15.0, gt=0)
    http_write_timeout: float = Field(default=10.0, gt=0)
    http_pool_timeout: float = Field(default=5.0, gt=0)
    http_max_response_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    open_default_max_chars: int = Field(default=50_000, ge=1000)
    open_hard_max_chars: int = Field(default=200_000, ge=1000, le=200_000)
    open_cache_ttl: float = Field(default=300.0, ge=0)
    max_redirects: int = Field(default=5, ge=0, le=20)

    browser_max_concurrency: int = Field(default=2, ge=1)
    browser_navigation_timeout: int = Field(default=15_000, ge=1000)
    browser_render_timeout: int = Field(default=20_000, ge=1000)
    browser_stabilization_timeout: int = Field(default=750, ge=0, le=10_000)
    browser_block_stylesheets: bool = False
    browser_enabled: bool = True

    pdf_max_bytes: int = Field(default=15 * 1024 * 1024, ge=1024)
    pdf_max_pages: int = Field(default=100, ge=1)
    cache_max_items: int = Field(default=500, ge=1)
    auto_fallback_shell_chars: int = Field(default=800, ge=0)

    search_backend_allowlist: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "auto",
            "bing",
            "brave",
            "duckduckgo",
            "google",
            "grokipedia",
            "mojeek",
            "startpage",
            "yandex",
            "yahoo",
            "wikipedia",
        ]
    )

    @field_validator("search_backend_allowlist", mode="before")
    @classmethod
    def parse_backend_allowlist(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
