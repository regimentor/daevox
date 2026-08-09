from websearch.config import Settings


def test_backend_allowlist_accepts_comma_separated_env_value(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "SEARCH_BACKEND_ALLOWLIST=auto,bing,duckduckgo\n",
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.search_backend_allowlist == ["auto", "bing", "duckduckgo"]
