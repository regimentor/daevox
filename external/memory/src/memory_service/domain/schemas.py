from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from memory_service.git.models import GitCheckpoint as GitCheckpointModel
from memory_service.git.models import GitCommit as GitCommitResponse


class NoteCreate(BaseModel):
    path: str = Field(description="Vault-relative path ending in `.md`.")
    title: str | None = Field(default=None, description="Optional Obsidian note title.")
    content: str = Field(default="", description="Markdown body without YAML frontmatter.")
    frontmatter: dict[str, object] = Field(
        default_factory=dict,
        description=(
            "Additional YAML frontmatter. `id`, `created` and `updated` are managed by the service."
        ),
    )


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str | None = Field(default=None, description="New vault-relative `.md` path.")
    title: str | None = Field(default=None, description="Replacement Obsidian note title.")
    content: str | None = Field(default=None, description="Replacement Markdown body.")
    frontmatter: dict[str, object] | None = Field(
        default=None, description="Frontmatter fields to merge into the existing note."
    )


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


class NoteMutationResponse(BaseModel):
    id: str
    path: str


class NoteHistoryResponse(BaseModel):
    note_id: str
    history: list[GitCommitResponse]


class RevisionResponse(BaseModel):
    note_id: str
    revision: str
    path: str
    raw: str


class RestoreResponse(BaseModel):
    id: str
    path: str
    revision: str


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, description="Free-text query.")
    mode: Literal["keyword", "semantic", "hybrid"] = Field(
        default="hybrid", description="Retrieval strategy."
    )
    limit: int | None = Field(
        default=None, ge=1, le=100, description="Maximum number of chunks to return."
    )
    path_prefix: str | None = Field(
        default=None, description="Literal vault-relative path prefix filter."
    )
    tags: list[str] = Field(
        default_factory=list, description="Tags that matching notes must contain."
    )
    expand_links: bool = Field(
        default=False, description="Include one-hop chunks from notes linked by matching notes."
    )


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
    message: str = Field(min_length=1, max_length=500, description="Git commit message.")


class RestoreRequest(BaseModel):
    revision: str = Field(min_length=1, max_length=200, description="Git revision to restore.")


class ReconciliationDuplicate(BaseModel):
    id: str
    paths: list[str]
    indexed_path: str | None = None


class ReindexResponse(BaseModel):
    reindexed: bool
    indexed: int
    deleted: int
    duplicates: list[ReconciliationDuplicate] = Field(default_factory=list)


class GitInitResponse(BaseModel):
    initialized: bool
    path: str


class GitStatusResponse(BaseModel):
    initialized: bool
    entries: list[str]


class GitDiffResponse(BaseModel):
    diff: str


class GitHistoryResponse(BaseModel):
    history: list[GitCommitResponse]


class GitCheckpointResponse(GitCheckpointModel):
    pass


class ErrorDetail(BaseModel):
    code: str = Field(description="Stable machine-readable error code.")
    message: str = Field(description="Human-readable error message.")


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadyResponse(BaseModel):
    ready: bool
    vault: bool
    sqlite: bool
    embeddings: bool
    embedding_error: str | None = None
    git_initialized: bool | None = None
