from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
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
