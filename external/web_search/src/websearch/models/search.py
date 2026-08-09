from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=500)
    max_results: int = Field(default=8, ge=1, le=20)
    region: str = Field(default="wt-wt", min_length=1, max_length=32)
    safesearch: Literal["on", "moderate", "off"] = "moderate"
    timelimit: Literal["d", "w", "m", "y"] | None = None
    page: int = Field(default=1, ge=1, le=10)
    backend: str = Field(default="auto", min_length=1, max_length=200)

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be blank")
        return value.strip()


class SearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: int = Field(ge=1)
    title: str
    url: str
    snippet: str
    source: str = "duckduckgo"


class SearchMeta(BaseModel):
    count: int = Field(ge=0)
    elapsed_ms: int = Field(ge=0)


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    meta: SearchMeta
