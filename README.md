# daevox

Локальный desktop-чат с AI-агентом, долговременной памятью и инструментами веб-поиска.
Интерфейс работает на Electron/React, диалоги хранятся в SQLite, память — в
Obsidian-совместимых Markdown-файлах.

## Оглавление

- [Что запускается](#что-запускается)
- [Требования](#требования)
- [Быстрый запуск](#быстрый-запуск)
- [Конфигурация](#конфигурация)
- [Проверка работающих сервисов](#проверка-работающих-сервисов)
- [Ручной запуск компонентов](#ручной-запуск-компонентов)
- [Сборка и тесты](#сборка-и-тесты)
- [Частые проблемы](#частые-проблемы)
- [Структура репозитория](#структура-репозитория)

## Что запускается

Команда `./daevox` собирает проект и запускает четыре компонента:

| Компонент | Адрес по умолчанию | Назначение |
| --- | --- | --- |
| Memory service | `http://127.0.0.1:8765` | Markdown Vault, поиск по памяти и Git-история |
| Orchestrator | `http://127.0.0.1:8787` | Диалоги, вызов агента и WebSocket-события |
| Web search | `http://127.0.0.1:9000` | Поиск в интернете и извлечение содержимого страниц |
| Desktop | локальное окно Electron | Пользовательский интерфейс |

LLM-сервер не входит в репозиторий и должен быть запущен отдельно. Приложение ожидает
OpenAI-compatible API по адресу `http://localhost:8080/v1`.

## Требования

- Linux с графической сессией для Electron;
- Node.js `22.12+` и npm;
- Python `3.12+`;
- [uv](https://docs.astral.sh/uv/) для Python-окружений;
- Git и `curl`;
- OpenAI-compatible LLM-сервер на `http://localhost:8080/v1`;
- Chromium для browser-режима `web_open`.

GPU не обязателен: memory service может вычислять embeddings на CPU. При первом запуске
Sentence Transformers скачает модель размером около 0,5 ГБ.

## Быстрый запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/regimentor/daevox.git
cd daevox
```

### 2. Установить зависимости

```bash
npm ci

cd external/memory
uv sync

cd ../web_search
uv sync
uv run playwright install chromium

cd ../..
```

Если Playwright сообщает об отсутствующих системных библиотеках, установите их командой:

```bash
cd external/web_search
uv run playwright install --with-deps chromium
cd ../..
```

Команда с `--with-deps` может запросить права администратора.

### 3. Создать конфигурацию

```bash
cp .env.example .env
```

Откройте `.env` и как минимум проверьте следующие значения:

```dotenv
# Имя модели, которое видит ваш OpenAI-compatible сервер
DAEVOX_MODEL=unsloth/GLM-4.7-Flash-GGUF:UD-Q4_K_XL

# Для NVIDIA GPU
MEMORY_EMBEDDING_DEVICE=cuda:0

# Для запуска без CUDA
# MEMORY_EMBEDDING_DEVICE=cpu
```

Если нужна быстрая проверка без загрузки embedding-модели, используйте тестовый provider:

```dotenv
MEMORY_EMBEDDING_PROVIDER=fake
```

В этом режиме semantic search не предназначен для реального использования, но сервис
стартует значительно быстрее.

### 4. Запустить LLM-сервер

Запустите llama.cpp, LM Studio или другой сервер с OpenAI-compatible API на порту `8080`.
Он должен отдавать выбранную в `DAEVOX_MODEL` модель.

Проверка endpoint:

```bash
curl http://127.0.0.1:8080/v1/models
```

Адрес основного LLM endpoint сейчас задан в коде как `http://localhost:8080/v1`.
Переменная `DAEVOX_MEMORY_GROOMER_BASE_URL` меняет endpoint memory groomer, но не основного
агента.

### 5. Запустить daevox

```bash
./daevox
```

Launcher последовательно:

1. собирает TypeScript-пакеты и renderer;
2. применяет миграции SQLite;
3. запускает и проверяет memory service;
4. запускает и проверяет orchestrator;
5. запускает web search;
6. открывает Electron-приложение.

Все логи выводятся в терминал. При закрытии desktop-окна launcher завершает остальные
сервисы. Для остановки из терминала нажмите `Ctrl+C`.

## Конфигурация

Все компоненты используют корневой файл `.env`. Переменные окружения, переданные перед
командой запуска, имеют приоритет над значениями из файла:

```bash
MEMORY_EMBEDDING_DEVICE=cpu ./daevox
```

Основные настройки:

| Переменная | Значение по умолчанию | Назначение |
| --- | --- | --- |
| `DAEVOX_MODEL` | `unsloth/GLM-4.7-Flash-GGUF:UD-Q4_K_XL` | Модель основного агента |
| `DAEVOX_ORCHESTRATOR_HOST` | `127.0.0.1` | Адрес orchestrator |
| `DAEVOX_ORCHESTRATOR_PORT` | `8787` | Порт orchestrator |
| `DAEVOX_MEMORY_GROOMER_BASE_URL` | `http://localhost:8080/v1` | LLM endpoint для обработки памяти |
| `DAEVOX_MEMORY_GROOMER_MODEL` | значение `DAEVOX_MODEL` | Отдельная модель memory groomer |
| `OPENAI_API_KEY` | не задан | API key для memory groomer, если сервер требует авторизацию |
| `MEMORY_HOST` / `MEMORY_PORT` | `127.0.0.1` / `8765` | Адрес memory service |
| `MEMORY_VAULT_PATH` | `<репозиторий>/.vault` | Каталог с Markdown-памятью |
| `MEMORY_EMBEDDING_DEVICE` | в example: `cuda:0` | `cpu`, `auto`, `cuda` или `cuda:N` |
| `MEMORY_EMBEDDING_PROVIDER` | `sentence-transformers` | Реальные embeddings или `fake` для тестов |
| `HOST` / `PORT` | `127.0.0.1` / `9000` | Адрес web search |
| `API_KEY` | не задан | Необязательная защита API web search |

Полный список настроек и лимитов находится в [`.env.example`](./.env.example).

### Локальные данные

| Данные | Путь по умолчанию |
| --- | --- |
| История диалогов | `packages/storage/prisma/dev.db` |
| Markdown Vault | `.vault/` |
| Индекс памяти | `external/memory/data/index.sqlite` |

`.env`, базы, Vault и build-артефакты исключены из Git.

### Сброс истории диалогов

```bash
./daevox --refresh-storage
```

Внимание: команда удаляет `packages/storage/prisma/dev.db`, затем создаёт чистую базу и
повторно применяет миграции. Markdown Vault и индекс memory service она не удаляет.

### Сброс памяти

```bash
./daevox --refresh-memory
```

Команда без подтверждения удаляет все Markdown-файлы из настроенного `MEMORY_VAULT_PATH`,
кроме файлов внутри `.git` и `.obsidian`, а также SQLite-индекс памяти и его временные
файлы `-wal`/`-shm`. Пустые директории удаляются, а директории с немаркированными файлами
сохраняются. Git-история и немаркированные файлы сохраняются. После очистки launcher
создаёт пустой индекс и запускает приложение с чистой памятью.

Флаги можно использовать вместе:

```bash
./daevox --refresh-storage --refresh-memory
```

## Проверка работающих сервисов

Во время работы приложения можно проверить health endpoints:

```bash
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:9000/health
```

Документация memory API доступна на
[`http://127.0.0.1:8765/docs`](http://127.0.0.1:8765/docs), а web-search API — на
[`http://127.0.0.1:9000/docs`](http://127.0.0.1:9000/docs).

## Ручной запуск компонентов

Этот режим удобен для отладки. Сначала установите зависимости, создайте `.env`, запустите
LLM-сервер и выполните сборку с миграциями:

```bash
npm run build
npm --workspace @daevox/storage run migrate
```

Затем откройте отдельный терминал для каждого процесса.

### Терминал 1 — memory service

```bash
cd external/memory
uv run memory-service serve
```

### Терминал 2 — web search

```bash
cd external/web_search
uv run websearch
```

Оба Python-сервиса самостоятельно читают корневой `.env`.

### Терминал 3 — orchestrator

```bash
set -a
. ./.env
set +a

export MEMORY_SERVICE_URL="http://${MEMORY_HOST:-127.0.0.1}:${MEMORY_PORT:-8765}"
export WEB_SEARCH_HOST="${WEB_SEARCH_HOST:-${HOST:-127.0.0.1}}"
export WEB_SEARCH_PORT="${WEB_SEARCH_PORT:-${PORT:-9000}}"
export WEB_SEARCH_API_KEY="${WEB_SEARCH_API_KEY:-${API_KEY:-}}"

node packages/orchestrator/dist/main.js
```

Команды выполняются из корня репозитория. Значения в `.env` должны быть совместимы с
обычными shell-присваиваниями.

### Терминал 4 — desktop

```bash
set -a
. ./.env
set +a

npm --workspace @daevox/desktop run start
```

## Сборка и тесты

Собрать все TypeScript-пакеты:

```bash
npm run build
```

Запустить тесты во всех npm-workspaces, где объявлен test script:

```bash
npm test --workspaces --if-present
```

Проверить memory service:

```bash
cd external/memory
uv run ruff check .
uv run mypy src
uv run pytest
```

Проверить web search:

```bash
cd external/web_search
uv run ruff check src tests
uv run ruff format --check src tests
uv run mypy src
uv run pytest -q
```

Запустить Storybook для UI:

```bash
npm --workspace @daevox/ui run storybook
```

После запуска Storybook доступен на `http://localhost:6006`.

## Частые проблемы

### `daevox: npm is required` или `daevox: uv is required`

Установите отсутствующий инструмент и проверьте, что он доступен в `PATH`:

```bash
node --version
npm --version
uv --version
```

### Memory service не успевает запуститься

При первом старте загрузка embedding-модели может занять больше минуты. Предварительно
запустите сервис вручную, дождитесь полной загрузки, остановите его и снова выполните
`./daevox`:

```bash
cd external/memory
uv run memory-service serve
```

Для smoke test можно временно установить `MEMORY_EMBEDDING_PROVIDER=fake`.

### Ошибка CUDA или недостаточно видеопамяти

Установите в `.env`:

```dotenv
MEMORY_EMBEDDING_DEVICE=cpu
```

Значение `auto` автоматически выбирает устройство и может откатиться на CPU. При явно
заданном `cuda:N` ошибка выбранной карты не скрывается.

### `browser_error` в web search

Установите Chromium:

```bash
cd external/web_search
uv run playwright install chromium
```

Если браузерный fallback не нужен, его можно отключить через `BROWSER_ENABLED=false`.

### Агент не отвечает или получает `ECONNREFUSED`

Проверьте LLM endpoint и имя модели:

```bash
curl http://127.0.0.1:8080/v1/models
```

`DAEVOX_MODEL` должен совпадать с идентификатором, который принимает сервер. Сервер с
обязательной авторизацией также должен принимать ключ, используемый локальным клиентом;
по умолчанию проект рассчитан на локальный endpoint без проверки ключа.

### Порт уже занят

Измените соответствующий порт в `.env`. Для web search используются `PORT`, для memory —
`MEMORY_PORT`, для orchestrator — `DAEVOX_ORCHESTRATOR_PORT`.

## Структура репозитория

```text
packages/
  agent/             LLM-агент и tools
  contracts/         общие API-типы и схемы
  desktop/           Electron main/preload и renderer build
  domain/            system prompt и completion flow
  external-clients/  клиенты memory/web-search сервисов
  memory-groomer/    обновление долговременной памяти
  orchestrator/      NestJS HTTP/WebSocket backend
  shared/            общие утилиты
  storage/           Prisma и SQLite-репозитории
  ui/                React-интерфейс
external/
  memory/            Python memory service
  web_search/        Python web-search/web-open service
```

Подробности по отдельным Python-сервисам:

- [Memory service](./external/memory/README.md)
- [Web search service](./external/web_search/README.md)
