from fastapi import APIRouter, Request

from memory_service.api import ERROR_RESPONSES
from memory_service.domain.schemas import ReindexResponse

router = APIRouter(prefix="/v1/admin", tags=["admin"])


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
    return {"reindexed": True, **result}
