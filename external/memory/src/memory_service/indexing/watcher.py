from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from watchfiles import Change, awatch

logger = logging.getLogger(__name__)


class VaultWatcher:
    def __init__(self, root: Path, service, debounce_ms: int):
        self.root = root
        self.service = service
        self.debounce_ms = debounce_ms
        self.stop_event = asyncio.Event()

    async def run(self) -> None:
        async for changes in awatch(
            self.root,
            debounce=self.debounce_ms,
            stop_event=self.stop_event,
            watch_filter=self._filter,
        ):
            if self.stop_event.is_set():
                break
            for change, filename in changes:
                path = Path(filename)
                try:
                    if change in {Change.added, Change.modified} and path.suffix.lower() == ".md":
                        await self.service.reconcile_path(path)
                    elif change == Change.deleted and path.suffix.lower() == ".md":
                        await self.service.reconcile_deleted(path)
                except Exception:
                    logger.exception("vault watcher failed", extra={"path": str(path)})

    @staticmethod
    def _filter(change: Change, path: str) -> bool:
        candidate = Path(path)
        return (
            candidate.suffix.lower() == ".md"
            and ".git" not in candidate.parts
            and ".obsidian" not in candidate.parts
            and not candidate.name.startswith(".")
        )

    def stop(self) -> None:
        self.stop_event.set()
