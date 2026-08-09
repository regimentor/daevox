from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from memory_service.config import Settings
from memory_service.database.connection import Database
from memory_service.domain.errors import ServiceError
from memory_service.git.repository import GitRepository
from memory_service.indexing.embeddings import (
    EmbeddingProvider,
    FakeEmbeddingProvider,
    SentenceTransformerProvider,
)
from memory_service.indexing.indexer import Indexer
from memory_service.indexing.watcher import VaultWatcher
from memory_service.services import MemoryService
from memory_service.storage.markdown import MarkdownStorage
from memory_service.storage.paths import VaultPaths

logger = logging.getLogger(__name__)


class Resources:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.paths = VaultPaths(settings.vault_path)
        self.storage = MarkdownStorage(self.paths)
        self.database = Database(settings.db_path)
        if settings.embedding_provider == "fake":
            self.provider: EmbeddingProvider = FakeEmbeddingProvider()
        else:
            self.provider = SentenceTransformerProvider(
                settings.embedding_model, settings.embedding_device
            )
        self.database.initialize(getattr(self.provider, "dimension", 0) or None)
        self.indexer = Indexer(self.database, self.paths, self.provider, settings)
        self.memory = MemoryService(settings, self.storage, self.indexer)
        self.git = GitRepository(self.paths.root, settings)
        self.watcher: VaultWatcher | None = None
        self.watcher_task = None
        self.embedding_error: str | None = None

    @property
    def ready(self) -> bool:
        return self.paths.root.is_dir() and self.embedding_error is None and self.provider.ready


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = (settings or Settings()).resolve_paths()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        resources = Resources(settings)
        app.state.resources = resources
        try:
            if hasattr(resources.provider, "initialize"):
                try:
                    await resources.provider.initialize()
                    resources.database.initialize(resources.provider.dimension)
                except Exception as exc:
                    resources.embedding_error = str(exc)
                    logger.exception("embedding provider initialization failed")
            await resources.indexer.reconcile()
            if settings.watch_enabled:
                resources.watcher = VaultWatcher(
                    resources.paths.root, resources.memory, settings.watch_debounce_ms
                )
                resources.watcher_task = __import__("asyncio").create_task(resources.watcher.run())
            yield
        finally:
            if resources.watcher:
                resources.watcher.stop()
            if resources.watcher_task:
                resources.watcher_task.cancel()

    app = FastAPI(title="Local Obsidian Memory Service", version="0.1.0", lifespan=lifespan)

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        logger.warning("service error", extra={"operation": request.url.path, "code": exc.code})
        return JSONResponse(
            {"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            {"error": {"code": "invalid_request", "message": "Request validation failed"}},
            status_code=422,
        )

    from memory_service.api.admin import router as admin_router
    from memory_service.api.git import router as git_router
    from memory_service.api.health import router as health_router
    from memory_service.api.notes import router as notes_router
    from memory_service.api.search import router as search_router

    app.include_router(health_router)
    app.include_router(notes_router)
    app.include_router(search_router)
    app.include_router(git_router)
    app.include_router(admin_router)
    return app
