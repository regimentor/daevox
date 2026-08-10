"""HTTP API routers and shared OpenAPI response definitions."""

from typing import Any

from memory_service.domain.schemas import ErrorResponse

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorResponse, "description": "Invalid request or Git revision."},
    404: {
        "model": ErrorResponse,
        "description": "Requested note, revision or file was not found.",
    },
    409: {
        "model": ErrorResponse,
        "description": "Operation conflicts with the current Vault or Git state.",
    },
    422: {"model": ErrorResponse, "description": "Request validation failed."},
    500: {"model": ErrorResponse, "description": "Unexpected database or service error."},
    503: {"model": ErrorResponse, "description": "A required service dependency is unavailable."},
}
