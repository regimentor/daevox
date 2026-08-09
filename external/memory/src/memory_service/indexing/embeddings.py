from __future__ import annotations

import asyncio
import hashlib
import math
from collections.abc import Sequence
from typing import Any, Protocol


class EmbeddingProvider(Protocol):
    ready: bool
    dimension: int

    async def embed_query(self, text: str) -> list[float]: ...

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]: ...


class FakeEmbeddingProvider:
    ready = True
    dimension = 64

    def _embed(self, text: str) -> list[float]:
        values = [0.0] * self.dimension
        for token in text.casefold().split():
            digest = hashlib.sha256(token.encode()).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            values[index] += 1.0 if digest[4] & 1 else -1.0
        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [value / norm for value in values]

    async def embed_query(self, text: str) -> list[float]:
        return self._embed(text)

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]


class SentenceTransformerProvider:
    def __init__(self, model_name: str, device: str = "auto"):
        self.ready = False
        self.dimension = 0
        self._model_name = model_name
        self._device = None if device == "auto" else device
        self._model: Any = None

    async def initialize(self) -> None:
        def load() -> None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name, device=self._device)
            self.dimension = int(self._model.get_sentence_embedding_dimension())
            self.ready = True

        await asyncio.to_thread(load)

    async def embed_query(self, text: str) -> list[float]:
        if not self.ready or self._model is None:
            raise RuntimeError("embedding provider is not initialized")
        return await asyncio.to_thread(self._encode_query, text)

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not self.ready or self._model is None:
            raise RuntimeError("embedding provider is not initialized")
        return await asyncio.to_thread(self._encode_documents, list(texts))

    def _encode_query(self, text: str) -> list[float]:
        method = getattr(self._model, "encode_query", self._model.encode)
        return method(text, normalize_embeddings=True).tolist()

    def _encode_documents(self, texts: list[str]) -> list[list[float]]:
        method = getattr(self._model, "encode_document", self._model.encode)
        values = method(texts, normalize_embeddings=True)
        return values.tolist()
