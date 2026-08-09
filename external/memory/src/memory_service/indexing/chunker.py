from __future__ import annotations

import hashlib
import re

from memory_service.domain.models import Chunk, ParsedNote


def estimate_tokens(text: str) -> int:
    return max(1, len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE)))


def _split_unit(text: str, maximum: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    result: list[str] = []
    current: list[str] = []
    count = 0
    for word in words:
        size = estimate_tokens(word)
        if current and count + size > maximum:
            result.append(" ".join(current))
            current, count = [], 0
        current.append(word)
        count += size
    if current:
        result.append(" ".join(current))
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
        contextual = f"{' > '.join(headings)}\n\n{text}" if headings else text
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
