import logging

from fastapi import APIRouter, Request, Response, status

from memory_service.api import ERROR_RESPONSES
from memory_service.domain.schemas import (
    NoteCreate,
    NoteHistoryResponse,
    NoteMutationResponse,
    NoteResponse,
    NoteUpdate,
    RestoreRequest,
    RestoreResponse,
    RevisionResponse,
)
from memory_service.storage.markdown import parse_markdown, render_markdown, utc_now

router = APIRouter(prefix="/v1/notes", tags=["notes"])
logger = logging.getLogger(__name__)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=NoteMutationResponse,
    responses=ERROR_RESPONSES,
    summary="Create a note",
    description="Creates a Markdown note in the configured Obsidian-compatible Vault.",
)
async def create_note(request: Request, payload: NoteCreate):
    return await request.app.state.resources.memory.create(payload)


@router.get(
    "/{note_id}/history",
    response_model=NoteHistoryResponse,
    responses=ERROR_RESPONSES,
    summary="List note history",
)
async def note_history(request: Request, note_id: str):
    row, _, _ = request.app.state.resources.memory.get_by_id(note_id)
    return {"note_id": note_id, "history": request.app.state.resources.git.history(row["path"])}


@router.get(
    "/{note_id}/revisions/{revision}",
    response_model=RevisionResponse,
    responses=ERROR_RESPONSES,
    summary="Read a historical note revision",
    description="Reads the note as it existed at a Git revision, including before a rename.",
)
async def revision(request: Request, note_id: str, revision: str):
    row, _, _ = request.app.state.resources.memory.get_by_id(note_id)
    content = request.app.state.resources.git.show(revision, row["path"], note_id)
    return {"note_id": note_id, "revision": revision, "path": row["path"], "raw": content}


@router.post(
    "/{note_id}/restore",
    response_model=RestoreResponse,
    responses=ERROR_RESPONSES,
    summary="Restore a note revision",
    description="Writes a historical revision into the working tree without rewriting Git history.",
)
async def restore(request: Request, note_id: str, payload: RestoreRequest):
    resources = request.app.state.resources
    async with resources.memory._mutation_lock:
        row, _, _ = resources.memory.get_by_id(note_id)
        raw = resources.git.show(payload.revision, row["path"], note_id)
        parsed = parse_markdown(raw, row["path"])
        frontmatter = dict(parsed.frontmatter)
        frontmatter["id"] = note_id
        frontmatter["updated"] = utc_now()
        resources.memory.storage.write_path(row["path"], render_markdown(parsed.body, frontmatter))
        await resources.indexer._index_path(resources.paths.absolute(row["path"]), note_id)
    logger.info(
        "note restored note_id=%s path=%s revision=%s",
        note_id,
        row["path"],
        payload.revision,
        extra={"note_id": note_id, "path": row["path"], "revision": payload.revision},
    )
    return {"id": note_id, "path": row["path"], "revision": payload.revision}


@router.get(
    "/{note_id}",
    response_model=NoteResponse,
    responses=ERROR_RESPONSES,
    summary="Get a note",
)
async def get_note(request: Request, note_id: str):
    return request.app.state.resources.memory.response(note_id)


@router.put(
    "/{note_id}",
    response_model=NoteMutationResponse,
    responses=ERROR_RESPONSES,
    summary="Update a note",
    description="Updates note content and/or metadata; optionally moves its Markdown path.",
)
async def update_note(request: Request, note_id: str, payload: NoteUpdate):
    return await request.app.state.resources.memory.update(note_id, payload)


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ERROR_RESPONSES, 204: {"description": "Note deleted."}},
    summary="Delete a note",
)
async def delete_note(request: Request, note_id: str):
    await request.app.state.resources.memory.delete(note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
