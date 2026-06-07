"""Core assistant service — orchestrates RAG, tool routing, and LLM streaming."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from cachetools import TTLCache

from src.config import Settings
from src.exceptions import NotFoundError
from src.logging_config import get_logger
from src.models.requests import ChatMessage
from src.models.responses import ChatEvent
from src.repositories.video_repository import MongoVideoRepository, VideoContext
from src.services.agent_tools import AGENT_TOOL_SCHEMAS, execute_tool
from src.services.context_builder import ContextBuilder
from src.services.llm_provider import LLMProvider
from src.services.observability import session_trace, span
from src.services.rag import RAGService
from src.services.tool_router import ActionDispatcher, ToolRouter
from src.tools.base import BaseTool
from src.utils.language_detect import detect_language

if TYPE_CHECKING:
    from src.services.api_client import ApiClient

logger = get_logger(__name__)

# Cap agentic tool-calling rounds so a misbehaving model can't loop forever.
MAX_TOOL_ITERS = 4

_LIBRARY_AGENT_INSTRUCTIONS = """\
You are a capable library assistant. Beyond answering questions, you CAN act on \
the user's library using your tools: create, rename, move, and delete folders, \
and move or generate videos on the user's behalf.

Rules:
- Always refer to videos by their TITLE (from the library inventory) — never \
mention raw ids or internal excerpts.
- Resolve ids by calling list_folders / list_videos before any folder/video \
mutation; do not invent ids.
- CONFIRM conversationally before any destructive action (deleting a folder \
WITH its content) or costly action (generating a video) — only call those \
tools after the user clearly agrees.
- For non-destructive actions the user explicitly asked for (create folder, \
rename, move), just do them, then briefly report what you did using titles.
"""


class AssistantService:
    """Orchestrates video-aware chat with RAG, tool routing, and LLM streaming."""

    def __init__(
        self,
        llm: LLMProvider,
        rag: RAGService,
        video_repo: MongoVideoRepository,
        context_builder: ContextBuilder,
        settings: Settings,
        api_client: ApiClient | None = None,
    ) -> None:
        self._llm = llm
        self._rag = rag
        self._video_repo = video_repo
        self._context_builder = context_builder
        self._settings = settings
        self._api = api_client
        self._video_cache: TTLCache[str, VideoContext] = TTLCache(maxsize=200, ttl=600)
        self._tool_router = ToolRouter()
        self._action_dispatcher = ActionDispatcher(self._tool_router)

    def register_tool(self, tool: BaseTool) -> None:
        """Register a tool for intent-based routing.

        Args:
            tool: A tool implementing the BaseTool protocol.
        """
        self._tool_router.register(tool)

    async def dispatch_action(
        self,
        action: str,
        video_id: str | None,
        params: dict,
        user_id: str | None = None,
    ) -> dict:
        """Execute a structured action.

        Video-scoped actions (save_note, quiz_me, find_moment, explain) carry a
        ``video_id`` and load the cached video context; library-scoped actions
        (folder management, generate_video, organize_library) pass
        ``video_id=None`` and run without a video context. Raises
        :class:`NotFoundError` when a referenced video doesn't exist and
        :class:`ValidationError` on bad input.
        """
        video_ctx = await self._load_video_context(video_id) if video_id else None
        return await self._action_dispatcher.dispatch(
            action=action,
            video_id=video_id,
            params=params,
            video_ctx=video_ctx,
            user_id=user_id,
        )

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
        *,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response about a video.

        Routes to a registered tool if intent is detected, otherwise
        falls back to RAG-powered LLM chat. The whole request runs inside
        a Langfuse session trace (no-op when keys unset) so tool calls and
        the RAG generation attach as child spans.

        Args:
            video_id: YouTube video ID.
            message: User's current message.
            history: Previous conversation messages.
            user_id: Optional user identifier for the trace.
            session_id: Optional chat session id for grouping turns.

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

        async with session_trace(
            video_id=video_id,
            user_id=user_id,
            session_id=session_id,
            metadata={"historyLen": len(history), "messageLen": len(message)},
        ):
            # Check for tool intent before RAG search
            intent = self._tool_router.detect_intent(message)
            if intent is not None:
                async with span("tool", metadata={"intent": intent}):
                    async for event in self._tool_router.route(
                        intent, message, video_id, video_ctx,
                    ):
                        yield self._format_sse(event)
                return

            # Default: RAG-powered chat (also exposes library action tools)
            async for sse in self._rag_chat(
                video_id, message, history, video_ctx, user_id=user_id,
            ):
                yield sse

    async def library_chat(
        self,
        video_ids: list[str],
        message: str,
        history: list[ChatMessage],
        *,
        user_id: str | None = None,
        session_id: str | None = None,
        inventory: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a library-wide chat response grounded in many saved videos.

        Mirrors :meth:`_rag_chat` but searches across ``video_ids`` instead of
        a single video. The caller (vie-api) derives ``video_ids`` server-side
        from the user's owned videos; the assistant trusts the list. An empty
        list (or a search that returns nothing) degrades gracefully — the model
        is told no relevant excerpts were found.

        Args:
            video_ids: YouTube ids the user owns (library scope).
            message: User's current message.
            history: Previous conversation messages.
            user_id: Optional user identifier for the trace.
            session_id: Optional chat session id for grouping turns.

        Yields:
            SSE-formatted strings (``data: {json}\\n\\n``).
        """
        logger.info(
            "assistant_library_chat_start",
            video_count=len(video_ids),
            history_len=len(history),
        )

        async with session_trace(
            video_id="",
            user_id=user_id,
            session_id=session_id,
            tags=["library"],
            metadata={
                "videoCount": len(video_ids),
                "historyLen": len(history),
                "messageLen": len(message),
            },
        ):
            user_language = detect_language(message)
            search_query = await self._translate_query(message, user_language)

            rag_sources = await self._rag.search_library(
                query=search_query,
                video_ids=video_ids,
                top_k=self._settings.MAX_CONTEXT_CHUNKS,
            )

            # Label each source with its video title so the answer + source chips
            # name videos instead of leaking raw ids.
            title_by_id = {
                v.get("video_id"): v.get("title", "")
                for v in (inventory or [])
                if v.get("video_id")
            }
            for src in rag_sources:
                src.title = title_by_id.get(src.video_id) or src.title

            if rag_sources:
                yield self._format_sse(ChatEvent(type="source", sources=rag_sources))
            else:
                logger.info("assistant_library_chat_no_context")

            system_prompt = self._build_library_system_prompt(
                rag_sources, user_language, inventory, user_id=user_id
            )
            messages = self._build_messages(system_prompt, history, message)

            try:
                async for sse in self._run_agentic_loop(messages, user_id):
                    yield sse
            except Exception as exc:
                logger.error("assistant_library_chat_llm_error", error=str(exc))
                yield self._format_sse(ChatEvent(
                    type="error",
                    content="Failed to generate response. Please try again.",
                ))

            yield self._format_sse(ChatEvent(
                type="done",
                metadata={"sources_count": len(rag_sources)},
            ))

    def _build_library_system_prompt(
        self,
        rag_sources: list,
        user_language: str,
        inventory: list[dict] | None,
        user_id: str | None = None,
    ) -> str:
        """Build the library system prompt; prepend agent instructions when tools are on."""
        base = self._context_builder.build_library(
            rag_chunks=rag_sources,
            user_language=user_language,
            inventory=inventory,
        )
        return f"{self._agent_instructions_prefix(user_id)}{base}"

    def _agent_instructions_prefix(self, user_id: str | None) -> str:
        """Return the agent action instructions when the action channel is usable.

        Mirrors the gating in :meth:`_run_agentic_loop`: tools are only offered
        when both the vie-api client and a ``user_id`` are present, so the prompt
        must only promise actions under that same condition — otherwise the model
        claims it "can act" while no tools are passed.
        """
        if self._api is None or user_id is None:
            return ""
        return f"{_LIBRARY_AGENT_INSTRUCTIONS}\n\n"

    async def _run_agentic_loop(
        self,
        messages: list[dict],
        user_id: str | None,
    ) -> AsyncGenerator[str, None]:
        """Drive the agentic tool-calling loop, then stream the final answer.

        With no ``api_client`` (or no ``user_id``) configured, tools are disabled
        and this degrades to a single streamed completion — preserving the
        previous library-chat behaviour.
        """
        if self._api is None or user_id is None:
            async with span("library_generation"):
                async for token in self._llm.stream_with_messages(
                    messages=messages,
                    max_tokens=2000,
                    span_name="library_generation",
                ):
                    yield self._format_sse(ChatEvent(type="text", content=token))
            return

        for _ in range(MAX_TOOL_ITERS):
            async with span("library_agent"):
                result = await self._llm.complete_with_tools(
                    messages,
                    tools=AGENT_TOOL_SCHEMAS,
                    max_tokens=2000,
                    span_name="library_agent",
                )
            if not result.tool_calls:
                if result.content:
                    yield self._format_sse(
                        ChatEvent(type="text", content=result.content)
                    )
                return
            async for sse in self._execute_tool_calls(result, messages, user_id):
                yield sse

        # Exhausted the tool budget — stream a final, tool-free answer. The
        # tool schemas must still be declared (``messages`` references prior
        # tool calls, which Anthropic 400s on when ``tools`` is absent) but
        # ``tool_choice="none"`` forbids further calls.
        async with span("library_generation"):
            async for token in self._llm.stream_with_messages(
                messages=messages,
                max_tokens=2000,
                tools=AGENT_TOOL_SCHEMAS,
                tool_choice="none",
                span_name="library_generation",
            ):
                yield self._format_sse(ChatEvent(type="text", content=token))

    async def _execute_tool_calls(
        self,
        result,
        messages: list[dict],
        user_id: str,
    ) -> AsyncGenerator[str, None]:
        """Run each requested tool call, threading results back into *messages*."""
        messages.append(self._assistant_tool_message(result))
        for call in result.tool_calls:
            name, args, call_id = call["name"], call["arguments"], call["id"]
            yield self._format_sse(ChatEvent(
                type="tool",
                content=f"Running {name}…",
                metadata={"status": "start", "action": name},
            ))
            res = await execute_tool(
                name, args, user_id=user_id, api_client=self._api, llm=self._llm,
            )
            messages.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": json.dumps(res),
            })
            yield self._format_sse(ChatEvent(
                type="tool",
                content=_summarize_tool_result(name, res),
                metadata={"status": "done", "action": name},
            ))

    def _assistant_tool_message(self, result) -> dict:
        """Reconstruct the assistant tool-call message for the next LLM turn."""
        return {
            "role": "assistant",
            "content": result.content or "",
            "tool_calls": [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {
                        "name": call["name"],
                        "arguments": json.dumps(call["arguments"]),
                    },
                }
                for call in result.tool_calls
            ],
        }

    async def _translate_query(self, message: str, user_language: str) -> str:
        """Translate a non-English query to English for RAG search.

        Returns the original message on translation failure (degraded mode).
        """
        if user_language == "en":
            return message
        try:
            translated_query = await self._llm.translate_to_english(message)
            if translated_query:
                logger.info(
                    "assistant_query_translated",
                    user_language=user_language,
                    original_len=len(message),
                    translated_len=len(translated_query),
                )
                return translated_query
        except Exception as e:
            logger.warning("assistant_query_translation_failed", error=str(e))
        return message

    async def _rag_chat(
        self,
        video_id: str,
        message: str,
        history: list[ChatMessage],
        video_ctx: VideoContext,
        user_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Default RAG + LLM chat path, grounded in the open video.

        Beyond answering about the video, this also exposes the library action
        tools (create/move/organize folders and videos) via the shared agentic
        loop, so the user can act on their collection without leaving the video.
        Degrades to a plain streamed completion when the action channel is
        unavailable — see :meth:`_run_agentic_loop`.
        """
        # Detect user language for query translation and response language
        user_language = detect_language(message)
        search_query = await self._translate_query(message, user_language)

        rag_sources = await self._rag.search(
            query=search_query,
            video_id=video_ctx.youtube_id,
            top_k=self._settings.MAX_CONTEXT_CHUNKS,
        )

        if rag_sources:
            yield self._format_sse(ChatEvent(type="source", sources=rag_sources))
        else:
            logger.info("assistant_chat_no_rag_context", video_id=video_id)

        system_prompt = self._context_builder.build(
            video_ctx=video_ctx,
            rag_chunks=rag_sources,
            user_language=user_language,
        )
        system_prompt = f"{self._agent_instructions_prefix(user_id)}{system_prompt}"
        messages = self._build_messages(system_prompt, history, message)

        try:
            async for sse in self._run_agentic_loop(messages, user_id):
                yield sse
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


def _summarize_tool_result(name: str, res: dict) -> str:
    """Produce a short, human-readable summary of a tool result for the UI.

    The web renders these as muted "✓ step" lines, so they must read like a
    plain action recap — never expose ids or raw payloads.
    """
    if res.get("error"):
        return f"{name} failed"
    if name == "create_folder":
        folder = res.get("folder") or {}
        folder_name = folder.get("name") if isinstance(folder, dict) else None
        return f'Created folder "{folder_name}"' if folder_name else "Created folder"
    if name == "rename_folder":
        folder = res.get("folder") or {}
        folder_name = folder.get("name") if isinstance(folder, dict) else None
        return f'Renamed folder to "{folder_name}"' if folder_name else "Renamed folder"
    if name == "move_folder":
        return "Moved folder"
    if name == "delete_folder":
        return "Deleted folder"
    if name == "move_video":
        return "Moved video"
    if name == "generate_video":
        return "Started video generation"
    if name == "organize_library":
        result = res.get("result") or {}
        if isinstance(result, dict):
            created = result.get("folders_created", 0)
            moved = result.get("videos_moved", 0)
            return f"Organized library: {created} folders, {moved} videos moved"
        return "Organized library"
    if name == "list_folders":
        folders = res.get("folders") or []
        return f"Found {len(folders)} folders"
    if name == "list_videos":
        videos = res.get("videos") or []
        return f"Found {len(videos)} videos"
    return f"Ran {name}"
