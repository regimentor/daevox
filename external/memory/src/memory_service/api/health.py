from fastapi import APIRouter, Request

from memory_service.domain.schemas import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness check",
    description="Returns successfully when the HTTP service process is running.",
)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/ready",
    response_model=ReadyResponse,
    summary="Readiness check",
    description="Reports whether the Vault, SQLite index and embedding provider are ready.",
)
async def ready(request: Request) -> dict[str, object]:
    resources = request.app.state.resources
    return {
        "ready": resources.ready,
        "vault": resources.paths.root.is_dir(),
        "sqlite": resources.database.path.exists(),
        "embeddings": resources.provider.ready,
        "embedding_error": resources.embedding_error,
        "git_initialized": resources.git.initialized if resources.settings.git_enabled else None,
    }
