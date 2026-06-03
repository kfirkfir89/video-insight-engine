"""Context builder for assembling assistant system prompts."""

from __future__ import annotations

from src.logging_config import get_logger
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.utils.prompt_templates import (
    CONTEXT_TEMPLATE,
    LIBRARY_INVENTORY_HEADER,
    LIBRARY_SOURCES_HEADER,
    LIBRARY_SYSTEM_BASE,
    RAG_HEADER,
    SYSTEM_BASE,
    TABS_HEADER,
    TAKEAWAYS_HEADER,
)

logger = get_logger(__name__)

_MAX_SUMMARY_CHARS = 2000


class ContextBuilder:
    """Assembles system prompt context from video data and RAG results."""

    def build(
        self,
        video_ctx: VideoContext,
        rag_chunks: list[RAGSource] | None = None,
        user_language: str = "en",
    ) -> str:
        """Build a system prompt string with video context and RAG sources.

        Args:
            video_ctx: Structured video metadata and content.
            rag_chunks: Optional transcript chunks retrieved via RAG.
            user_language: Detected language of the user's message.

        Returns:
            System prompt string for the LLM.
        """
        base = SYSTEM_BASE.safe_substitute(
            title=video_ctx.title,
            creator=video_ctx.creator or "Unknown",
        )

        # English is promoted to the top level for translated videos, so the
        # default summary/tabs are already English. The original language lives
        # under ``sourceLanguage``; its true code (not the top-level "en") drives
        # native grounding and the RAG original-text gate.
        summary = video_ctx.summary
        tabs = video_ctx.tabs
        source = video_ctx.source_language or {}
        source_code = source.get("code") or video_ctx.language

        if user_language != "en" and user_language == source_code:
            source_meta = source.get("meta")
            if isinstance(source_meta, dict):
                summary = source_meta.get("masterSummary", summary) or summary
            source_tabs = source.get("tabs")
            if isinstance(source_tabs, list) and source_tabs:
                tabs = source_tabs

        if len(summary) > _MAX_SUMMARY_CHARS:
            summary = summary[:_MAX_SUMMARY_CHARS] + "..."

        takeaways_section = self._build_takeaways_section(video_ctx.takeaways)
        tabs_section = self._build_tabs_section(tabs)
        rag_section = self._build_rag_section(rag_chunks, user_language, source_code)

        # Add language instruction for non-English responses
        language_instruction = ""
        if user_language != "en":
            language_instruction = f"\n\nIMPORTANT: Respond in the user's language ({user_language})."

        context = CONTEXT_TEMPLATE.safe_substitute(
            summary=summary,
            takeaways_section=takeaways_section,
            tabs_section=tabs_section,
            rag_section=rag_section,
        )

        return f"{base}{language_instruction}\n\n{context}"

    def build_library(
        self,
        rag_chunks: list[RAGSource] | None = None,
        user_language: str = "en",
        inventory: list[dict] | None = None,
    ) -> str:
        """Build a multi-video, library-wide system prompt.

        Includes the user's video titles (so meta-questions like "what videos do
        I have?" work) plus any relevant retrieved content grouped by video TITLE
        — never the raw id, which the model must not surface.

        Args:
            rag_chunks: Transcript/output chunks retrieved across the library.
            user_language: Detected language of the user's message.
            inventory: ``[{"video_id", "title"}, ...]`` for the user's videos.

        Returns:
            System prompt string for the LLM.
        """
        language_instruction = ""
        if user_language != "en":
            language_instruction = (
                f"\n\nIMPORTANT: Respond in the user's language ({user_language})."
            )

        title_by_id = {
            v["video_id"]: str(v.get("title") or "")
            for v in (inventory or [])
            if v.get("video_id")
        }
        inventory_section = self._build_library_inventory_section(inventory)
        sources_section = self._build_library_sources_section(rag_chunks, title_by_id)
        return (
            f"{LIBRARY_SYSTEM_BASE}{language_instruction}\n\n"
            f"{inventory_section}{sources_section}"
        )

    def _build_library_inventory_section(self, inventory: list[dict] | None) -> str:
        """List the user's video titles so the assistant knows the whole library,
        not just the videos that happened to match the current query."""
        if not inventory:
            return ""
        titles = [str(v.get("title") or "").strip() for v in inventory]
        titles = [t for t in titles if t]
        if not titles:
            return ""
        items = "\n".join(f"- {t}" for t in titles)
        return f"{LIBRARY_INVENTORY_HEADER}{items}\n\n"

    def _build_library_sources_section(
        self,
        chunks: list[RAGSource] | None,
        title_by_id: dict[str, str] | None = None,
    ) -> str:
        """Group retrieved chunks by video TITLE (never the raw id)."""
        if not chunks:
            return ""

        title_by_id = title_by_id or {}
        grouped: dict[str, list[RAGSource]] = {}
        for chunk in chunks:
            label = (
                getattr(chunk, "title", None)
                or title_by_id.get(chunk.video_id)
                or "a video in the library"
            )
            grouped.setdefault(label, []).append(chunk)

        blocks: list[str] = []
        for label, video_chunks in grouped.items():
            lines = [f"### From: {label}"]
            lines.extend(chunk.text for chunk in video_chunks)
            blocks.append("\n".join(lines))

        return f"{LIBRARY_SOURCES_HEADER}" + "\n\n".join(blocks) + "\n"

    def _build_takeaways_section(self, takeaways: list[str]) -> str:
        """Format takeaways as a bullet list."""
        if not takeaways:
            return ""
        items = "\n".join(f"- {t}" for t in takeaways)
        return f"{TAKEAWAYS_HEADER}{items}\n\n"

    def _build_tabs_section(self, tabs: list[dict]) -> str:
        """Format tab labels as a list for orientation."""
        if not tabs:
            return ""
        lines: list[str] = []
        for tab in tabs:
            emoji = tab.get("emoji", "")
            label = tab.get("label", tab.get("id", ""))
            if emoji and label:
                lines.append(f"- {emoji} {label}")
            elif label:
                lines.append(f"- {label}")
        if not lines:
            return ""
        return f"{TABS_HEADER}" + "\n".join(lines) + "\n\n"

    def _build_rag_section(
        self,
        chunks: list[RAGSource] | None,
        user_language: str = "en",
        video_language: str = "en",
    ) -> str:
        """Format RAG chunks with optional timestamps.

        Uses text_original when user language matches video language (non-English).
        """
        if not chunks:
            return ""
        lines: list[str] = []
        use_original = user_language == video_language and video_language != "en"
        for chunk in chunks:
            prefix = f"[{chunk.timestamp}] " if chunk.timestamp else ""
            text = (chunk.text_original or chunk.text) if use_original else chunk.text
            lines.append(f"{prefix}{text}")
        return f"{RAG_HEADER}" + "\n\n".join(lines) + "\n"
