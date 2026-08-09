# Local Obsidian Memory Service

Локальный memory backend для AI-агента. Markdown-файлы в Vault совместимы с обычным Obsidian и являются единственным источником истины.

## Setup

```bash
cd external/memory
uv sync
cp .env.example .env
```

При первом запуске Sentence Transformers скачает выбранную модель (`BAAI/bge-m3` по умолчанию). Для быстрых тестов можно использовать `MEMORY_EMBEDDING_PROVIDER=fake`.

## Run

```bash
uv run memory-service serve
# или
uv run uvicorn memory_service.main:app --host 127.0.0.1 --port 8765
```

Документация API доступна на `/docs`, схема — `/openapi.json`.

## Configuration

Основные переменные: `MEMORY_VAULT_PATH`, `MEMORY_DATA_PATH`, `MEMORY_DB_PATH`, `MEMORY_EMBEDDING_MODEL`, `MEMORY_EMBEDDING_DEVICE`, `MEMORY_WATCH_ENABLED`, `MEMORY_GIT_ENABLED`, `MEMORY_GIT_AUTO_COMMIT`, `MEMORY_SEARCH_DEFAULT_LIMIT` и настройки chunker `MEMORY_CHUNK_*`. Полный список находится в `.env.example`.

## Basic API usage

```bash
curl -X POST http://127.0.0.1:8765/v1/notes \
  -H 'content-type: application/json' \
  -d '{"path":"projects/local-agent.md","title":"Local Agent","content":"# Local Agent\n\nPython memory service.","frontmatter":{"type":"project","tags":["agent"]}}'

curl http://127.0.0.1:8765/v1/notes/<NOTE_ID>

curl -X POST http://127.0.0.1:8765/v1/search \
  -H 'content-type: application/json' \
  -d '{"query":"Python memory service","mode":"hybrid","limit":10}'

curl -X POST http://127.0.0.1:8765/v1/git/init
curl -X POST http://127.0.0.1:8765/v1/git/checkpoint \
  -H 'content-type: application/json' \
  -d '{"message":"memory: update local agent"}'
curl http://127.0.0.1:8765/v1/git/history
curl -X POST http://127.0.0.1:8765/v1/notes/<NOTE_ID>/restore \
  -H 'content-type: application/json' -d '{"revision":"<COMMIT>"}'
```

## Obsidian and index recovery

Откройте значение `MEMORY_VAULT_PATH` напрямую в Obsidian. Ручные изменения обнаруживаются watcher-ом.

SQLite index disposable. Если `data/index.sqlite` удалён, восстановите его из Vault:

```bash
uv run memory-service reindex
```

## Git

Git не инициализируется автоматически. Сначала вызовите `/v1/git/init`, затем `/v1/git/checkpoint`. Restore читает исторический файл и создаёт новую текущую working-tree modification; история не переписывается.

## Checks

```bash
uv run ruff check .
uv run mypy src
uv run pytest
```
