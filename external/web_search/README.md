# Local AI Web Search Service

Отдельный deterministic Python backend для Node.js AI-агента. Сервис предоставляет два независимых инструмента:

```text
web_search → DDGS → нормализованные результаты
web_open   → URL validation → httpx → extraction → Markdown
                                      ↘ Playwright fallback
```

Сервис сам не использует LLM, не является crawler'ом и не открывает автоматически все ссылки из результата поиска.

## Требования и установка

- Python 3.12+;
- [uv](https://docs.astral.sh/uv/);
- Chromium для Playwright.

```bash
cd /path/to/daevox
cp .env.example .env
cd external/web_search
uv sync
uv run playwright install chromium
```

Все настройки запуска хранятся в корневом `.env`; отдельный `.env` внутри
сервиса не нужен.

`pyproject.toml` содержит runtime-зависимости, `uv.lock` фиксирует разрешённое окружение, а dev-зависимости находятся в отдельной группе `dev`.

## Запуск

По умолчанию сервис слушает только loopback:

```bash
uv run websearch
```

Проверки:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/ready
```

`/health` проверяет процесс. `/ready` требует инициализированный `httpx` client, DDGS provider и работающий Chromium. Если Chromium не установлен, HTTP search/open всё ещё могут быть доступны, но `/ready` вернёт 503 и browser render сообщит `browser_error`.

## API

### Search

```bash
curl -X POST http://127.0.0.1:8080/v1/web_search \
  -H 'Content-Type: application/json' \
  -d '{"query":"FastAPI lifespan documentation","max_results":5}'
```

`backend` проверяется через allowlist `SEARCH_BACKEND_ALLOWLIST`, а DDGS вызывается в worker thread под semaphore. Search cache имеет TTL 60 секунд по умолчанию.

### Open

Статическая или техническая страница:

```bash
curl -X POST http://127.0.0.1:8080/v1/web_open \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://fastapi.tiangolo.com/advanced/events/","render":"auto"}'
```

Принудительный browser render:

```bash
curl -X POST http://127.0.0.1:8080/v1/web_open \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","render":"browser"}'
```

Поддерживаются HTML/XHTML, plain text, Markdown, JSON и PDF. HTML очищается от технического шума, извлекается через semantic roots и Trafilatura fallback, затем преобразуется в Markdown с headings, lists, links, tables и code blocks. Относительные HTTP(S)-ссылки становятся абсолютными относительно `final_url`.

`render=auto` начинает с HTTP. Browser fallback включается для пустого/неизвлекаемого контента и явного SPA shell. `render=http` запрещает Playwright, а `render=browser` сразу использует shared Chromium. Для каждого запроса создаётся новый non-persistent BrowserContext; cookies, localStorage и auth state не переносятся.

Ошибки имеют единый формат:

```json
{"error":{"code":"blocked_url","message":"URL is blocked by SSRF policy"}}
```

Основные HTTP mappings: 400 invalid URL/redirects, 401 missing API key, 403 SSRF block, 408 timeout, 413 size limit, 415 unsupported type, 422 validation/PDF without text, 502 upstream failure, 503 unavailable browser.

## Конфигурация

Приложение читает корневой `.env` и работает без него с безопасными defaults. Все лимиты — настройки `pydantic-settings`; важные значения:

| Переменная | Default | Назначение |
| --- | ---: | --- |
| `HOST` | `127.0.0.1` | bind address |
| `SEARCH_MAX_CONCURRENCY` | `4` | параллельные DDGS calls |
| `HTTP_MAX_RESPONSE_BYTES` | `5242880` | HTML/текст/JSON limit |
| `PDF_MAX_BYTES` | `15728640` | PDF limit |
| `MAX_REDIRECTS` | `5` | ручные redirect hops |
| `BROWSER_MAX_CONCURRENCY` | `2` | одновременно занятые contexts |
| `OPEN_HARD_MAX_CHARS` | `200000` | server-side output ceiling |
| `API_KEY` | unset | optional `Authorization: Bearer ...` |

Если `API_KEY` задан, `/v1/*` требует bearer authentication. Arbitrary headers, cookies, Authorization для target сайтов и JavaScript из запроса API не поддерживаются.

### Логирование

Сервис пишет структурированные JSON-события в stdout на уровне `INFO`. В логах есть `request_id`, длительности, статусы, cache hit/miss, redirect hops, размеры ответов, причины fallback и коды ошибок. Поисковый текст логируется только как длина и короткий SHA-256 digest; URL записывается без query-параметров и fragment, содержимое страниц не логируется.

## Security model

`web_open` принимает недоверенный URL от LLM. Перед каждым HTTP request и каждым redirect выполняются:

- только `http`/`https`;
- запрет URL credentials;
- DNS resolution непосредственно перед запросом;
- проверка всех IPv4/IPv6 результатов через `ipaddress`;
- блокировка loopback, private, link-local, multicast, unspecified, reserved и cloud metadata ranges;
- fragment удаляется из network request и сохраняется в `meta.requested_fragment`.

Playwright ставит `browser_context.route("**/*", ...)`: document, iframe, redirect, script, fetch, XHR и popup requests проходят ту же проверку. Images/video/audio/fonts блокируются как лишние для чтения. Сетевое соединение httpx/Chromium всё равно выполняет собственный DNS lookup после проверки, поэтому это defense-in-depth, а не абсолютная защита от DNS rebinding или IP pinning.

Web content возвращается как данные. Consuming AI agent должен считать его untrusted data, а не system/developer instructions. Сервис не выполняет prompt injection из страниц.

## Рекомендуемые tool schemas

```json
{
  "name": "web_search",
  "description": "Search the public web for current or external information. Returns search results with titles, URLs and snippets. Use web_open to read selected results.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"},
      "max_results": {"type": "integer", "minimum": 1, "maximum": 20}
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

```json
{
  "name": "web_open",
  "description": "Open a public HTTP/HTTPS URL and return its readable content as Markdown. Use browser rendering when JavaScript execution is required.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {"type": "string"},
      "render": {"type": "string", "enum": ["auto", "http", "browser"]},
      "max_chars": {"type": "integer", "minimum": 1000, "maximum": 200000}
    },
    "required": ["url"],
    "additionalProperties": false
  }
}
```

Обычный workflow: `web_search` → LLM выбирает 2–5 релевантных URL → `web_open` только выбранных страниц → synthesis. Не открывайте автоматически все 20 результатов.

## Node.js / TypeScript integration

```ts
interface WebSearchRequest {
  query: string;
  max_results?: number;
  region?: string;
  timelimit?: "d" | "w" | "m" | "y";
}

