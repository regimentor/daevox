from __future__ import annotations

import asyncio
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from memory_service.domain.errors import conflict, not_found
from memory_service.domain.schemas import NoteCreate, NoteUpdate
from memory_service.indexing.indexer import Indexer
from memory_service.storage.markdown import (
    MarkdownStorage,
    parse_markdown,
    render_markdown,
    utc_now,
)


def new_uuid7() -> str:
    timestamp = int(datetime.now(UTC).timestamp() * 1000)
    random_bits = uuid.uuid4().int & ((1 << 74) - 1)
    value = (
        (timestamp << 80)
        | (0x7 << 76)
        | ((random_bits >> 62) << 64)
        | (0x2 << 62)
        | (random_bits & ((1 << 62) - 1))
    )
    return str(uuid.UUID(int=value))


class MemoryService:
    def __init__(self, settings, storage: MarkdownStorage, indexer: Indexer):
        self.settings = settings
        self.storage = storage
        self.indexer = indexer
        self._mutation_lock = asyncio.Lock()

    def _prepare(
        self, note_id: str, request: NoteCreate | NoteUpdate, current=None
    ) -> tuple[str, dict[str, object]]:
        if current:
            raw, parsed = current
            frontmatter = dict(parsed.frontmatter)
            content = parsed.body
            path = request.path or ""
        else:
            frontmatter = dict(request.frontmatter or {})
            content = request.content
            path = request.path or ""
        if request.frontmatter is not None:
            frontmatter.update(request.frontmatter)
        frontmatter["id"] = note_id
        if request.title is not None:
            frontmatter["title"] = request.title
        frontmatter.setdefault("created", utc_now())
        frontmatter["updated"] = utc_now()
        if current and request.content is None:
            content = parsed.body
        elif request.content is not None:
            content = request.content
        return path, frontmatter | {"__content": content}

    async def create(self, request: NoteCreate) -> dict[str, str]:
        async with self._mutation_lock:
            path = self.storage.paths.display(self.storage.paths.absolute(request.path))
            if self.storage.paths.absolute(path).exists():
                raise conflict(f"note path already exists: {path}")
            with self.indexer.database.connect() as connection:
                if connection.execute("SELECT 1 FROM notes WHERE path=?", (path,)).fetchone():
                    raise conflict(f"note path already exists: {path}")
            note_id = str(request.frontmatter.get("id") or new_uuid7())
            _, frontmatter = self._prepare(note_id, request)
            content = str(frontmatter.pop("__content"))
            self.storage.write_path(path, render_markdown(content, frontmatter))
            await self.indexer.index_path(self.storage.paths.absolute(path), note_id)
            return {"id": note_id, "path": path}

    def get_by_id(self, note_id: str):
        with self.indexer.database.connect() as connection:
            row = connection.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
        if not row:
            raise not_found(f"note not found: {note_id}")
        raw, parsed = self.storage.read_path(row["path"])
        return row, raw, parsed

    async def update(self, note_id: str, request: NoteUpdate) -> dict[str, str]:
        async with self._mutation_lock:
            row, raw, parsed = self.get_by_id(note_id)
            old_path = row["path"]
            new_path = (
                old_path
                if request.path is None
                else self.storage.paths.display(self.storage.paths.absolute(request.path))
            )
            if new_path != old_path:
                with self.indexer.database.connect() as connection:
                    if connection.execute(
                        "SELECT 1 FROM notes WHERE path=?", (new_path,)
                    ).fetchone():
                        raise conflict(f"note path already exists: {new_path}")
            request.path = new_path
            _, frontmatter = self._prepare(note_id, request, (raw, parsed))
            content = str(frontmatter.pop("__content"))
            self.storage.write_path(new_path, render_markdown(content, frontmatter))
            if new_path != old_path:
                self.storage.delete_path(old_path)
            await self.indexer.index_path(self.storage.paths.absolute(new_path), note_id)
            return {"id": note_id, "path": new_path}

    async def delete(self, note_id: str) -> None:
        async with self._mutation_lock:
            row, _, _ = self.get_by_id(note_id)
            self.storage.delete_path(row["path"])
            self.indexer.remove_note(note_id)

    async def reconcile_path(self, path: Path) -> None:
        if not path.exists():
            return
        relative = self.storage.paths.display(path)
        raw = path.read_text(encoding="utf-8")
        parsed = parse_markdown(raw, relative)
        note_id = parsed.note_id
        if note_id is None:
            note_id = new_uuid7()
            frontmatter = dict(parsed.frontmatter)
            frontmatter["id"] = note_id
            frontmatter.setdefault("created", utc_now())
            frontmatter["updated"] = utc_now()
            self.storage.write_path(relative, render_markdown(parsed.body, frontmatter))
        await self.indexer.index_path(path, note_id)

    async def reconcile_deleted(self, path: Path) -> None:
        relative = self.storage.paths.display(path)
        with self.indexer.database.connect() as connection:
            row = connection.execute("SELECT id FROM notes WHERE path=?", (relative,)).fetchone()
        if row:
            self.indexer.remove_note(row["id"])

    def response(self, note_id: str) -> dict[str, object]:
        row, raw, parsed = self.get_by_id(note_id)
        return {
            "id": note_id,
            "path": row["path"],
            "title": parsed.title,
            "content": parsed.body,
            "raw": raw,
            "frontmatter": parsed.frontmatter,
            "created": parsed.frontmatter.get("created"),
            "updated": parsed.frontmatter.get("updated"),
        }

    def expand_link_hits(self, connection, hits, limit):
        seen = {hit.chunk_id for hit in hits}
        expanded = list(hits)
        for hit in hits:
            rows = connection.execute(
                "SELECT c.id,c.note_id,c.content,c.heading_path,n.path,n.title FROM links l "
                "JOIN chunks c ON c.note_id=l.target_note_id JOIN notes n ON n.id=c.note_id "
                "WHERE l.source_note_id=? LIMIT 5",
                (hit.note_id,),
            ).fetchall()
            for row in rows:
                if row["id"] in seen:
                    continue
                seen.add(row["id"])
                from memory_service.domain.models import SearchHit

                expanded.append(
                    SearchHit(
                        chunk_id=row["id"],
                        note_id=row["note_id"],
                        path=row["path"],
                        title=row["title"],
                        heading_path=json.loads(row["heading_path"]),
                        content=row["content"],
                        score=hit.score * 0.5,
                    )
                )
        return sorted(expanded, key=lambda item: item.score, reverse=True)[:limit]
