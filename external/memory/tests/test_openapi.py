from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from memory_service.app import create_app
from memory_service.config import Settings


def test_checked_in_openapi_contract_matches_runtime_schema():
    contract_path = Path(__file__).parents[1] / "openapi.yaml"
    with contract_path.open(encoding="utf-8") as contract_file:
        checked_in = yaml.safe_load(contract_file)

    assert checked_in == create_app().openapi()


def test_startup_generates_openapi_contract(tmp_path: Path):
    output_path = tmp_path / "generated" / "openapi.yaml"
    settings = Settings(
        vault_path=tmp_path / "vault",
        data_path=tmp_path / "data",
        db_path=tmp_path / "data" / "index.sqlite",
        openapi_path=output_path,
        embedding_provider="fake",
        watch_enabled=False,
    ).resolve_paths()

    with TestClient(create_app(settings)):
        pass

    with output_path.open(encoding="utf-8") as contract_file:
        generated = yaml.safe_load(contract_file)

    assert generated == create_app(settings).openapi()
