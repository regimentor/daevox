from pathlib import Path

from fastapi.testclient import TestClient


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
