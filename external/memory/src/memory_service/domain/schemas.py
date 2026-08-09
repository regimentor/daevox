from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    path: str
    title: str | None = None
    content: str = ""
    frontmatter: dict[str, object] = Field(default_factory=dict)


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str | None = None
    title: str | None = None
    content: str | None = None
    frontmatter: dict[str, object] | None = None


class NoteResponse(BaseModel):
    id: str
    path: str
    title: str
    content: str
    raw: str
    frontmatter: dict[str, object]
    created: datetime | None = None
    updated: datetime | None = None


class NoteRefResponse(BaseModel):
    id: str
    path: str
    title: str


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    mode: Literal["keyword", "semantic", "hybrid"] = "hybrid"
    limit: int | None = Field(default=None, ge=1, le=100)
    path_prefix: str | None = None
    tags: list[str] = Field(default_factory=list)
    expand_links: bool = False


class SearchResult(BaseModel):
    note_id: str
    path: str
    title: str
    heading_path: list[str]
    content: str
    score: float
    keyword_score: float | None = None
    semantic_score: float | None = None
    chunk_id: str


class SearchResponse(BaseModel):
    query: str
    mode: str
    results: list[SearchResult]


class CheckpointRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class RestoreRequest(BaseModel):
    revision: str = Field(min_length=1, max_length=200)
