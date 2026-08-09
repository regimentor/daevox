from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OpenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str = Field(min_length=1, max_length=8192)
    render: Literal["auto", "http", "browser"] = "auto"
    max_chars: int | None = Field(default=None, ge=1000, le=200_000)


class OpenMeta(BaseModel):
    elapsed_ms: int = Field(ge=0)
    requested_fragment: str | None = None


class OpenResponse(BaseModel):
    url: str
    final_url: str
    canonical_url: str | None = None
    title: str
    content_type: str
    fetch_mode: Literal["http", "browser", "pdf"]
    status_code: int
    content: str
    char_count: int
    original_char_count: int | None = None
    truncated: bool
    meta: OpenMeta
