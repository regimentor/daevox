from __future__ import annotations

import json

from memory_service.domain.models import SearchHit


def keyword_search(
    connection, query: str, limit: int, path_prefix: str | None, tags: list[str]
) -> list[SearchHit]:
    clauses = ["chunk_fts MATCH ?"]
    params: list[object] = [query]
    if path_prefix:
        clauses.append("chunk_fts.path LIKE ?")
        params.append(path_prefix.rstrip("/") + "/%")
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
    rows = connection.execute(sql, params).fetchall()
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
