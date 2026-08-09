from __future__ import annotations

from collections import defaultdict

from memory_service.domain.models import SearchHit


def reciprocal_rank_fusion(
    keyword: list[SearchHit], semantic: list[SearchHit], k: int = 60
) -> list[SearchHit]:
    combined: dict[int, SearchHit] = {}
    scores: defaultdict[int, float] = defaultdict(float)
    for rank, hit in enumerate(keyword, 1):
        combined[hit.chunk_id] = hit
        scores[hit.chunk_id] += 1 / (k + rank)
    for rank, hit in enumerate(semantic, 1):
        combined.setdefault(hit.chunk_id, hit)
        existing = combined[hit.chunk_id]
        existing.semantic_score = hit.semantic_score
        if existing.keyword_score is None:
            existing.keyword_score = hit.keyword_score
        scores[hit.chunk_id] += 1 / (k + rank)
    result = []
    for chunk_id, hit in combined.items():
        hit.score = scores[chunk_id]
        result.append(hit)
    return sorted(result, key=lambda hit: hit.score, reverse=True)
