from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from memory_service.coordination import OperationCoordinator
from memory_service.database.connection import Database
from memory_service.domain.errors import conflict
from memory_service.domain.models import ParsedNote
from memory_service.indexing.chunker import chunk_note
from memory_service.indexing.embeddings import EmbeddingProvider
from memory_service.storage.markdown import parse_markdown
from memory_service.storage.paths import VaultPaths

logger = logging.getLogger(__name__)


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _normalize_tag(tag: str) -> str:
    return tag.strip().lstrip("#").casefold()


class Indexer:
    def __init__(
        self,
        database: Database,
        paths: VaultPaths,
        provider: EmbeddingProvider,
        config,
        coordinator: OperationCoordinator | None = None,
    ):
        self.database = database
        self.paths = paths
        self.provider = provider
        self.config = config
        self.coordinator = coordinator or OperationCoordinator()

    async def index_path(self, path: Path, note_id: str | None = None) -> str:
        async with self.coordinator.lock:
            return await self._index_path(path, note_id)

    async def _index_path(self, path: Path, note_id: str | None = None) -> str:
        relative = self.paths.display(path)
        raw = path.read_text(encoding="utf-8")
        parsed = parse_markdown(raw, relative)
        note_id = note_id or parsed.note_id
        if note_id is None:
            raise ValueError(f"note {relative} has no stable id")
        return await self._index_parsed(note_id, relative, raw, parsed)

    async def index_parsed(self, note_id: str, path: str, raw: str, parsed: ParsedNote) -> str:
        async with self.coordinator.lock:
            return await self._index_parsed(note_id, path, raw, parsed)

    async def _index_parsed(self, note_id: str, path: str, raw: str, parsed: ParsedNote) -> str:
        chunks = chunk_note(
            parsed,
            self.config.chunk_target_tokens,
            self.config.chunk_max_tokens,
            self.config.chunk_overlap_tokens,
        )
        embeddings: list[list[float]] = []
        reusable: dict[str, list[float]] = {}
        with self.database.connect() as connection:
            old = connection.execute(
                "SELECT content_hash FROM chunks WHERE note_id = ?", (note_id,)
            ).fetchall()
            if self.database.vector_available:
                for row in old:
                    try:
                        vector = connection.execute(
                            "SELECT embedding FROM chunk_vectors WHERE rowid = "
                            "(SELECT id FROM chunks WHERE note_id = ? "
                            "AND content_hash = ? LIMIT 1)",
                            (note_id, row["content_hash"]),
                        ).fetchone()
                        if vector:
                            reusable[row["content_hash"]] = _deserialize(vector["embedding"])
                    except Exception:
                        pass
        missing = [chunk.content for chunk in chunks if chunk.content_hash not in reusable]
        generated = (
            await self.provider.embed_documents(missing) if self.provider.ready and missing else []
        )
        generated_iter = iter(generated)
        for chunk in chunks:
            embeddings.append(reusable.get(chunk.content_hash) or next(generated_iter, []))

        now = datetime.now(UTC).isoformat(timespec="seconds")
        content_hash = _hash(raw)
        with self.database.transaction(), self.database.connect() as connection:
            existing = connection.execute(
                "SELECT id,path FROM notes WHERE id = ?", (note_id,)
            ).fetchone()
            if existing is not None and existing["path"] != path:
                old_path = self.paths.absolute(existing["path"])
                if old_path.exists():
                    raise conflict(
                        f"frontmatter.id {note_id} is already indexed at {existing['path']}"
                    )
            path_collision = connection.execute(
                "SELECT id FROM notes WHERE path = ?", (path,)
            ).fetchone()
            if path_collision and path_collision["id"] != note_id:
                raise conflict(f"note path is indexed by another note: {path}")
            connection.execute(
                "INSERT INTO notes(id,path,title,content_hash,raw_content,created_at,"
                "updated_at,indexed_at) "
                "VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET path=excluded.path, "
                "title=excluded.title, content_hash=excluded.content_hash, "
                "raw_content=excluded.raw_content, "
                "created_at=COALESCE(notes.created_at, excluded.created_at), "
                "updated_at=excluded.updated_at, "
                "indexed_at=excluded.indexed_at",
                (
                    note_id,
                    path,
                    parsed.title,
                    content_hash,
                    raw,
                    str(parsed.frontmatter.get("created"))
                    if parsed.frontmatter.get("created")
                    else now,
                    str(parsed.frontmatter.get("updated"))
                    if parsed.frontmatter.get("updated")
                    else now,
                    now,
                ),
            )
            connection.execute("DELETE FROM chunk_fts WHERE note_id = ?", (note_id,))
            if self.database.vector_available:
                connection.execute(
                    "DELETE FROM chunk_vectors WHERE rowid IN "
                    "(SELECT id FROM chunks WHERE note_id = ?)",
                    (note_id,),
                )
            connection.execute("DELETE FROM chunks WHERE note_id = ?", (note_id,))
            connection.execute("DELETE FROM note_tags WHERE note_id = ?", (note_id,))
            connection.execute("DELETE FROM links WHERE source_note_id = ?", (note_id,))
            for tag in sorted(_normalize_tag(tag) for tag in parsed.tags if tag):
                connection.execute("INSERT OR IGNORE INTO tags(tag) VALUES(?)", (tag,))
                connection.execute(
                    "INSERT OR IGNORE INTO note_tags(note_id,tag) VALUES(?,?)", (note_id, tag)
                )
            for link in parsed.links:
                connection.execute(
                    "INSERT INTO links(source_note_id,target_text,target_heading,alias) "
                    "VALUES(?,?,?,?)",
                    (note_id, link.target_text, link.target_heading, link.alias),
                )
            for index, chunk in enumerate(chunks):
                cursor = connection.execute(
                    "INSERT INTO chunks(note_id,position,heading_path,content,content_hash) "
                    "VALUES(?,?,?,?,?)",
                    (
                        note_id,
                        index,
                        json.dumps(chunk.heading_path, ensure_ascii=False),
                        chunk.content,
                        chunk.content_hash,
                    ),
                )
                chunk_id = cursor.lastrowid
                connection.execute(
                    "INSERT INTO chunk_fts(content,heading_path,title,path,note_id,chunk_id) "
                    "VALUES(?,?,?,?,?,?)",
                    (
                        chunk.content,
                        json.dumps(chunk.heading_path, ensure_ascii=False),
                        parsed.title,
                        path,
                        note_id,
                        chunk_id,
                    ),
                )
                vector = embeddings[index] if index < len(embeddings) else []
                if self.database.vector_available and vector:
                    connection.execute(
                        "INSERT INTO chunk_vectors(rowid, embedding) VALUES(?,?)",
                        (chunk_id, _serialize(vector)),
                    )
            connection.commit()
        self.resolve_links()
        logger.info(
            "indexed note", extra={"note_id": note_id, "path": path, "chunk_count": len(chunks)}
        )
        return note_id

    def remove_note(self, note_id: str, indexed_path: str | None = None) -> None:
        with self.database.transaction(), self.database.connect() as connection:
            predicate = "id = ?"
            params: tuple[object, ...] = (note_id,)
            if indexed_path is not None:
                predicate += " AND path = ?"
                params += (indexed_path,)
            row = connection.execute(f"SELECT id FROM notes WHERE {predicate}", params).fetchone()
            if row is None:
                return
            connection.execute("DELETE FROM chunk_fts WHERE note_id = ?", (note_id,))
            if self.database.vector_available:
                connection.execute(
                    "DELETE FROM chunk_vectors WHERE rowid IN "
                    "(SELECT id FROM chunks WHERE note_id = ?)",
                    (note_id,),
                )
            connection.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            connection.commit()

    def resolve_links(self) -> None:
        with self.database.transaction(), self.database.connect() as connection:
            connection.execute("UPDATE links SET target_note_id = NULL")
            rows = connection.execute("SELECT id,target_text FROM links").fetchall()
            notes = connection.execute("SELECT id,path FROM notes").fetchall()
            for row in rows:
                target = row["target_text"].casefold().strip()
                matches = [
                    note
                    for note in notes
                    if note["path"].casefold() == target
                    or note["path"].casefold().removesuffix(".md") == target
                    or note["path"].rsplit("/", 1)[-1].casefold().removesuffix(".md") == target
                ]
                match = matches[0] if matches else None
                if match:
                    connection.execute(
                        "UPDATE links SET target_note_id=? WHERE id=?", (match["id"], row["id"])
                    )
            connection.commit()

    async def reconcile(self) -> dict[str, object]:
        async with self.coordinator.lock:
            return await self._reconcile()

    async def _reconcile(self) -> dict[str, object]:
        current = {self.paths.display(path): path for path in self.paths.scan()}
        parsed_by_path: dict[str, ParsedNote] = {}
        paths_by_id: dict[str, list[str]] = {}
        for path_text, path in current.items():
            raw = path.read_text(encoding="utf-8")
            parsed = parse_markdown(raw, path_text)
            if parsed.note_id is None:
                await self._adopt_missing_id(path, path_text, parsed)
                raw = path.read_text(encoding="utf-8")
                parsed = parse_markdown(raw, path_text)
            parsed_by_path[path_text] = parsed
            if parsed.note_id is not None:
                paths_by_id.setdefault(parsed.note_id, []).append(path_text)

        with self.database.connect() as connection:
            indexed = connection.execute("SELECT id,path FROM notes").fetchall()
        indexed_paths = {row["path"]: row["id"] for row in indexed}
        duplicates = []
        duplicate_ids: set[str] = set()
        for candidate_id, paths in sorted(paths_by_id.items()):
            if len(paths) > 1:
                duplicate_ids.add(candidate_id)
                duplicates.append(
                    {
                        "id": candidate_id,
                        "paths": sorted(paths),
                        "indexed_path": next(
                            (row["path"] for row in indexed if row["id"] == candidate_id), None
                        ),
                    }
                )
        changed = 0
        for path_text, path in current.items():
            parsed = parsed_by_path[path_text]
            stable_id = parsed.note_id
            if stable_id is None:
                continue
            if stable_id in duplicate_ids:
                indexed_path = next(
                    (row["path"] for row in indexed if row["id"] == stable_id), None
                )
                # Keep the existing source path authoritative. If it disappeared,
                # choose a deterministic path and report the conflict.
                if indexed_path and indexed_path != path_text and indexed_path in current:
                    continue
                if path_text != sorted(paths_by_id[stable_id])[0]:
                    continue
            raw = path.read_text(encoding="utf-8")
            with self.database.connect() as connection:
                old = connection.execute(
                    "SELECT content_hash FROM notes WHERE id=?", (stable_id,)
                ).fetchone()
            if (
                not old
                or old["content_hash"] != _hash(raw)
                or indexed_paths.get(path_text) != stable_id
                or self._vectors_missing(stable_id)
            ):
                await self._index_path(path, stable_id)
                changed += 1
        deleted = 0
        for path_text, note_id in indexed_paths.items():
            if path_text not in current and note_id not in paths_by_id:
                self.remove_note(note_id, path_text)
                deleted += 1
        result: dict[str, object] = {"indexed": changed, "deleted": deleted}
        if duplicates:
            result["duplicates"] = duplicates
        self.resolve_links()
        return result

    def _vectors_missing(self, note_id: str) -> bool:
        if not self.database.vector_available:
            return False
        with self.database.connect() as connection:
            chunk_count = connection.execute(
                "SELECT count(*) FROM chunks WHERE note_id=?", (note_id,)
            ).fetchone()[0]
            vector_count = connection.execute(
                "SELECT count(*) FROM chunk_vectors WHERE rowid IN "
                "(SELECT id FROM chunks WHERE note_id=?)",
                (note_id,),
            ).fetchone()[0]
        return chunk_count != vector_count

    async def rebuild(self) -> dict[str, object]:
        async with self.coordinator.lock:
            with self.database.transaction(), self.database.connect() as connection:
                connection.execute("DELETE FROM chunk_fts")
                if self.database.vector_available:
                    connection.execute("DELETE FROM chunk_vectors")
                connection.execute("DELETE FROM notes")
                connection.execute("DELETE FROM tags")
                connection.commit()
            return await self._reconcile()

    async def _adopt_missing_id(self, path: Path, path_text: str, parsed: ParsedNote) -> None:
        from memory_service.services import new_uuid7
        from memory_service.storage.markdown import render_markdown, utc_now

        frontmatter = dict(parsed.frontmatter)
        frontmatter["id"] = new_uuid7()
        frontmatter.setdefault("created", utc_now())
        frontmatter["updated"] = utc_now()
        content = render_markdown(parsed.body, frontmatter)
        from memory_service.storage.markdown import MarkdownStorage

        MarkdownStorage(self.paths).write_path(path_text, content)


def _serialize(values: list[float]) -> bytes:
    import struct

    return struct.pack(f"{len(values)}f", *values)


def _deserialize(value: bytes) -> list[float]:
    import struct

    return list(struct.unpack(f"{len(value) // 4}f", value))
