import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    logger.debug("health check")
    return {"status": "ok"}


@router.get("/ready")
async def ready(request: Request):
    resources = getattr(request.app.state, "resources", None)
    if resources is None or not resources.ready:
        logger.warning("readiness check failed", extra={"event": "readiness_failed"})
        return JSONResponse({"status": "not_ready"}, status_code=503)
    logger.debug("readiness check passed", extra={"event": "readiness_ok"})
    return {"status": "ok"}
