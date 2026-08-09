from __future__ import annotations

import json

from memory_service.domain.models import SearchHit
from memory_service.indexing.embeddings import EmbeddingProvider


async def semantic_search(
    connection,
    provider: EmbeddingProvider,
    query: str,
    limit: int,
    path_prefix: str | None,
    tags: list[str],
) -> list[SearchHit]:
    embedding = await provider.embed_query(query)
    sql = (
        "SELECT v.rowid, v.distance, c.note_id, c.content, c.heading_path, n.path, n.title "
        "FROM chunk_vectors v JOIN chunks c ON c.id=v.rowid JOIN notes n ON n.id=c.note_id "
        "WHERE v.embedding MATCH ? AND k = ?"
    )
    params: list[object] = [_serialize(embedding), limit]
    rows = connection.execute(sql, params).fetchall()
    results: list[SearchHit] = []
    for row in rows:
        if path_prefix and not row["path"].startswith(path_prefix.rstrip("/") + "/"):
            continue
        if tags:
            matched = connection.execute(
                "SELECT 1 FROM note_tags WHERE note_id=? AND tag IN ("
                + ",".join("?" for _ in tags)
                + ")",
                [row["note_id"], *[tag.casefold().lstrip("#") for tag in tags]],
            ).fetchone()
            if not matched:
                continue
        score = 1.0 / (1.0 + float(row["distance"]))
        results.append(
            SearchHit(
                chunk_id=int(row["rowid"]),
                note_id=row["note_id"],
                path=row["path"],
                title=row["title"],
                heading_path=json.loads(row["heading_path"]),
                content=row["content"],
                score=score,
                semantic_score=score,
            )
        )
    return results


def _serialize(values: list[float]) -> bytes:
    import struct

    return struct.pack(f"{len(values)}f", *values)
