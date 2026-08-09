from __future__ import annotations

import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from memory_service.domain.errors import not_found
from memory_service.domain.models import ParsedNote
from memory_service.storage.paths import VaultPaths


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def parse_markdown(raw: str, path: str = "") -> ParsedNote:
    frontmatter: dict[str, object] = {}
    body = raw
    if raw.startswith("---\n") or raw.startswith("---\r\n"):
        lines = raw.splitlines(keepends=True)
        end = next((i for i, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
        if end is not None:
            document = "".join(lines[1:end])
            try:
                loaded = yaml.safe_load(document) or {}
            except yaml.YAMLError:
                loaded = {}
            if isinstance(loaded, dict):
                frontmatter = {str(key): value for key, value in loaded.items()}
                body = "".join(lines[end + 1 :])

    headings: list[tuple[int, str, int]] = []
    tags: set[str] = set()
    links = []
    fence: str | None = None
    for number, line in enumerate(body.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            marker = stripped[:3]
            fence = None if fence == marker else marker if fence is None else fence
            continue
        if fence is not None:
            continue
        if stripped.startswith("#"):
            marker, _, heading = stripped.partition(" ")
            if marker and set(marker) == {"#"} and heading:
                headings.append((len(marker), heading.strip(), number))
        import re

        for tag in re.findall(r"(?<![\w])#([\w/-]+)", line):
            tags.add(tag.casefold())
        for match in re.finditer(r"\[\[([^\]]+)\]\]", line):
            target = match.group(1)
            target_part, separator, alias = target.partition("|")
            target_text, hash_separator, target_heading = target_part.partition("#")
            links.append(
                {
                    "target_text": target_text.strip(),
                    "alias": alias.strip() if separator else None,
                    "target_heading": target_heading.strip() if hash_separator else None,
                }
            )

    yaml_tags = frontmatter.get("tags", [])
    if isinstance(yaml_tags, str):
        yaml_tags = [yaml_tags]
    if isinstance(yaml_tags, list):
        tags.update(str(tag).lstrip("#").casefold() for tag in yaml_tags)
    title = str(frontmatter.get("title") or (headings[0][1] if headings else Path(path).stem))
    from memory_service.domain.models import ParsedLink

    return ParsedNote(
        note_id=str(frontmatter["id"]) if frontmatter.get("id") else None,
        title=title,
        frontmatter=frontmatter,
        body=body,
        raw=raw,
        headings=headings,
        tags=tags,
        links=[
            ParsedLink(
                target_text=str(link["target_text"]),
                alias=str(link["alias"]) if link["alias"] is not None else None,
                target_heading=(
                    str(link["target_heading"]) if link["target_heading"] is not None else None
                ),
            )
            for link in links
        ],
    )


def render_markdown(content: str, frontmatter: dict[str, Any]) -> str:
    if not frontmatter:
        return content if content.endswith("\n") else content + "\n"
    header = yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False).strip()
    body = content.lstrip("\n")
    return f"---\n{header}\n---\n\n{body if body.endswith(chr(10)) else body + chr(10)}"


class MarkdownStorage:
    def __init__(self, paths: VaultPaths):
        self.paths = paths

    def read_path(self, path: str) -> tuple[str, ParsedNote]:
        absolute = self.paths.absolute(path)
        try:
            raw = absolute.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise not_found(f"note not found: {path}") from exc
        return raw, parse_markdown(raw, path)

    def write_path(self, path: str, content: str) -> None:
        absolute = self.paths.absolute(path)
        absolute.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary_name = tempfile.mkstemp(prefix=f".{absolute.name}.", dir=absolute.parent)
        temporary = Path(temporary_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, absolute)
            try:
                directory_fd = os.open(absolute.parent, os.O_DIRECTORY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            except (AttributeError, OSError):
                pass
        finally:
            temporary.unlink(missing_ok=True)

    def delete_path(self, path: str) -> None:
        absolute = self.paths.absolute(path)
        try:
            absolute.unlink()
        except FileNotFoundError as exc:
            raise not_found(f"note not found: {path}") from exc
