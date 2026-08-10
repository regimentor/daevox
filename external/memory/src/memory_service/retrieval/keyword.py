from __future__ import annotations

import json
import re
import sqlite3

from memory_service.domain.errors import bad_request
from memory_service.domain.models import SearchHit


def build_fts_query(query: str) -> str:
    """Build a phrase query where all user input is treated as data."""
    if not query or "\x00" in query or not query.strip():
        raise bad_request("search query must contain searchable text")
    normalized = re.sub(r"\s+", " ", query.strip())
    if not re.search(r"\w", normalized, flags=re.UNICODE):
        raise bad_request("search query must contain searchable text")
    return '"' + normalized.replace('"', '""') + '"'


def _like_prefix(path_prefix: str) -> str:
    escaped = (
        path_prefix.rstrip("/")
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    return escaped + "/%"


def keyword_search(
    connection, query: str, limit: int, path_prefix: str | None, tags: list[str]
) -> list[SearchHit]:
    clauses = ["chunk_fts MATCH ?"]
    params: list[object] = [build_fts_query(query)]
    if path_prefix:
        clauses.append("chunk_fts.path LIKE ? ESCAPE '\\'")
        params.append(_like_prefix(path_prefix))
    if tags:
        placeholders = ",".join("?" for _ in tags)
        clauses.append(
            f"chunk_fts.note_id IN (SELECT note_id FROM note_tags WHERE tag IN ({placeholders}))"
        )
        params.extend(tag.casefold().lstrip("#") for tag in tags)
    sql = (
        "SELECT chunk_fts.chunk_id, chunk_fts.note_id, chunk_fts.path, chunk_fts.title, "
        "chunk_fts.heading_path, chunk_fts.content, bm25(chunk_fts) AS rank "
        "FROM chunk_fts WHERE " + " AND ".join(clauses) + " ORDER BY rank LIMIT ?"
    )
    params.append(limit)
    try:
        rows = connection.execute(sql, params).fetchall()
    except sqlite3.OperationalError as exc:
        raise bad_request("invalid full-text search query") from exc
    return [
        SearchHit(
            chunk_id=int(row["chunk_id"]),
            note_id=row["note_id"],
            path=row["path"],
            title=row["title"],
            heading_path=json.loads(row["heading_path"] or "[]"),
            content=row["content"],
            score=float(-row["rank"]),
            keyword_score=float(-row["rank"]),
        )
        for row in rows
    ]
