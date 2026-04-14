"""Context builder for assembling assistant system prompts."""

from __future__ import annotations

from src.logging_config import get_logger
from src.models.responses import RAGSource
from src.repositories.video_repository import VideoContext
from src.utils.prompt_templates import (
    CONTEXT_TEMPLATE,
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

        # Use English synthesis for non-English videos when user speaks English
        summary = video_ctx.summary
        if user_language == "en" and video_ctx.language != "en" and video_ctx.synthesis_en:
            summary = video_ctx.synthesis_en.get("masterSummary", summary)

        if len(summary) > _MAX_SUMMARY_CHARS:
            summary = summary[:_MAX_SUMMARY_CHARS] + "..."

        takeaways_section = self._build_takeaways_section(video_ctx.takeaways)
        tabs_section = self._build_tabs_section(video_ctx.tabs)
        rag_section = self._build_rag_section(rag_chunks, user_language, video_ctx.language)

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
