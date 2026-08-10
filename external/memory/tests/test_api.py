from pathlib import Path

from fastapi.testclient import TestClient

from memory_service.app import create_app


def test_note_crud_search_and_rebuild(app, test_settings):
    with TestClient(app) as client:
        created = client.post(
            "/v1/notes",
            json={
                "path": "projects/local-agent.md",
                "title": "Local Agent",
                "content": "# Local Agent\n\nPython memory service.\n\n#agents",
                "frontmatter": {"tags": ["development"]},
            },
        )
        assert created.status_code == 201
        note_id = created.json()["id"]
        assert (test_settings.vault_path / "projects/local-agent.md").exists()

        result = client.post("/v1/search", json={"query": "memory service", "mode": "keyword"})
        assert result.status_code == 200
        assert result.json()["results"][0]["note_id"] == note_id

        changed = client.put(
            f"/v1/notes/{note_id}",
            json={"path": "projects/renamed.md", "content": "# Renamed\n\nUpdated content."},
        )
        assert changed.status_code == 200
        assert changed.json()["id"] == note_id
        assert (test_settings.vault_path / "projects/renamed.md").exists()
        assert not (test_settings.vault_path / "projects/local-agent.md").exists()

        assert client.post("/v1/admin/reindex").status_code == 200
        assert client.delete(f"/v1/notes/{note_id}").status_code == 204


def test_git_checkpoint_history_revision_and_restore(app, test_settings):
    with TestClient(app) as client:
        note = client.post(
            "/v1/notes",
            json={"path": "note.md", "content": "# Note\n\nVersion one."},
        ).json()
        assert client.post("/v1/git/init").status_code == 200
        checkpoint = client.post("/v1/git/checkpoint", json={"message": "first"}).json()
        revision = checkpoint["commit"]
        client.put(f"/v1/notes/{note['id']}", json={"content": "# Note\n\nVersion two."})
        restored = client.post(f"/v1/notes/{note['id']}/restore", json={"revision": revision})
        assert restored.status_code == 200
        assert "Version one" in Path(test_settings.vault_path / "note.md").read_text()


def test_external_markdown_edit_is_reconciled(app, test_settings):
    with TestClient(app) as client:
        created = client.post(
            "/v1/notes", json={"path": "external.md", "content": "# External\n\nBefore"}
        ).json()
        path = test_settings.vault_path / "external.md"
        path.write_text(
            f"---\nid: {created['id']}\n---\n\n# External\n\nAfter manual edit #manual",
            encoding="utf-8",
        )
        response = client.post("/v1/admin/reindex")
        assert response.status_code == 200
        result = client.post(
            "/v1/search", json={"query": "manual edit", "mode": "keyword", "tags": ["manual"]}
        )
        assert result.json()["results"][0]["note_id"] == created["id"]


def test_duplicate_frontmatter_id_is_reported_without_overwriting_index(app, test_settings):
    with TestClient(app) as client:
        created = client.post(
            "/v1/notes", json={"path": "canonical.md", "content": "canonical text"}
        ).json()
        duplicate = test_settings.vault_path / "duplicate.md"
        duplicate.write_text(
            f"---\nid: {created['id']}\n---\n\nexternal duplicate text\n", encoding="utf-8"
        )

        result = client.post("/v1/admin/reindex")
        assert result.status_code == 200
        assert result.json()["duplicates"] == [
            {
                "id": created["id"],
                "paths": ["canonical.md", "duplicate.md"],
                "indexed_path": None,
            }
        ]
        assert client.get(f"/v1/notes/{created['id']}").json()["path"] == "canonical.md"
        assert (
            client.post(
                "/v1/search", json={"query": "external duplicate", "mode": "keyword"}
            ).json()["results"]
            == []
        )


def test_api_rejects_unindexed_markdown_overwrite_and_rename(app, test_settings):
    with TestClient(app) as client:
        target = test_settings.vault_path / "unindexed.md"
        target.write_text("# Existing\n", encoding="utf-8")
        assert client.post("/v1/notes", json={"path": "unindexed.md"}).status_code == 409

        note = client.post("/v1/notes", json={"path": "source.md"}).json()
        assert (
            client.put(f"/v1/notes/{note['id']}", json={"path": "unindexed.md"}).status_code
            == 409
        )
        assert (test_settings.vault_path / "source.md").exists()


def test_startup_reconciliation_tracks_manual_rename(test_settings):
    with TestClient(create_app(test_settings)) as client:
        note = client.post("/v1/notes", json={"path": "before.md", "content": "body"}).json()
    (test_settings.vault_path / "before.md").rename(test_settings.vault_path / "after.md")

    with TestClient(create_app(test_settings)) as client:
        response = client.get(f"/v1/notes/{note['id']}")
        assert response.status_code == 200
        assert response.json()["path"] == "after.md"


def test_deleted_sqlite_is_rebuilt_from_markdown_in_new_process(test_settings):
    with TestClient(create_app(test_settings)) as client:
        first = client.post(
            "/v1/notes", json={"path": "one.md", "content": "first"}
        ).json()
        second = client.post(
            "/v1/notes", json={"path": "two.md", "content": "second"}
        ).json()
    test_settings.db_path.unlink()

    with TestClient(create_app(test_settings)) as client:
        assert client.get(f"/v1/notes/{first['id']}").status_code == 200
        assert client.get(f"/v1/notes/{second['id']}").status_code == 200
        result = client.post(
            "/v1/search", json={"query": "second", "mode": "keyword"}
        )
        assert result.status_code == 200
        assert result.json()["results"][0]["note_id"] == second["id"]
