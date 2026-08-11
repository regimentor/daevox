import asyncio
import sys
import types
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from watchfiles import Change

from memory_service.app import Resources, create_app
from memory_service.config import Settings
from memory_service.domain.errors import ServiceError
from memory_service.domain.models import SearchHit
from memory_service.git.models import GitCheckpoint, GitCommit
from memory_service.git.repository import GitRepository
from memory_service.indexing.embeddings import (
    FakeEmbeddingProvider,
    SentenceTransformerProvider,
)
from memory_service.indexing.watcher import VaultWatcher
from memory_service.retrieval import hybrid
from memory_service.retrieval.keyword import build_fts_query, keyword_search
from memory_service.retrieval.rrf import reciprocal_rank_fusion
from memory_service.retrieval.semantic import semantic_search


def _hit(chunk_id: int, score: float, *, keyword=None, semantic=None) -> SearchHit:
    return SearchHit(
        chunk_id=chunk_id,
        note_id=f"note-{chunk_id}",
        path=f"note-{chunk_id}.md",
        title=f"Note {chunk_id}",
        heading_path=[],
        content=f"content {chunk_id}",
        score=score,
        keyword_score=keyword,
        semantic_score=semantic,
    )


def test_embedding_settings_use_small_multilingual_model_and_validate_device():
    settings = Settings()
    assert settings.embedding_model == (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    assert Settings(embedding_device="cuda:1").embedding_device == "cuda:1"
    assert Settings(embedding_device="CPU").embedding_device == "cpu"
    with pytest.raises(ValueError, match="embedding_device"):
        Settings(embedding_device="cuda:gpu0")


def test_reciprocal_rank_fusion_merges_and_sorts_hits():
    keyword = [_hit(1, 0.8, keyword=0.8), _hit(2, 0.7, keyword=0.7)]
    semantic = [_hit(3, 0.6, keyword=0.6, semantic=0.6), _hit(1, 0.9, semantic=0.9)]

    result = reciprocal_rank_fusion(keyword, semantic, k=1)

    assert [hit.chunk_id for hit in result] == [1, 3, 2]
    assert result[0].semantic_score == 0.9
    assert result[0].keyword_score == 0.8
    assert result[1].keyword_score == 0.6
    assert result[0].score > result[1].score > result[2].score


class _Rows:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.rows[0] if self.rows else None


class _SemanticConnection:
    def __init__(self, rows):
        self.rows = rows
        self.tag_checks = 0

    def execute(self, sql, params):
        if sql.startswith("SELECT v.rowid"):
            return _Rows(self.rows)
        self.tag_checks += 1
        return _Rows([] if self.tag_checks == 1 else [{"matched": 1}])


@pytest.mark.asyncio
async def test_semantic_search_applies_path_and_tag_filters():
    rows = [
        {
            "rowid": 1,
            "distance": 0.1,
            "note_id": "outside",
            "content": "outside",
            "heading_path": "[]",
            "path": "archive/note.md",
            "title": "Outside",
        },
        {
            "rowid": 2,
            "distance": 0.2,
            "note_id": "unmatched",
            "content": "unmatched",
            "heading_path": '["Heading"]',
            "path": "projects/other.md",
            "title": "Other",
        },
        {
            "rowid": 3,
            "distance": 0.3,
            "note_id": "matched",
            "content": "matched",
            "heading_path": '["Heading"]',
            "path": "projects/memory.md",
            "title": "Memory",
        },
    ]
    connection = _SemanticConnection(rows)
    provider = FakeEmbeddingProvider()

    result = await semantic_search(connection, provider, "memory", 10, "projects", ["#Focus"])

    assert [hit.chunk_id for hit in result] == [3]
    assert result[0].semantic_score == pytest.approx(1 / 1.3)
    assert connection.tag_checks == 2


def test_fts_builder_quotes_user_syntax_and_escapes_path_prefix():
    assert build_fts_query('title:foo "bar-baz"') == '"title:foo ""bar-baz"""'
    with pytest.raises(ServiceError) as error:
        build_fts_query("***")
    assert error.value.status_code == 400

    class Connection:
        def __init__(self):
            self.sql = ""
            self.params = []

        def execute(self, sql, params):
            self.sql, self.params = sql, params
            return _Rows([])

    connection = Connection()
    keyword_search(connection, "plain", 5, "folder_%", [])
    assert "ESCAPE" in connection.sql
    assert connection.params[1] == "folder\\_\\%/%"


class _IndexForSearch:
    def __init__(self, ready: bool):
        self.database = SimpleNamespace(connect=lambda: nullcontext(object()))
        self.provider = SimpleNamespace(ready=ready)
        self.database.vector_available = ready
        self.config = SimpleNamespace(
            keyword_candidates=10, semantic_candidates=10, rrf_k=60
        )
        self.expanded = False

    def expand_link_hits(self, connection, hits, limit):
        self.expanded = True
        return hits + [_hit(99, 0.1)]


@pytest.mark.asyncio
async def test_hybrid_search_modes_and_link_expansion(monkeypatch):
    keyword_hits = [_hit(1, 0.5, keyword=0.5)]
    semantic_hits = [_hit(2, 0.4, semantic=0.4)]
    monkeypatch.setattr(hybrid, "keyword_search", lambda *args: keyword_hits)
    monkeypatch.setattr(hybrid, "semantic_search", AsyncMock(return_value=semantic_hits))

    keyword_index = _IndexForSearch(ready=False)
    assert await hybrid.search(keyword_index, "q", "keyword", 1, None, [], False) == keyword_hits

    unavailable_index = _IndexForSearch(ready=False)
    with pytest.raises(ServiceError, match="semantic search is not ready"):
        await hybrid.search(unavailable_index, "q", "semantic", 1, None, [], False)
    assert await hybrid.search(unavailable_index, "q", "hybrid", 1, None, [], False) == keyword_hits

    ready_index = _IndexForSearch(ready=True)
    result = await hybrid.search(ready_index, "q", "hybrid", 2, None, [], True)
    assert ready_index.expanded
    assert [hit.chunk_id for hit in result] == [1, 2]
    hybrid.semantic_search.assert_awaited_once()


@pytest.mark.asyncio
async def test_embedding_providers_cover_fake_and_transformer_paths(monkeypatch):
    fake = FakeEmbeddingProvider()
    query = await fake.embed_query("Memory memory")
    documents = await fake.embed_documents(["Memory", "other"])
    assert len(query) == fake.dimension
    assert documents[0] != documents[1]
    assert sum(value * value for value in query) == pytest.approx(1.0)

    provider = SentenceTransformerProvider("test-model", device="cpu")
    with pytest.raises(RuntimeError, match="not initialized"):
        await provider.embed_query("query")
    with pytest.raises(RuntimeError, match="not initialized"):
        await provider.embed_documents(["document"])

    class Encoded(list):
        def tolist(self):
            return list(self)

    class Model:
        def get_sentence_embedding_dimension(self):
            return 3

        def encode(self, values, normalize_embeddings):
            return Encoded([[1.0, 0.0, 0.0] for _ in values])

        def encode_query(self, value, normalize_embeddings):
            return Encoded([0.0, 1.0, 0.0])

        def encode_document(self, values, normalize_embeddings):
            return Encoded([[0.0, 0.0, 1.0] for _ in values])

    module = types.ModuleType("sentence_transformers")
    module.SentenceTransformer = lambda name, device: Model()
    monkeypatch.setitem(sys.modules, "sentence_transformers", module)

    await provider.initialize()
    assert provider.ready and provider.dimension == 3
    assert await provider.embed_query("query") == [0.0, 1.0, 0.0]
    assert await provider.embed_documents(["a", "b"]) == [
        [0.0, 0.0, 1.0],
        [0.0, 0.0, 1.0],
    ]


@pytest.mark.asyncio
async def test_vault_watcher_dispatches_changes_and_logs_failures(monkeypatch, tmp_path, caplog):
    service = SimpleNamespace(
        reconcile_path=AsyncMock(side_effect=[None, RuntimeError("broken")]),
        reconcile_deleted=AsyncMock(),
    )
    root = tmp_path / "vault"
    root.mkdir()

    async def fake_awatch(*args, **kwargs):
        yield {(Change.added, str(root / "added.md"))}
        yield {(Change.deleted, str(root / "deleted.md"))}
        yield {(Change.modified, str(root / "broken.md"))}

    monkeypatch.setattr("memory_service.indexing.watcher.awatch", fake_awatch)
    watcher = VaultWatcher(root, service, 100)

    await watcher.run()
    watcher.stop()

    service.reconcile_path.assert_any_await(root / "added.md")
    service.reconcile_path.assert_any_await(root / "broken.md")
    service.reconcile_deleted.assert_awaited_once_with(root / "deleted.md")
    assert "vault watcher failed" in caplog.text
    assert watcher._filter(Change.modified, str(root / "note.md"))
    assert not watcher._filter(Change.modified, str(root / "note.txt"))
    assert not watcher._filter(Change.modified, str(root / ".hidden.md"))
    assert not watcher._filter(Change.modified, str(root / ".git" / "note.md"))
    assert watcher.stop_event.is_set()


def test_git_repository_edge_cases_and_models(test_settings):
    test_settings.vault_path.mkdir(parents=True, exist_ok=True)
    repository = GitRepository(test_settings.vault_path, test_settings)
    assert repository.status() == {"initialized": False, "entries": []}
    assert repository.diff() == ""
    assert repository.history() == []
    with pytest.raises(ServiceError, match="not a Git repository"):
        repository.show("HEAD", "note.md")
    with pytest.raises(ServiceError, match="call /v1/git/init"):
        repository.checkpoint("missing")

    test_settings.git_author_name = "Coverage Test"
    test_settings.git_author_email = "coverage@example.test"
    repository.init()
    note = test_settings.vault_path / "note.md"
    note.write_text("# Note\n\nVersion one.\n", encoding="utf-8")
    assert "?? note.md" in repository.status()["entries"]
    commit = repository.checkpoint("first")
    assert commit["created"] is True
    assert repository.checkpoint("unchanged") == {"created": False}

    note.write_text("# Note\n\nVersion two.\n", encoding="utf-8")
    assert "Version two" in repository.diff()
    history = repository.history("note.md", limit=2)
    assert history and history[0]["message"] == "first"
    assert "Version one" in repository.show(str(commit["commit"]), "note.md")
    with pytest.raises(ServiceError, match="invalid Git revision"):
        repository.show("HEAD;rm", "note.md")

    assert GitCommit(commit="abc", author="Coverage", message="test").message == "test"
    assert GitCheckpoint(created=False).commit is None


def test_git_checkpoint_excludes_unrelated_staged_files(test_settings):
    test_settings.vault_path.mkdir(parents=True, exist_ok=True)
    repository = GitRepository(test_settings.vault_path, test_settings)
    repository.init()
    (test_settings.vault_path / "note.md").write_text("note\n", encoding="utf-8")
    unrelated = test_settings.vault_path / "unrelated.txt"
    unrelated.write_text("keep staged\n", encoding="utf-8")
    import subprocess

    subprocess.run(["git", "add", "unrelated.txt"], cwd=test_settings.vault_path, check=True)
    commit = repository.checkpoint("markdown only")
    assert commit["created"] is True
    files = subprocess.check_output(
        ["git", "show", "--format=", "--name-only", "HEAD"],
        cwd=test_settings.vault_path,
        text=True,
    ).splitlines()
    assert files == ["note.md"]
    assert "A  unrelated.txt" in repository.status()["entries"]


@pytest.mark.asyncio
async def test_indexer_adopts_missing_ids_and_removes_deleted_notes(test_settings):
    resources = Resources(test_settings)
    orphan = test_settings.vault_path / "orphan.md"
    orphan.write_text("# Orphan\n\nNo id yet.\n", encoding="utf-8")

    result = await resources.indexer.reconcile()
    assert result["indexed"] == 1
    raw = orphan.read_text(encoding="utf-8")
    assert "id:" in raw
    assert (await resources.indexer.reconcile()) == {"indexed": 0, "deleted": 0}

    orphan.unlink()
    assert await resources.indexer.reconcile() == {"indexed": 0, "deleted": 1}
    no_id = test_settings.vault_path / "no-id.md"
    no_id.write_text("# No id\n", encoding="utf-8")
    with pytest.raises(ValueError, match="has no stable id"):
        await resources.indexer.index_path(no_id)


def test_health_validation_and_service_error_handlers(app):
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        ready = client.get("/ready")
        assert ready.status_code == 200
        assert ready.json()["ready"] is True
        assert ready.json()["git_initialized"] is False

        assert client.post("/v1/notes", json={}).status_code == 422
        created = client.post("/v1/notes", json={"path": "duplicate.md"}).json()
        duplicate = client.post("/v1/notes", json={"path": "duplicate.md"})
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "conflict"
        missing = client.get("/v1/notes/missing")
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "not_found"
        assert client.delete(f"/v1/notes/{created['id']}").status_code == 204


def test_embedding_initialization_failure_is_reported(tmp_path, monkeypatch):
    async def fail_initialize(self):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(SentenceTransformerProvider, "initialize", fail_initialize)
    settings = Settings(
        vault_path=tmp_path / "vault",
        data_path=tmp_path / "data",
        db_path=tmp_path / "data" / "index.sqlite",
        embedding_provider="sentence-transformers",
        watch_enabled=False,
    ).resolve_paths()

    with TestClient(create_app(settings)) as client:
        ready = client.get("/ready").json()
        assert ready["ready"] is False
        assert ready["embeddings"] is False
        assert ready["embedding_error"] == "model unavailable"


def test_sqlite_vec_failure_keeps_keyword_only_database(tmp_path, monkeypatch):
    import sqlite_vec

    def fail_load(connection):
        raise RuntimeError("extension unavailable")

    monkeypatch.setattr(sqlite_vec, "load", fail_load)
    from memory_service.database.connection import Database

    database = Database(tmp_path / "index.sqlite")
    database.initialize(3)
    assert database.vector_available is False
    with database.connect() as connection:
        assert (
            connection.execute(
                "SELECT 1 FROM sqlite_master WHERE name='chunk_vectors'"
            ).fetchone()
            is None
        )


def test_watcher_lifecycle_is_started_and_stopped(test_settings, monkeypatch):
    instances = []

    class StubWatcher:
        def __init__(self, root, service, debounce_ms):
            self.stopped = False
            instances.append(self)

        async def run(self):
            await asyncio.sleep(3600)

        def stop(self):
            self.stopped = True

    monkeypatch.setattr("memory_service.app.VaultWatcher", StubWatcher)
    test_settings.watch_enabled = True

    with TestClient(create_app(test_settings)) as client:
        assert client.get("/health").status_code == 200
    assert instances and instances[0].stopped
