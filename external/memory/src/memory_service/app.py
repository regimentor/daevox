from __future__ import annotations

import logging
import sqlite3
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from memory_service.config import Settings
from memory_service.coordination import OperationCoordinator
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

OPENAPI_HEADER = (
    "# Generated from memory_service.app.create_app().openapi().\n"
    "# Keep this contract in sync with the runtime schema exposed at /openapi.json.\n"
)


def generate_openapi_documentation(app: FastAPI, output_path: Path) -> None:
    """Write the runtime OpenAPI schema to a YAML contract atomically."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = OPENAPI_HEADER + yaml.safe_dump(
        app.openapi(), sort_keys=False, allow_unicode=True
    )
    if not content.endswith("\n\n"):
        content += "\n"

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(content)
        temporary_path.replace(output_path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


class Resources:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.paths = VaultPaths(settings.vault_path)
        self.storage = MarkdownStorage(self.paths)
        self.database = Database(settings.db_path)
        self.coordinator = OperationCoordinator()
        if settings.embedding_provider == "fake":
            self.provider: EmbeddingProvider = FakeEmbeddingProvider()
        else:
            self.provider = SentenceTransformerProvider(
                settings.embedding_model, settings.embedding_device
            )
        self.database.initialize(getattr(self.provider, "dimension", 0) or None)
        self.indexer = Indexer(
            self.database, self.paths, self.provider, settings, self.coordinator
        )
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
        try:
            generate_openapi_documentation(app, settings.openapi_path)
            logger.info("OpenAPI documentation generated at %s", settings.openapi_path)
        except OSError:
            logger.exception("failed to generate OpenAPI documentation")

        resources = Resources(settings)
        app.state.resources = resources
        logger.info(
            "memory service starting vault=%s db=%s embedding_provider=%s "
            "watch_enabled=%s git_enabled=%s",
            settings.vault_path,
            settings.db_path,
            settings.embedding_provider,
            settings.watch_enabled,
            settings.git_enabled,
            extra={
                "vault_path": str(settings.vault_path),
                "db_path": str(settings.db_path),
                "embedding_provider": settings.embedding_provider,
                "watch_enabled": settings.watch_enabled,
                "git_enabled": settings.git_enabled,
            },
        )
        try:
            if hasattr(resources.provider, "initialize"):
                try:
                    await resources.provider.initialize()
                    resources.database.initialize(resources.provider.dimension)
                except Exception as exc:
                    resources.embedding_error = str(exc)
                    logger.exception("embedding provider initialization failed")
            await resources.indexer.reconcile()
            logger.info(
                "memory service ready ready=%s vector_available=%s",
                resources.ready,
                resources.database.vector_available,
                extra={
                    "ready": resources.ready,
                    "vector_available": resources.database.vector_available,
                },
            )
            if settings.watch_enabled:
                resources.watcher = VaultWatcher(
                    resources.paths.root, resources.memory, settings.watch_debounce_ms
                )
                resources.watcher_task = __import__("asyncio").create_task(resources.watcher.run())
            yield
        finally:
            logger.info("memory service stopping")
            if resources.watcher:
                resources.watcher.stop()
            if resources.watcher_task:
                resources.watcher_task.cancel()

    app = FastAPI(
        title="Local Obsidian Memory Service",
        summary="Local Obsidian-compatible Markdown memory backend for AI agents.",
        description=(
            "The configured Markdown Vault is the source of truth. SQLite stores disposable "
            "search indexes, while optional Git endpoints provide explicit Vault versioning."
        ),
        version="0.1.0",
        openapi_tags=[
            {"name": "health", "description": "Liveness and readiness probes."},
            {"name": "notes", "description": "Markdown note CRUD and Git revision operations."},
            {"name": "search", "description": "Keyword, semantic and hybrid retrieval."},
            {"name": "admin", "description": "Maintenance operations for derived indexes."},
            {"name": "git", "description": "Explicit Git operations for the Markdown Vault."},
        ],
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            logger.debug(
                "http request %s %s status=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                status_code,
                (time.perf_counter() - started) * 1000,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        logger.warning(
            "service error path=%s code=%s",
            request.url.path,
            exc.code,
            extra={"operation": request.url.path, "code": exc.code},
        )
        return JSONResponse(
            {"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        logger.warning(
            "request validation failed path=%s error_count=%s",
            request.url.path,
            len(exc.errors()),
            extra={"operation": request.url.path, "error_count": len(exc.errors())},
        )
        return JSONResponse(
            {"error": {"code": "invalid_request", "message": "Request validation failed"}},
            status_code=422,
        )

    @app.exception_handler(sqlite3.Error)
    async def sqlite_error_handler(request: Request, exc: sqlite3.Error) -> JSONResponse:
        logger.exception(
            "unexpected SQLite error path=%s",
            request.url.path,
            extra={"operation": request.url.path},
        )
        return JSONResponse(
            {"error": {"code": "database_error", "message": "Database operation failed"}},
            status_code=500,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unexpected service error path=%s",
            request.url.path,
            extra={"operation": request.url.path},
        )
        return JSONResponse(
            {"error": {"code": "internal_error", "message": "Internal server error"}},
            status_code=500,
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
