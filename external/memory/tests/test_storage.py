from pathlib import Path

import pytest

from memory_service.domain.errors import ServiceError
from memory_service.indexing.chunker import _split_unit, chunk_note, estimate_tokens
from memory_service.storage.markdown import parse_markdown
from memory_service.storage.paths import VaultPaths


def test_parser_extracts_frontmatter_headings_tags_and_links():
    raw = """---
id: note-1
tags: [Agents]
---

# Root
## Details
Text #development [[Memory Service|memory]] [[Other#Heading]].

```python
# not-a-tag
[[not-a-link]]
```
"""
    parsed = parse_markdown(raw, "projects/note.md")
    assert parsed.note_id == "note-1"
    assert parsed.title == "Root"
    assert parsed.tags == {"agents", "development"}
    assert [link.target_text for link in parsed.links] == ["Memory Service", "Other"]
    assert parsed.links[1].target_heading == "Heading"
    assert parsed.headings[1][1] == "Details"


def test_chunker_is_deterministic_and_preserves_heading_context():
    parsed = parse_markdown("# Root\n\n## Memory\n\n" + "word " * 100)
    first = chunk_note(parsed, target=20, maximum=30, overlap=3)
    second = chunk_note(parsed, target=20, maximum=30, overlap=3)
    assert [(item.position, item.content_hash) for item in first] == [
        (item.position, item.content_hash) for item in second
    ]
    assert first[0].heading_path == ["Root", "Memory"]


def test_chunker_splits_long_text_and_keeps_code_line_boundaries():
    parsed = parse_markdown(
        "# Root\n\n## Details\n\n"
        + "paragraph word " * 80
        + "\n\n- item one\n- item two\n\n"
        + "```python\n"
        + "\n".join(f"value_{index} = {index}" for index in range(30))
        + "\n```\n"
    )
    chunks = chunk_note(parsed, target=20, maximum=30, overlap=2)
    assert len(chunks) > 2
    assert all(estimate_tokens(chunk.content) <= 30 for chunk in chunks)
    assert all(chunk.heading_path == ["Root", "Details"] for chunk in chunks)

    code = "```python\n" + "\n".join(f"line_{index}" for index in range(20)) + "\n```"
    units = _split_unit(code, 8)
    assert len(units) > 1
    source_lines = code.splitlines()
    assert [line for unit in units for line in unit.splitlines()] == source_lines


def test_path_traversal_is_rejected(tmp_path: Path):
    paths = VaultPaths(tmp_path / "vault")
    with pytest.raises(ServiceError):
        paths.absolute("../../etc/passwd.md")
    with pytest.raises(ServiceError):
        paths.absolute("/tmp/outside.md")
