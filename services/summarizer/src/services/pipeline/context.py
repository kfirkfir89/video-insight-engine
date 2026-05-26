"""Pipeline context dataclass — shared mutable state across pipeline phases.

Each phase reads/writes fields on the context. Immutable inputs are set once
at construction; phase outputs are populated as the pipeline progresses.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from src.models.pipeline_types import PlanResult
    from src.repositories.mongodb_repository import MongoDBVideoRepository
    from src.services.llm import LLMService
    from src.services.pipeline.classifier import ContentTraits
    from src.services.pipeline.pipeline_helpers import PipelineTimer, TranscriptData
    from src.services.pipeline.triage import TriageResult
    from src.services.video.description_analyzer import DescriptionAnalysis
    from src.services.video.youtube import VideoData


@dataclass
class PipelineContext:
    """Shared state for the summarization pipeline.

    Immutable inputs are set at construction. Phase outputs are populated
    by each phase function as the pipeline progresses.
    """

    # ── Immutable inputs (set once at construction) ──────────────────────
    video_summary_id: str
    youtube_id: str
    entry: dict[str, Any]
    repository: MongoDBVideoRepository
    llm_service: LLMService
    timer: PipelineTimer

    # ── Phase outputs (set by phase functions) ───────────────────────────
    video_data: VideoData | None = None
    transcript_data: TranscriptData | None = None
    clean_text: str = ""

    # Scene extraction
    scene_task: asyncio.Task | None = None
    scene_frames_for_assembly: list[dict] = field(default_factory=list)
    scene_frames_all: list[dict] = field(default_factory=list)  # All frames (for thumbnail matching)
    scene_frames_gallery: list[dict] = field(default_factory=list)  # Gallery subset

    # Vision LLM frame descriptions (from frame_analyzer)
    frame_descriptions: list[dict] = field(default_factory=list)

    # Video DNA (formatted plan for downstream injection)
    video_dna_text: str = ""  # Full formatted for logging
    video_dna_compact: str = ""  # Compact ~300 chars for extraction/synthesis/enrichment

    # Plan inputs
    override: dict | None = None
    category_hint: str | None = None
    content_format: str | None = None  # Presentation format from classifier (tutorial, commentary, etc.)
    content_traits: ContentTraits | None = None  # Structural traits from classifier
    plan_result: PlanResult | None = None  # Merged plan result (replaces manifest + triage)
    description_analysis: DescriptionAnalysis | None = None

    # Triage outputs
    triage: TriageResult | None = None
    triage_dict: dict[str, Any] = field(default_factory=dict)

    # Chapter splitting (populated by extraction phase for long videos)
    chapters: list[Any] | None = None  # list[ChapterChunk] — loose coupling to avoid circular imports

    # Extraction / synthesis / enrichment outputs
    extraction_data: dict[str, Any] | None = None
    synthesis_dict: dict[str, Any] = field(default_factory=dict)
    enrichment_data: dict[str, Any] | None = None

    # Assembly outputs (populated by assembly phase)
    assembled_tabs: list[dict] | None = None
    assembled_meta: dict[str, Any] | None = None

    # Language support
    language: str = "en"  # ISO 639-1 code, defaults to English (the gate)
    is_rtl: bool = False  # Whether language is right-to-left
    audio_path: Path | None = None  # Cached audio file for reuse by translation
    # Set to "sound_only" when an instrumental/no-speech music video is force-routed to English.
    force_english_reason: str | None = None

    # Translation outputs (populated for non-English videos only)
    tabs_en: list[dict] | None = None
    meta_en: dict[str, Any] | None = None
    synthesis_en: dict[str, Any] | None = None

    # Per-phase timing (phase_name → seconds)
    phase_times: dict[str, float] = field(default_factory=dict)
