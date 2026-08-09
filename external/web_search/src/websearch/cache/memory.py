import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")


@dataclass(slots=True)
class _Entry[T]:
    value: T
    expires_at: float


class MemoryTTLCache[T]:
    """Small bounded cache abstraction; replaceable by a distributed cache later."""

    def __init__(self, max_items: int):
        self.max_items = max_items
        self._items: OrderedDict[str, _Entry[T]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        async with self._lock:
            entry = self._items.get(key)
            if entry is None:
                return None
            if entry.expires_at <= time.monotonic():
                self._items.pop(key, None)
                return None
            self._items.move_to_end(key)
            return entry.value

    async def set(self, key: str, value: T, ttl: float) -> None:
        if ttl <= 0:
            return
        async with self._lock:
            self._items[key] = _Entry(value=value, expires_at=time.monotonic() + ttl)
            self._items.move_to_end(key)
            while len(self._items) > self.max_items:
                self._items.popitem(last=False)

    async def clear(self) -> None:
        async with self._lock:
            self._items.clear()
