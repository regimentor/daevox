from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import uvicorn

from memory_service.app import create_app
from memory_service.config import Settings


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("watchfiles").setLevel(logging.WARNING)


def run() -> None:
    _configure_logging()
    parser = argparse.ArgumentParser(prog="memory-service")
    parser.add_argument(
        "command", nargs="?", choices=["serve", "reindex", "reset", "git-status"], default="serve"
    )
    args = parser.parse_args()
    settings = Settings().resolve_paths()
    if args.command == "serve":
        uvicorn.run(
            "memory_service.main:app",
            host=settings.host,
            port=settings.port,
            reload=False,
            access_log=False,
        )
        return
    import asyncio

    if args.command == "reindex":
        asyncio.run(_run_reindex(settings))
    elif args.command == "git-status":
        asyncio.run(_run_git_status(settings))
    else:
        _run_reset(settings)


async def _run_reindex(settings: Settings) -> None:
    from memory_service.app import Resources

    resources = Resources(settings)
    if hasattr(resources.provider, "initialize"):
        await resources.provider.initialize()
        resources.database.initialize(resources.provider.dimension)
    print(await resources.indexer.rebuild())


async def _run_git_status(settings: Settings) -> None:
    from memory_service.app import Resources

    resources = Resources(settings)
    print(resources.git.status())


def _run_reset(settings: Settings) -> dict[str, object]:
    vault_path = settings.vault_path
    if vault_path == vault_path.parent:
        raise ValueError("MEMORY_VAULT_PATH must not be the filesystem root")

    vault_path.mkdir(parents=True, exist_ok=True)
    removed_markdown = 0
    for path in vault_path.rglob("*.md"):
        relative_path = path.relative_to(vault_path)
        if ".git" in relative_path.parts or ".obsidian" in relative_path.parts:
            continue
        if path.is_file() or path.is_symlink():
            path.unlink()
            removed_markdown += 1

    removed_directories = 0
    for path in sorted(
        (candidate for candidate in vault_path.rglob("*") if candidate.is_dir()),
        key=lambda candidate: len(candidate.parts),
        reverse=True,
    ):
        relative_path = path.relative_to(vault_path)
        if ".git" in relative_path.parts or ".obsidian" in relative_path.parts:
            continue
        if path.is_symlink():
            continue
        try:
            path.rmdir()
        except OSError:
            continue
        removed_directories += 1

    database_paths = (
        settings.db_path,
        Path(f"{settings.db_path}-wal"),
        Path(f"{settings.db_path}-shm"),
    )
    removed_database_files = 0
    for path in database_paths:
        if path.is_file() or path.is_symlink():
            path.unlink()
            removed_database_files += 1

    result: dict[str, object] = {
        "vault_path": str(vault_path),
        "removed_markdown": removed_markdown,
        "removed_directories": removed_directories,
        "db_path": str(settings.db_path),
        "removed_database_files": removed_database_files,
    }
    print(json.dumps(result, ensure_ascii=False))
    return result


app = create_app()


if __name__ == "__main__":
    run()
