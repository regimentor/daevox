import os

import pytest

from websearch.config import Settings
from websearch.security.url_validator import URLValidationResult
from websearch.services.browser_service import BrowserService

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_BROWSER_TESTS") != "1", reason="opt-in Playwright integration test"
)


class TestOnlyValidator:
    async def validate(self, url: str) -> URLValidationResult:
        from urllib.parse import urlsplit

        parsed = urlsplit(url)
        return URLValidationResult(
            url, url, parsed.hostname or "localhost", parsed.fragment or None
        )


async def test_browser_renders_javascript_page() -> None:
    # Test-only allowlist is deliberately not used by production app configuration.
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from threading import Thread

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            body = (
                b"<html><body><div id='root'></div><script>"
                b"document.getElementById('root').textContent='Rendered content'"
                b"</script></body></html>"
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    settings = Settings(browser_stabilization_timeout=100)
    browser = BrowserService(settings, TestOnlyValidator())
    await browser.start()
    try:
        result = await browser.fetch(f"http://127.0.0.1:{server.server_port}/")
        assert "Rendered content" in result.html
    finally:
        await browser.stop()
        server.shutdown()
