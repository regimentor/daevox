from dataclasses import dataclass, field


@dataclass(slots=True)
class ParsedNote:
    note_id: str | None
    title: str
    frontmatter: dict[str, object]
    body: str
    raw: str
    headings: list[tuple[int, str, int]] = field(default_factory=list)
    tags: set[str] = field(default_factory=set)
    links: list["ParsedLink"] = field(default_factory=list)


@dataclass(slots=True)
class ParsedLink:
    target_text: str
    alias: str | None
    target_heading: str | None


@dataclass(slots=True)
class Chunk:
    position: int
    heading_path: list[str]
    content: str
    content_hash: str


@dataclass(slots=True)
class SearchHit:
    chunk_id: int
    note_id: str
    path: str
    title: str
    heading_path: list[str]
    content: str
    score: float
    keyword_score: float | None = None
    semantic_score: float | None = None
