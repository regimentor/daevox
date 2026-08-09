from __future__ import annotations

import logging

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from websearch.api.health import router as health_router
from websearch.api.open import router as open_router
from websearch.api.search import router as search_router
from websearch.config import Settings
from websearch.lifespan import lifespan
from websearch.middleware.request_id import (
    APIKeyMiddleware,
    RequestIDMiddleware,
    StructuredFormatter,
)
from websearch.models.errors import ServiceError


def _configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    if not root.handlers:
        root.addHandler(handler)
    root.setLevel(logging.INFO)
    logging.getLogger("websearch").setLevel(logging.INFO)
    for noisy_logger in ("ddgs", "primp", "httpx"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


def create_app() -> FastAPI:
    _configure_logging()
    app = FastAPI(title="Local AI Web Search Service", version="0.1.0", lifespan=lifespan)
    settings = Settings()
    app.add_middleware(APIKeyMiddleware, settings=settings)
    app.add_middleware(RequestIDMiddleware)

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        logging.getLogger("websearch.service").warning(
            "service error",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "endpoint": request.url.path,
                "error_code": exc.code,
                "error_type": type(exc).__name__,
                "status": exc.status_code,
                "reason": exc.message,
            },
        )
        return JSONResponse(
            {"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        logging.getLogger("websearch.validation").warning(
            "request validation failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "endpoint": request.url.path,
                "error_code": "invalid_request",
                "reason": f"{len(exc.errors())}_validation_errors",
            },
        )
        return JSONResponse(
            {"error": {"code": "invalid_request", "message": "Request validation failed"}},
            status_code=422,
        )

    app.include_router(health_router)
    app.include_router(search_router)
    app.include_router(open_router)
    return app


app = create_app()


def run() -> None:
    settings = Settings()
    uvicorn.run("websearch.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
