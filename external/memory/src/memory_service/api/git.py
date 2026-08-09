from fastapi import APIRouter, Request

from memory_service.domain.schemas import CheckpointRequest

router = APIRouter(prefix="/v1/git", tags=["git"])


@router.post("/init")
async def init_git(request: Request):
    return request.app.state.resources.git.init()


@router.get("/status")
async def git_status(request: Request):
    return request.app.state.resources.git.status()


@router.get("/diff")
async def git_diff(request: Request):
    return {"diff": request.app.state.resources.git.diff()}


@router.post("/checkpoint")
async def checkpoint(request: Request, payload: CheckpointRequest):
    return request.app.state.resources.git.checkpoint(payload.message)


@router.get("/history")
async def history(request: Request, limit: int = 50):
    return {"history": request.app.state.resources.git.history(limit=max(1, min(limit, 200)))}
