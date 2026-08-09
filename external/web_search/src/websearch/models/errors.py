from typing import Any

from pydantic import BaseModel, ConfigDict


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502, *, details: Any = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class ModelConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
