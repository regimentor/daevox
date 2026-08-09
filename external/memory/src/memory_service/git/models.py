from datetime import datetime

from pydantic import BaseModel


class GitCommit(BaseModel):
    commit: str
    timestamp: datetime | None = None
    author: str
    message: str


class GitCheckpoint(BaseModel):
    created: bool
    commit: str | None = None
    message: str | None = None
