"""Pydantic contracts for every SSE event the pipeline emits.

Mirrors the TS event interfaces in ``packages/types/src/vie-response.ts`` and
the table in ``docs/SERVICE-SUMMARIZER.md`` §SSE Event Protocol. Validated on
every emission by ``sse_event()`` (``pipeline_helpers.py``):

- non-production: an invalid payload or unregistered event name raises
  :class:`SSEEventValidationError` — contract drift fails dev runs and CI,
- production: the violation is logged and the event is emitted anyway — a
  cosmetic contract bug must never kill a user's pipeline run.

Passthrough events that forward LLM/legacy-doc dicts (``triage_complete``,
``extraction_complete``, ``enrichment_complete``, ``description_analysis``)
are deliberately permissive; code-constructed payloads are typed strictly.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.config import settings

logger = logging.getLogger(__name__)


class SSEEventValidationError(ValueError):
    """An SSE emission does not match its registered contract."""


class _SSEEvent(BaseModel):
    """Base for wire models — camelCase aliases, extra fields tolerated."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class CachedEvent(_SSEEvent):
    video_summary_id: str = Field(alias="videoSummaryId")


class MetadataEvent(_SSEEvent):
    # All-optional: the cached-serve path emits entry.get(...) values that may
    # be None on legacy docs.
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = Field(None, alias="thumbnailUrl")
    duration: int | None = None


class TranscriptReadyEvent(_SSEEvent):
    duration: float | None = None


class DescriptionAnalysisEvent(_SSEEvent):
    pass


class TriageCompleteEvent(_SSEEvent):
    pass


class ExtractionProgressEvent(_SSEEvent):
    section: str
    percent: float
    batch: int | None = None
    of: int | None = None


class ExtractionCompleteEvent(_SSEEvent):
    pass


class EnrichmentCompleteEvent(_SSEEvent):
    pass


class SynthesisCompleteEvent(_SSEEvent):
    tldr: str = ""
    key_takeaways: list[Any] = Field([], alias="keyTakeaways")
    master_summary: str = Field("", alias="masterSummary")
    seo_description: str = Field("", alias="seoDescription")


class FramesEvent(_SSEEvent):
    video_id: str = Field(alias="videoId")
    frames: list[dict[str, Any]]


class MetaEvent(_SSEEvent):
    title: str = ""
    content_tags: list[str] = Field([], alias="contentTags")
    primary_tag: str = Field("learning", alias="primaryTag")
    tab_count: int | None = Field(None, alias="tabCount")
    tab_labels: list[dict[str, Any]] = Field([], alias="tabLabels")


class TabReadyEvent(_SSEEvent):
    id: str
    component: str | None = None
    props: dict[str, Any] = {}


class CompleteEvent(_SSEEvent):
    tab_count: int = Field(alias="tabCount")
    processing_time_ms: int = Field(alias="processingTimeMs")
    degraded: bool = False


class HeartbeatEvent(_SSEEvent):
    ts: float


class PhaseEvent(_SSEEvent):
    phase: str


class ErrorEvent(_SSEEvent):
    message: str
    code: str | None = None


class TokenEvent(_SSEEvent):
    """Legacy token-streaming event (``sse_token`` helper). No pipeline
    phase currently emits it, but the protocol slot is still valid."""

    phase: str
    token: str


class DoneEvent(_SSEEvent):
    video_summary_id: str = Field(alias="videoSummaryId")
    cached: bool | None = None
    processing_time_ms: int | None = Field(None, alias="processingTimeMs")
    degraded: bool | None = None


SSE_EVENT_MODELS: dict[str, type[BaseModel]] = {
    "cached": CachedEvent,
    "metadata": MetadataEvent,
    "transcript_ready": TranscriptReadyEvent,
    "description_analysis": DescriptionAnalysisEvent,
    "triage_complete": TriageCompleteEvent,
    "extraction_progress": ExtractionProgressEvent,
    "extraction_complete": ExtractionCompleteEvent,
    "enrichment_complete": EnrichmentCompleteEvent,
    "synthesis_complete": SynthesisCompleteEvent,
    "frames": FramesEvent,
    "meta": MetaEvent,
    "tab_ready": TabReadyEvent,
    "complete": CompleteEvent,
    "heartbeat": HeartbeatEvent,
    "phase": PhaseEvent,
    "error": ErrorEvent,
    "token": TokenEvent,
    "done": DoneEvent,
}


def validate_sse_event(event: str, data: dict[str, Any]) -> BaseModel | None:
    """Validate one emission against its registered contract.

    Returns the validated model, or ``None`` in production fail-open mode.
    Raises :class:`SSEEventValidationError` outside production.
    """
    try:
        model_cls = SSE_EVENT_MODELS.get(event)
        if model_cls is None:
            raise SSEEventValidationError(
                f"unknown SSE event '{event}' — register a model in "
                "src/models/sse_events.py (and document it in "
                "docs/SERVICE-SUMMARIZER.md)"
            )
        try:
            return model_cls.model_validate(data)
        except ValidationError as exc:
            raise SSEEventValidationError(
                f"SSE event '{event}' failed contract validation: {exc}"
            ) from exc
    except SSEEventValidationError as exc:
        if settings.ENVIRONMENT.lower() == "production":
            logger.error(
                "sse_event_contract_violation event=%s error=%s",
                event,
                exc,
            )
            return None
        raise
