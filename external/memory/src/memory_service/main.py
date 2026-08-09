from __future__ import annotations

import argparse
import logging

import uvicorn

from memory_service.app import create_app
from memory_service.config import Settings


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def run() -> None:
    _configure_logging()
    parser = argparse.ArgumentParser(prog="memory-service")
    parser.add_argument(
        "command", nargs="?", choices=["serve", "reindex", "git-status"], default="serve"
    )
    args = parser.parse_args()
    settings = Settings().resolve_paths()
    if args.command == "serve":
        uvicorn.run("memory_service.main:app", host=settings.host, port=settings.port, reload=False)
        return
    import asyncio

    if args.command == "reindex":
        asyncio.run(_run_reindex(settings))
    else:
        asyncio.run(_run_git_status(settings))


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


app = create_app()


if __name__ == "__main__":
    run()
