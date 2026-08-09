from __future__ import annotations

import logging
from io import BytesIO

from pypdf import PdfReader

from websearch.config import Settings
from websearch.models.errors import ServiceError

logger = logging.getLogger(__name__)


def extract_pdf_text(body: bytes, settings: Settings) -> str:
    logger.info(
        "PDF extraction started",
        extra={"event": "pdf_extraction_started", "content_length": len(body)},
    )
    if len(body) > settings.pdf_max_bytes:
        logger.warning(
            "PDF exceeds byte limit",
            extra={
                "event": "pdf_extraction_rejected",
                "content_length": len(body),
                "limit_bytes": settings.pdf_max_bytes,
                "reason": "byte_limit",
            },
        )
        raise ServiceError("response_too_large", "PDF exceeds the configured size limit", 413)
    try:
        reader = PdfReader(BytesIO(body), strict=False)
        logger.debug(
            "PDF parsed",
            extra={"event": "pdf_parsed", "pages": len(reader.pages)},
        )
        if len(reader.pages) > settings.pdf_max_pages:
            logger.warning(
                "PDF exceeds page limit",
                extra={
                    "event": "pdf_extraction_rejected",
                    "pages": len(reader.pages),
                    "limit_pages": settings.pdf_max_pages,
                    "reason": "page_limit",
                },
            )
            raise ServiceError("response_too_large", "PDF exceeds the configured page limit", 413)
        text = "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()
    except ServiceError:
        raise
    except Exception as exc:
        logger.exception(
            "PDF extraction failed",
            extra={"event": "pdf_extraction_failed", "error_type": type(exc).__name__},
        )
        raise ServiceError("extraction_failed", "Could not read PDF content", 502) from exc
    if not text:
        logger.warning("PDF has no extractable text", extra={"event": "pdf_no_text"})
        raise ServiceError("pdf_has_no_extractable_text", "PDF has no extractable text", 422)
    logger.info(
        "PDF extraction completed",
        extra={"event": "pdf_extraction_completed", "meaningful_chars": len(text)},
    )
    return text
