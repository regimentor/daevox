import re
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_file_encoding="utf-8",
        env_prefix="MEMORY_",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)
    vault_path: Path = Path("./vault")
    data_path: Path = Path("./data")
    db_path: Path = Path("./data/index.sqlite")
    openapi_path: Path = Path(__file__).resolve().parents[2] / "openapi.yaml"
    # Multilingual MiniLM is suitable for Russian and is well below 1 GiB.
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_device: str = "auto"
    embedding_provider: str = "sentence-transformers"
    watch_enabled: bool = True
    watch_debounce_ms: int = Field(default=400, ge=100, le=5000)
    git_enabled: bool = True
    git_auto_commit: bool = False
    git_author_name: str | None = None
    git_author_email: str | None = None
    search_default_limit: int = Field(default=10, ge=1, le=100)
    keyword_candidates: int = Field(default=30, ge=1, le=500)
    semantic_candidates: int = Field(default=30, ge=1, le=500)
    rrf_k: int = Field(default=60, ge=1)
    chunk_target_tokens: int = Field(default=600, ge=1)
    chunk_max_tokens: int = Field(default=1000, ge=1)
    chunk_overlap_tokens: int = Field(default=80, ge=0)

    @field_validator("embedding_provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        if value not in {"sentence-transformers", "fake"}:
            raise ValueError("embedding_provider must be sentence-transformers or fake")
        return value

    @field_validator("embedding_device", mode="before")
    @classmethod
    def validate_embedding_device(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("embedding_device must be auto, cpu, cuda, or cuda:N")

        device = value.strip().lower()
        if device == "auto" or device == "cpu" or re.fullmatch(r"cuda(?::[0-9]+)?", device):
            return device
        raise ValueError("embedding_device must be auto, cpu, cuda, or cuda:N")

    def resolve_paths(self, base_dir: Path | None = None) -> "Settings":
        base = (base_dir or Path.cwd()).resolve()
        values = self.model_dump()
        for key in ("vault_path", "data_path", "db_path", "openapi_path"):
            path = Path(values[key])
            values[key] = path if path.is_absolute() else (base / path).resolve()
        return type(self).model_validate(values)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings().resolve_paths()
