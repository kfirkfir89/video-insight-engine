"""Core assistant service — orchestrates RAG, tool routing, and LLM streaming."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from cachetools import TTLCache

from src.config import Settings
from src.exceptions import NotFoundError
from src.logging_config import get_logger
from src.models.requests import ChatMessage
from src.models.responses import ChatEvent
from src.repositories.video_repository import MongoVideoRepository, VideoContext
from src.services.context_builder import ContextBuilder
from src.services.llm_provider import LLMProvider
from src.services.rag import RAGService
from src.services.tool_router import ToolRouter
from src.tools.base import BaseTool

logger = get_logger(__name__)


class AssistantService:
    """Orchestrates video-aware chat with RAG, tool routing, and LLM streaming."""

    def __init__(
        self,
        llm: LLMProvider,
        rag: RAGService,
        video_repo: MongoVideoRepository,
        context_builder: ContextBuilder,
        settings: Settings,
    ) -> None:
        self._llm = llm
        self._rag = rag
        self._video_repo = video_repo
        self._context_builder = context_builder
        self._settings = settings
        self._video_cache: TTLCache[str, VideoContext] = TTLCache(maxsize=200, ttl=600)
        self._tool_router = ToolRouter()

    def register_tool(self, tool: BaseTool) -> None:
        """Register a tool for intent-based routing.

        Args:
            tool: A tool implementing the BaseTool protocol.
        """
        self._tool_router.register(tool)

    async def _load_video_context(self, video_id: str) -> VideoContext:
        """Load video context from cache or MongoDB.

        Raises:
            NotFoundError: If video is not found.
        """
        cached = self._video_cache.get(video_id)
        if cached is not None:
            return cached

        ctx = await self._video_repo.get_video_context(video_id)
        if ctx is None:
            raise NotFoundError(f"Video not found: {video_id}")

        self._video_cache[video_id] = ctx
        return ctx

    async def chat(
        self,
        video_id: str,
        message: str,
        history: list[ChatMessage],
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response about a video.

        Routes to a registered tool if intent is detected, otherwise
        falls back to RAG-powered LLM chat.

        Yields SSE-formatted events: source/tool_result, text tokens,
        then a done event.

        Args:
            video_id: YouTube video ID.
            message: User's current message.
            history: Previous conversation messages.

        Yields:
            SSE-formatted strings (``data: {json}\\n\\n``).

        Raises:
            NotFoundError: If video is not found.
        """
        video_ctx = await self._load_video_context(video_id)

        logger.info(
            "assistant_chat_start",
            video_id=video_id,
            history_len=len(history),
        )

        # Check for tool intent before RAG search
        intent = self._tool_router.detect_intent(message)
        if intent is not None:
            async for event in self._tool_router.route(
                intent, message, video_id, video_ctx
            ):
                yield self._format_sse(event)
            return

        # Default: RAG-powered chat
        async for sse in self._rag_chat(video_id, message, history, video_ctx):
            yield sse

    async def _rag_chat(
        self,
        video_id: str,
        message: str,
        history: list[ChatMessage],
        video_ctx: VideoContext,
    ) -> AsyncGenerator[str, None]:
        """Default RAG + LLM streaming chat path."""
        rag_sources = await self._rag.search(
            query=message,
            video_id=video_id,
            top_k=self._settings.MAX_CONTEXT_CHUNKS,
        )

        if rag_sources:
            yield self._format_sse(ChatEvent(type="source", sources=rag_sources))
        else:
            logger.info("assistant_chat_no_rag_context", video_id=video_id)

        system_prompt = self._context_builder.build(
            video_ctx=video_ctx,
            rag_chunks=rag_sources,
        )
        messages = self._build_messages(system_prompt, history, message)

        try:
            async for token in self._llm.stream_with_messages(
                messages=messages,
                max_tokens=2000,
            ):
                yield self._format_sse(ChatEvent(type="text", content=token))
        except Exception as exc:
            logger.error("assistant_chat_llm_error", video_id=video_id, error=str(exc))
            yield self._format_sse(ChatEvent(
                type="error",
                content="Failed to generate response. Please try again.",
            ))

        yield self._format_sse(ChatEvent(
            type="done",
            metadata={"video_id": video_id, "sources_count": len(rag_sources)},
        ))

    def _build_messages(
        self,
        system_prompt: str,
        history: list[ChatMessage],
        current_message: str,
    ) -> list[dict]:
        """Construct the LLM message list with history truncation.

        For Anthropic models, adds ``cache_control`` to the system prompt
        so the video context is cached across conversation turns.
        """
        if self._llm.model.startswith("anthropic/"):
            system_msg: dict = {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        else:
            system_msg = {"role": "system", "content": system_prompt}

        messages: list[dict] = [system_msg]

        max_history = self._settings.MAX_CONVERSATION_TURNS * 2
        trimmed = history[-max_history:] if len(history) > max_history else history
        for msg in trimmed:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": current_message})
        return messages

    def _format_sse(self, event: ChatEvent) -> str:
        """Format a ChatEvent as an SSE data line."""
        return f"data: {event.model_dump_json()}\n\n"
