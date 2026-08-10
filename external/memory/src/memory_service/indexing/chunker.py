from __future__ import annotations

import hashlib
import re

from memory_service.domain.models import Chunk, ParsedNote


def estimate_tokens(text: str) -> int:
    return max(1, len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE)))


def _split_unit(text: str, maximum: int) -> list[str]:
    if maximum < 1:
        raise ValueError("maximum must be positive")
    if not text.strip():
        return []

    # Code is kept line-oriented. A source line can itself be larger than the
    # configured limit, but it is never cut in the middle of a line.
    if "```" in text or "~~~" in text:
        units: list[str] = []
        code_lines: list[str] = []
        for line in text.splitlines():
            candidate = "\n".join([*code_lines, line])
            if code_lines and estimate_tokens(candidate) > maximum:
                units.append("\n".join(code_lines))
                code_lines = []
            code_lines.append(line)
        if code_lines:
            units.append("\n".join(code_lines))
        return units

    words = text.split()
    result: list[str] = []
    words_current: list[str] = []
    for word in words:
        candidate = " ".join([*words_current, word])
        if words_current and estimate_tokens(candidate) > maximum:
            result.append(" ".join(words_current))
            words_current = []
        words_current.append(word)
    if words_current:
        result.append(" ".join(words_current))
    return result


def chunk_note(
    note: ParsedNote, target: int = 600, maximum: int = 1000, overlap: int = 80
) -> list[Chunk]:
    lines = note.body.splitlines()
    sections: list[tuple[list[str], str]] = []
    heading_stack: list[str] = []
    buffer: list[str] = []
    fence: str | None = None

    def flush() -> None:
        nonlocal buffer
        text = "\n".join(buffer).strip()
        if text:
            sections.append((heading_stack.copy(), text))
        buffer = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            buffer.append(line)
            fence = None if fence == marker else marker if fence is None else fence
            continue
        if fence is None and re.match(r"^#{1,6}\s+\S", stripped):
            flush()
            level = len(stripped) - len(stripped.lstrip("#"))
            heading = stripped[level:].strip()
            heading_stack = heading_stack[: level - 1]
            heading_stack.append(heading)
            continue
        if not line.strip() and buffer:
            flush()
        else:
            buffer.append(line)
    flush()

    chunks: list[Chunk] = []
    pending_text = ""
    pending_headings: list[str] = []
    for headings, text in sections:
        heading_context = f"{' > '.join(headings)}\n\n" if headings else ""
        available = max(1, maximum - estimate_tokens(heading_context))
        for piece in _split_unit(text, available):
            contextual = heading_context + piece
            if pending_text and estimate_tokens(pending_text + "\n\n" + contextual) <= maximum:
                pending_text += "\n\n" + contextual
            else:
                if pending_text:
                    chunks.append(_make_chunk(len(chunks), pending_headings, pending_text))
                pending_text, pending_headings = contextual, headings
            if estimate_tokens(pending_text) >= target:
                chunks.append(_make_chunk(len(chunks), pending_headings, pending_text))
                tail = " ".join(pending_text.split()[-overlap:]) if overlap else ""
                pending_text = tail
                pending_headings = headings
    if pending_text.strip():
        chunks.append(_make_chunk(len(chunks), pending_headings, pending_text))
    return chunks


def _make_chunk(position: int, headings: list[str], content: str) -> Chunk:
    normalized = content.strip()
    return Chunk(
        position=position,
        heading_path=headings.copy(),
        content=normalized,
        content_hash=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
    )
