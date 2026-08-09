from pathlib import Path

import pytest

from memory_service.app import create_app
from memory_service.config import Settings


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    return Settings(
        vault_path=tmp_path / "vault",
        data_path=tmp_path / "data",
        db_path=tmp_path / "data" / "index.sqlite",
        embedding_provider="fake",
        watch_enabled=False,
        git_enabled=True,
    ).resolve_paths()


@pytest.fixture
def app(test_settings: Settings):
    return create_app(test_settings)
