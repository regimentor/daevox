import json
from pathlib import Path

from memory_service.main import _run_reset


def test_reset_removes_markdown_and_database_files_but_preserves_metadata(
    test_settings, capsys
):
    vault_path = test_settings.vault_path
    (vault_path / "projects").mkdir(parents=True)
    (vault_path / "projects" / "note.md").write_text("note", encoding="utf-8")
    (vault_path / "attachments").mkdir()
    (vault_path / "attachments" / "keep.bin").write_bytes(b"keep")
    (vault_path / "keep.txt").write_text("keep", encoding="utf-8")
    (vault_path / ".git").mkdir()
    (vault_path / ".git" / "history.md").write_text("history", encoding="utf-8")
    (vault_path / ".obsidian").mkdir()
    (vault_path / ".obsidian" / "config.md").write_text("config", encoding="utf-8")

    test_settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    database_paths = (
        test_settings.db_path,
        Path(f"{test_settings.db_path}-wal"),
        Path(f"{test_settings.db_path}-shm"),
    )
    for path in database_paths:
        path.write_bytes(b"database")

    result = _run_reset(test_settings)

    assert result == {
        "vault_path": str(vault_path),
        "removed_markdown": 1,
        "removed_directories": 1,
        "db_path": str(test_settings.db_path),
        "removed_database_files": 3,
    }
    assert not (vault_path / "projects" / "note.md").exists()
    assert not (vault_path / "projects").exists()
    assert (vault_path / "attachments" / "keep.bin").exists()
    assert (vault_path / "keep.txt").exists()
    assert (vault_path / ".git" / "history.md").exists()
    assert (vault_path / ".obsidian" / "config.md").exists()
    assert all(not path.exists() for path in database_paths)
    assert json.loads(capsys.readouterr().out) == result


def test_reset_handles_missing_data(test_settings, capsys):
    result = _run_reset(test_settings)

    assert result["removed_markdown"] == 0
    assert result["removed_directories"] == 0
    assert result["removed_database_files"] == 0
    assert test_settings.vault_path.is_dir()
    assert json.loads(capsys.readouterr().out) == result
