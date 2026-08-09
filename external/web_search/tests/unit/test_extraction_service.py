from websearch.services.extraction_service import extract_html, looks_like_js_shell, truncate_text


def test_extracts_docs_structure_and_absolute_links() -> None:
    html = """
    <html><head><title>Docs</title></head><body>
      <nav>Navigation clutter</nav>
      <main><h1>Configuration</h1><p>Use this setting to configure the service.</p>
      <h2>Example</h2><pre><code>def example():\n    return True</code></pre>
      <ul><li>Fast</li><li>Safe</li></ul><a href="../guide">Guide</a></main>
      <footer>Footer</footer>
    </body></html>
    """
    result = extract_html(html, "https://docs.example.com/reference/page")
    assert "# Configuration" in result.markdown
    assert "```" in result.markdown
    assert "return True" in result.markdown
    assert "https://docs.example.com/guide" in result.markdown
    assert result.title == "Docs"


def test_removes_nested_noise_without_invalidating_descendants() -> None:
    html = """
    <html><head><title>Article</title></head><body>
      <nav class="site-navigation"><div><a href="/home">Home</a></div></nav>
      <main><h1>Useful article</h1><p>""" + "Useful content. " * 30 + """</p></main>
    </body></html>
    """

    result = extract_html(html, "https://example.com/article")

    assert "Useful article" in result.markdown
    assert "Home" not in result.markdown


def test_detects_js_shell_and_truncates_at_text_boundary() -> None:
    html = '<html><body><div id="root"></div><script src="app.js"></script></body></html>'
    assert looks_like_js_shell(html, type("Content", (), {"meaningful_chars": 0})())
    content, count, truncated = truncate_text("heading\n\n" + "word " * 100, 30)
    assert truncated is True
    assert count == len(content)
