from __future__ import annotations

import asyncio
import hashlib
import logging
import math
from collections.abc import Sequence
from typing import Any, Protocol

logger = logging.getLogger(__name__)


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

            try:
                model = SentenceTransformer(self._model_name, device=self._device)
            except RuntimeError as exc:
                # ``auto`` lets SentenceTransformers pick CUDA when available. If
                # that GPU is full, keep the memory service usable on the CPU.
                # An explicitly selected cuda:N must fail loudly instead.
                if self._device is not None or "out of memory" not in str(exc).lower():
                    raise
                logger.warning(
                    "embedding model did not fit on the automatically selected GPU; "
                    "retrying on CPU model=%s",
                    self._model_name,
                )
                try:
                    import torch

                    torch.cuda.empty_cache()
                except (ImportError, RuntimeError):
                    pass
                model = SentenceTransformer(self._model_name, device="cpu")

            self._model = model
            self.dimension = int(self._model.get_sentence_embedding_dimension())
            self.ready = True

        await asyncio.to_thread(load)
        actual_device = str(getattr(self._model, "device", self._device or "auto"))
        logger.info(
            "embedding provider initialized model=%s device=%s dimension=%s",
            self._model_name,
            actual_device,
            self.dimension,
            extra={
                "model": self._model_name,
                "device": actual_device,
                "dimension": self.dimension,
            },
        )

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
        return method(text, normalize_embeddings=True, show_progress_bar=False).tolist()

    def _encode_documents(self, texts: list[str]) -> list[list[float]]:
        method = getattr(self._model, "encode_document", self._model.encode)
        values = method(texts, normalize_embeddings=True, show_progress_bar=False)
        return values.tolist()