interface SearchResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export async function webSearch(input: WebSearchRequest): Promise<SearchResult[]> {
  const response = await fetch("http://127.0.0.1:8080/v1/web_search", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`web_search failed: ${response.status}`);
  return (await response.json()).results;
}

export async function webOpen(input: {
  url: string;
  render?: "auto" | "http" | "browser";
  max_chars?: number;
}) {
  const response = await fetch("http://127.0.0.1:8080/v1/web_open", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`web_open failed: ${response.status}`);
  return response.json();
}
```

## Проверки проекта

```bash
uv run pytest -q
uv run ruff check src tests
uv run ruff format --check src tests
```

Playwright integration test намеренно opt-in и использует test-only validator для loopback:

```bash
RUN_BROWSER_TESTS=1 uv run pytest tests/integration -q
```

External internet tests в проекте отсутствуют по умолчанию: DDGS rate limits не должны ломать локальный/CI test suite. Для troubleshooting можно отдельно выполнить curl acceptance tests выше.

## Ограничения

Это не crawler и не browser automation API: нет рекурсивного обхода, кликов, форм, screenshots, cookies/auth persistence, CAPTCHA/Cloudflare bypass, stealth, OCR, image/audio/video extraction, arbitrary JS execution, paid search API, Redis/database или LLM summarization. Robots.txt crawler subsystem не реализован; при добавлении recursive crawling это будет отдельной обязательной policy-задачей.
