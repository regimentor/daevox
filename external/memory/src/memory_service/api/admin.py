import logging

from fastapi import APIRouter, Request

from memory_service.api import ERROR_RESPONSES
from memory_service.domain.schemas import ReindexResponse

router = APIRouter(prefix="/v1/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.post(
    "/reindex",
    response_model=ReindexResponse,
    responses=ERROR_RESPONSES,
    summary="Rebuild the derived index",
    description=(
        "Reconciles all Markdown files in the Vault and rebuilds SQLite metadata, FTS and "
        "available vectors. Markdown remains the source of truth."
    ),
)
async def reindex(request: Request):
    resources = request.app.state.resources
    result = await resources.indexer.rebuild()
    logger.info(
        "memory index rebuild completed indexed=%s deleted=%s duplicates=%s",
        result.get("indexed", 0),
        result.get("deleted", 0),
        len(result.get("duplicates", [])),
        extra=result,
    )
    return {"reindexed": True, **result}
