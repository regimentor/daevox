import logging

from fastapi import APIRouter, Request

from memory_service.api import ERROR_RESPONSES
from memory_service.domain.schemas import (
    CheckpointRequest,
    GitCheckpointResponse,
    GitDiffResponse,
    GitHistoryResponse,
    GitInitResponse,
    GitStatusResponse,
)

router = APIRouter(prefix="/v1/git", tags=["git"])
logger = logging.getLogger(__name__)


@router.post(
    "/init",
    response_model=GitInitResponse,
    responses=ERROR_RESPONSES,
    summary="Initialize Git for the Vault",
    description="Initializes a Git repository in the configured Vault if one does not exist.",
)
async def init_git(request: Request):
    result = request.app.state.resources.git.init()
    logger.info(
        "Git repository initialized path=%s",
        result["path"],
        extra={"path": result["path"]},
    )
    return result


@router.get(
    "/status",
    response_model=GitStatusResponse,
    responses=ERROR_RESPONSES,
    summary="Get Vault Git status",
)
async def git_status(request: Request):
    return request.app.state.resources.git.status()


@router.get(
    "/diff",
    response_model=GitDiffResponse,
    responses=ERROR_RESPONSES,
    summary="Get the Markdown diff",
    description="Returns the working-tree diff for Markdown files in the Vault.",
)
async def git_diff(request: Request):
    return {"diff": request.app.state.resources.git.diff()}


@router.post(
    "/checkpoint",
    response_model=GitCheckpointResponse,
    responses=ERROR_RESPONSES,
    summary="Create a Git checkpoint",
    description="Commits changed Markdown files in the Vault with the supplied message.",
)
async def checkpoint(request: Request, payload: CheckpointRequest):
    result = request.app.state.resources.git.checkpoint(payload.message)
    logger.info(
        "Git checkpoint completed created=%s commit=%s",
        result["created"],
        result.get("commit"),
        extra={"created": result["created"], "commit": result.get("commit")},
    )
    return result


@router.get(
    "/history",
    response_model=GitHistoryResponse,
    responses=ERROR_RESPONSES,
    summary="List Git history",
)
async def history(request: Request, limit: int = 50):
    return {"history": request.app.state.resources.git.history(limit=max(1, min(limit, 200)))}
