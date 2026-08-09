from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import trafilatura
from bs4 import BeautifulSoup, Tag
from markdownify import markdownify

from websearch.models.errors import ServiceError
from websearch.observability import safe_url

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ExtractedContent:
    title: str
    markdown: str
    meaningful_chars: int
    canonical_url: str | None


_REMOVE_TAGS = ("script", "style", "noscript", "svg", "template", "canvas", "iframe")
_NOISE_WORDS = re.compile(
    r"(?:cookie|consent|advert|banner|newsletter|subscribe|social-share|breadcrumb)", re.I
)


def _meaningful_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _is_good_candidate(tag: Tag, body_text_length: int) -> bool:
    text_length = len(_meaningful_text(tag.get_text(" ", strip=True)))
    return text_length >= 180 and (
        text_length >= body_text_length * 0.18 or tag.name in {"article", "main"}
    )


def _prepare_html(html: str, base_url: str) -> tuple[BeautifulSoup, Tag]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(_REMOVE_TAGS):
        if tag.parent is not None:
            tag.decompose()
    tags_to_remove: list[Tag] = []
    for tag in soup.find_all(True):
        if (
            tag.get("aria-hidden") == "true"
            or "display:none" in str(tag.get("style", "")).replace(" ", "").lower()
        ):
            tags_to_remove.append(tag)
            continue
        classes = " ".join(str(item) for item in (tag.get("class") or []))
        identity = f"{classes} {str(tag.get('id') or '')}"
        if tag.name in {"nav", "footer", "aside", "form"} or _NOISE_WORDS.search(identity):
            tags_to_remove.append(tag)
    for tag in tags_to_remove:
        if tag.parent is not None:
            tag.decompose()
    body = soup.body or soup
    body_length = len(_meaningful_text(body.get_text(" ", strip=True)))
    candidates = [
        tag for selector in ("main", "article", '[role="main"]') for tag in soup.select(selector)
    ]
    root = next((tag for tag in candidates if _is_good_candidate(tag, body_length)), body)
    for anchor in root.find_all("a", href=True):
        href = str(anchor.get("href"))
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        if urlsplit(absolute).scheme in {"http", "https"}:
            anchor["href"] = absolute
    return soup, root


def _markdown_from_html(root: Tag) -> str:
    rendered = markdownify(
        str(root),
        heading_style="ATX",
        bullets="-",
        strong_em_symbol="*",
        strip=["img"],
    )
    rendered = rendered.replace("\r\n", "\n")
    rendered = re.sub(r"\n{3,}", "\n\n", rendered)
    return rendered.strip()


def extract_html(html: str, base_url: str) -> ExtractedContent:
    if not html.strip():
        logger.warning(
            "HTML extraction received an empty document",
            extra={"event": "html_extraction_empty", "url": safe_url(base_url)},
        )
        raise ServiceError("extraction_failed", "HTML response was empty", 502)
    try:
        soup, root = _prepare_html(html, base_url)
        title = _meaningful_text(soup.title.get_text(" ", strip=True) if soup.title else "")
        candidate_markdown = _markdown_from_html(root)
        candidate_text = _meaningful_text(root.get_text(" ", strip=True))

        # Trafilatura is used as a quality fallback for pages without a useful semantic root.
        extracted_html = trafilatura.extract(
            html,
            url=base_url,
            output_format="html",
            include_links=True,
            include_tables=True,
            include_formatting=True,
            favor_precision=True,
        )
        extracted_markdown = (
            _markdown_from_html(BeautifulSoup(extracted_html, "html.parser"))
            if extracted_html
            else ""
        )
        used_trafilatura = False
        if (
            len(_meaningful_text(extracted_markdown))
            > len(_meaningful_text(candidate_markdown)) * 1.25
        ):
            used_trafilatura = True
            candidate_markdown = extracted_markdown
            candidate_text = (
                _meaningful_text(
                    BeautifulSoup(extracted_html, "html.parser").get_text(" ", strip=True)
                )
                if extracted_html
                else candidate_text
            )
        if not candidate_markdown:
            raise ServiceError(
                "extraction_failed", "Could not extract meaningful page content", 502
            )

        canonical = None
        canonical_tag = soup.find("link", rel=lambda value: value and "canonical" in value)
        if canonical_tag and canonical_tag.get("href"):
            candidate = urljoin(base_url, str(canonical_tag["href"]))
            if urlsplit(candidate).scheme in {"http", "https"}:
                canonical = candidate
        result = ExtractedContent(
            title=title,
            markdown=candidate_markdown,
            meaningful_chars=len(candidate_text),
            canonical_url=canonical,
        )
        logger.info(
            "HTML extraction completed",
            extra={
                "event": "html_extraction_completed",
                "url": safe_url(base_url),
                "original_chars": len(html),
                "markdown_chars": len(result.markdown),
                "meaningful_chars": result.meaningful_chars,
                "title_chars": len(result.title),
                "reason": "trafilatura_fallback" if used_trafilatura else "semantic_root",
            },
        )
        return result
    except ServiceError:
        logger.warning(
            "HTML extraction failed",
            extra={
                "event": "html_extraction_failed",
                "url": safe_url(base_url),
                "original_chars": len(html),
            },
        )
        raise
    except Exception as exc:
        logger.exception(
            "HTML extraction raised an unexpected error",
            extra={
                "event": "html_extraction_exception",
                "url": safe_url(base_url),
                "original_chars": len(html),
                "error_type": type(exc).__name__,
            },
        )
        raise ServiceError("extraction_failed", "Could not extract page content", 502) from exc


def looks_like_js_shell(html: str, extracted: ExtractedContent) -> bool:
    lowered = html.lower()
    shell_marker = any(
        marker in lowered
        for marker in ('id="root"', "id='root'", 'id="app"', "__next_data__", "data-reactroot")
    )
    return shell_marker and extracted.meaningful_chars < 800


def truncate_text(text: str, max_chars: int) -> tuple[str, int, bool]:
    original_length = len(text)
    if original_length <= max_chars:
        return text, original_length, False
    cut = text[:max_chars]
    boundary = max(cut.rfind("\n\n"), cut.rfind("\n"), cut.rfind(" "))
    if boundary >= max_chars // 2:
        cut = cut[:boundary].rstrip()
    return cut, len(cut), True
