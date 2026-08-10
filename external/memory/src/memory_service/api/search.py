from fastapi import APIRouter, Request

from memory_service.api import ERROR_RESPONSES
from memory_service.domain.schemas import SearchRequest, SearchResponse, SearchResult
from memory_service.retrieval.hybrid import search

router = APIRouter(prefix="/v1/search", tags=["search"])


@router.post(
    "",
    response_model=SearchResponse,
    responses=ERROR_RESPONSES,
    summary="Search notes",
    description=(
        "Searches indexed Markdown chunks using keyword, semantic or hybrid retrieval. "
        "Semantic-only search returns 503 when embeddings are unavailable."
    ),
)
async def search_notes(request: Request, payload: SearchRequest):
    resources = request.app.state.resources
    hits = await search(
        resources.indexer,
        payload.query,
        payload.mode,
        payload.limit or resources.settings.search_default_limit,
        payload.path_prefix,
        payload.tags,
        payload.expand_links,
    )
    return SearchResponse(
        query=payload.query,
        mode=payload.mode,
        results=[
            SearchResult(
                note_id=hit.note_id,
                path=hit.path,
                title=hit.title,
                heading_path=hit.heading_path,
                content=hit.content,
                score=hit.score,
                keyword_score=hit.keyword_score,
                semantic_score=hit.semantic_score,
                chunk_id=str(hit.chunk_id),
            )
            for hit in hits
        ],
    )
