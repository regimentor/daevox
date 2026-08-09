from fastapi import APIRouter, Request, Response, status

from memory_service.domain.schemas import NoteCreate, NoteResponse, NoteUpdate, RestoreRequest
from memory_service.storage.markdown import parse_markdown, render_markdown, utc_now

router = APIRouter(prefix="/v1/notes", tags=["notes"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(request: Request, payload: NoteCreate):
    return await request.app.state.resources.memory.create(payload)


@router.get("/{note_id}/history")
async def note_history(request: Request, note_id: str):
    row, _, _ = request.app.state.resources.memory.get_by_id(note_id)
    return {"note_id": note_id, "history": request.app.state.resources.git.history(row["path"])}


@router.get("/{note_id}/revisions/{revision}")
async def revision(request: Request, note_id: str, revision: str):
    row, _, _ = request.app.state.resources.memory.get_by_id(note_id)
    content = request.app.state.resources.git.show(revision, row["path"])
    return {"note_id": note_id, "revision": revision, "path": row["path"], "raw": content}


@router.post("/{note_id}/restore")
async def restore(request: Request, note_id: str, payload: RestoreRequest):
    resources = request.app.state.resources
    async with resources.memory._mutation_lock:
        row, _, _ = resources.memory.get_by_id(note_id)
        raw = resources.git.show(payload.revision, row["path"])
        parsed = parse_markdown(raw, row["path"])
        frontmatter = dict(parsed.frontmatter)
        frontmatter["id"] = note_id
        frontmatter["updated"] = utc_now()
        resources.memory.storage.write_path(row["path"], render_markdown(parsed.body, frontmatter))
        await resources.indexer.index_path(resources.paths.absolute(row["path"]), note_id)
    return {"id": note_id, "path": row["path"], "revision": payload.revision}


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(request: Request, note_id: str):
    return request.app.state.resources.memory.response(note_id)


@router.put("/{note_id}")
async def update_note(request: Request, note_id: str, payload: NoteUpdate):
    return await request.app.state.resources.memory.update(note_id, payload)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(request: Request, note_id: str):
    await request.app.state.resources.memory.delete(note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
