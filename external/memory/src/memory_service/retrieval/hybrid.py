from __future__ import annotations

import logging

from memory_service.domain.errors import unavailable
from memory_service.retrieval.keyword import keyword_search
from memory_service.retrieval.rrf import reciprocal_rank_fusion
from memory_service.retrieval.semantic import semantic_search

logger = logging.getLogger(__name__)


async def search(
    index,
    query: str,
    mode: str,
    limit: int,
    path_prefix: str | None,
    tags: list[str],
    expand_links: bool,
):
    with index.database.connect() as connection:
        keyword = keyword_search(
            connection, query, index.config.keyword_candidates, path_prefix, tags
        )
        if mode == "keyword":
            results = keyword[:limit]
        else:
            if not index.provider.ready or not index.database.vector_available:
                if mode == "semantic":
                    logger.warning("semantic search unavailable mode=%s", mode)
                    raise unavailable("semantic search is not ready")
                logger.info(
                    "falling back to keyword search; semantic search unavailable mode=%s", mode
                )
                results = keyword[:limit]
            else:
                semantic = await semantic_search(
                    connection,
                    index.provider,
                    query,
                    index.config.semantic_candidates,
                    path_prefix,
                    tags,
                )
                results = (
                    semantic
                    if mode == "semantic"
                    else reciprocal_rank_fusion(keyword, semantic, index.config.rrf_k)
                )[:limit]
        if expand_links and results:
            if path_prefix or tags:
                results = index.expand_link_hits(
                    connection, results, limit, path_prefix, tags
                )
            else:
                results = index.expand_link_hits(connection, results, limit)
        logger.debug(
            "hybrid search finished mode=%s result_count=%s expand_links=%s",
            mode,
            len(results),
            expand_links,
            extra={"mode": mode, "result_count": len(results), "expand_links": expand_links},
        )
        return results[:limit]
