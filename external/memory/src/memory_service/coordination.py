from __future__ import annotations

import asyncio


class OperationCoordinator:
    """Serialize all operations that can change the derived index or Vault."""

    def __init__(self) -> None:
        self.lock = asyncio.Lock()
