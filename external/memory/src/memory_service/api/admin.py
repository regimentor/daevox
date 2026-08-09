from fastapi import APIRouter, Request

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.post("/reindex")
async def reindex(request: Request):
    resources = request.app.state.resources
    result = await resources.indexer.rebuild()
    return {"reindexed": True, **result}
