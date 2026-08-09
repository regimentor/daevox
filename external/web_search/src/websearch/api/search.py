import logging
import time

from fastapi import APIRouter, Request

from websearch.models.search import SearchRequest, SearchResponse
from websearch.observability import query_digest

router = APIRouter(prefix="/v1")
logger = logging.getLogger(__name__)


@router.post("/web_search", response_model=SearchResponse)
async def web_search(payload: SearchRequest, request: Request) -> SearchResponse:
    started = time.perf_counter()
    logger.info(
        "web search started",
        extra={
            "event": "search_started",
            "query_hash": query_digest(payload.query),
            "query_length": len(payload.query),
            "backend": payload.backend,
            "region": payload.region,
            "page": payload.page,
            "max_results": payload.max_results,
        },
    )
    response = await request.app.state.resources.search.search(payload)
    logger.info(
        "web search completed",
        extra={
            "event": "search_completed",
            "query_hash": query_digest(payload.query),
            "result_count": len(response.results),
            "elapsed_ms": round((time.perf_counter() - started) * 1000),
        },
    )
    return response
