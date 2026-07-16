"""Agentic tool-calling loop shared by both chat modes.

Extracted from ``AssistantService`` — drives the LLM tool-use rounds, executes
tool calls (parking destructive/costly ones behind the confirmation gate), and
streams the final answer as SSE strings. Pure functions over explicit
dependencies so the loop is testable without the full service.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from src.logging_config import get_logger
from src.models.responses import ChatEvent
from src.services.agent_tools import (
    AGENT_TOOL_SCHEMAS,
    execute_tool,
    summarize_tool_result,
)
from src.services.confirmation import (
    park_tool_call,
    requires_confirmation,
    resolve_confirmation,
)
from src.services.observability import span

if TYPE_CHECKING:
    from src.services.api_client import ApiClient
    from src.services.confirmation import ConfirmationGate
    from src.services.llm_provider import LLMProvider, ToolCompletion

logger = get_logger(__name__)

# Cap agentic tool-calling rounds so a misbehaving model can't loop forever.
MAX_TOOL_ITERS = 4
# Tool-call budgets: per LLM turn and across the whole request. Exceeding
# either stops the loop gracefully instead of executing a runaway batch.
MAX_TOOL_CALLS_PER_ITER = 5
MAX_TOOL_CALLS_PER_REQUEST = 15

_TOOL_BUDGET_MESSAGE = (
    "I tried to run too many actions in one go, so I stopped for safety. "
    "Please break your request into smaller steps."
)


def format_sse(event: ChatEvent) -> str:
    """Format a ChatEvent as an SSE data line."""
    return f"data: {event.model_dump_json()}\n\n"


async def run_agentic_loop(
    llm: LLMProvider,
    confirmations: ConfirmationGate,
    messages: list[dict],
    user_id: str | None,
    api: ApiClient | None,
    confirm_token: str | None = None,
) -> AsyncGenerator[str, None]:
    """Drive the agentic tool-calling loop, then stream the final answer.

    With no ``api`` client (or no ``user_id``) configured, tools are disabled
    and this degrades to a single streamed completion — preserving the
    previous library-chat behaviour. A ``confirm_token`` (echoed by the UI
    from a ``pending_confirmation`` event) is resolved server-side BEFORE
    the model runs — the model itself can never redeem one.
    """
    if api is None or user_id is None:
        async with span("library_generation"):
            async for token in llm.stream_with_messages(
                messages=messages,
                max_tokens=2000,
                span_name="library_generation",
            ):
                yield format_sse(ChatEvent(type="text", content=token))
        return

    if confirm_token is not None:
        async for event in resolve_confirmation(
            confirmations,
            confirm_token,
            user_id=user_id,
            api_client=api,
            llm=llm,
            messages=messages,
        ):
            yield format_sse(event)

    total_calls = 0
    for _ in range(MAX_TOOL_ITERS):
        async with span("library_agent"):
            result = await llm.complete_with_tools(
                messages,
                tools=AGENT_TOOL_SCHEMAS,
                max_tokens=2000,
                span_name="library_agent",
            )
        if not result.tool_calls:
            if result.content:
                yield format_sse(ChatEvent(type="text", content=result.content))
            return
        n_calls = len(result.tool_calls)
        if n_calls > MAX_TOOL_CALLS_PER_ITER or total_calls + n_calls > MAX_TOOL_CALLS_PER_REQUEST:
            logger.warning(
                "assistant_tool_budget_exceeded",
                iteration_calls=n_calls,
                total_calls=total_calls,
            )
            yield format_sse(ChatEvent(type="text", content=_TOOL_BUDGET_MESSAGE))
            return
        total_calls += n_calls
        async for sse in _execute_tool_calls(
            result,
            messages,
            user_id,
            api,
            llm,
            confirmations,
        ):
            yield sse

    # Exhausted the tool budget — stream a final, tool-free answer. The
    # tool schemas must still be declared (``messages`` references prior
    # tool calls, which Anthropic 400s on when ``tools`` is absent) but
    # ``tool_choice="none"`` forbids further calls.
    async with span("library_generation"):
        async for token in llm.stream_with_messages(
            messages=messages,
            max_tokens=2000,
            tools=AGENT_TOOL_SCHEMAS,
            tool_choice="none",
            span_name="library_generation",
        ):
            yield format_sse(ChatEvent(type="text", content=token))


async def _execute_tool_calls(
    result: ToolCompletion,
    messages: list[dict],
    user_id: str,
    api: ApiClient,
    llm: LLMProvider,
    confirmations: ConfirmationGate,
) -> AsyncGenerator[str, None]:
    """Run each requested tool call, threading results back into *messages*.

    Destructive/costly calls (see :func:`requires_confirmation`) are NOT
    executed — they park in the confirmation gate and surface a
    ``pending_confirmation`` event so the UI can ask the user. Prompt
    prose alone never authorizes them.
    """
    messages.append(_assistant_tool_message(result))
    for call in result.tool_calls:
        name, args, call_id = call["name"], call["arguments"], call["id"]
        if requires_confirmation(name, args):
            yield format_sse(
                park_tool_call(
                    confirmations,
                    name=name,
                    args=args,
                    call_id=call_id,
                    user_id=user_id,
                    messages=messages,
                )
            )
            continue
        yield format_sse(
            ChatEvent(
                type="tool",
                content=f"Running {name}…",
                metadata={"status": "start", "action": name},
            )
        )
        res = await execute_tool(
            name,
            args,
            user_id=user_id,
            api_client=api,
            llm=llm,
        )
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call_id,
                "content": json.dumps(res),
            }
        )
        yield format_sse(
            ChatEvent(
                type="tool",
                content=summarize_tool_result(name, res),
                metadata={"status": "done", "action": name},
            )
        )


def _assistant_tool_message(result: ToolCompletion) -> dict:
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
