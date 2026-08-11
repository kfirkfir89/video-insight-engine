"""Server-side confirmation gate for destructive/costly agent tools.

The agentic loop lets the LLM call library tools while attacker-influenceable
text (transcripts, RAG excerpts) shares its context — so "confirm with the
user first" prompt prose is NOT a security boundary. This module enforces the
boundary in code: gated tool calls never execute on the model's say-so.
Instead the first call parks the action server-side under a short-lived,
single-use token; the token travels to the UI over the SSE tool channel
(NEVER into the LLM context), and execution happens only when a later request
echoes it back in ``confirm_token`` on the chat request model — a field only
the user's client controls. The model cannot self-confirm: tokens are never
accepted from tool-call arguments.
"""

from __future__ import annotations

import json
import secrets
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from cachetools import TTLCache

from src.logging_config import get_logger
from src.models.responses import ChatEvent
from src.services.agent_tools import execute_tool, summarize_tool_result

if TYPE_CHECKING:
    from src.services.api_client import ApiClient
    from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)

# How long a pending confirmation stays redeemable, and how many can be
# outstanding at once (oldest evicted first).
CONFIRMATION_TTL_SECONDS = 300
_MAX_PENDING = 1000

# Tool result threaded back to the model instead of executing. Retrying the
# tool only parks another pending action — it can never trigger execution.
_PENDING_MESSAGE = (
    "This action requires the user's explicit confirmation via the "
    "confirmation UI. It has NOT been executed. Do not retry the tool — "
    "briefly tell the user what the action will do and that they can "
    "confirm or cancel it."
)


@dataclass
class PendingAction:
    """A gated tool call parked until the user confirms it."""

    name: str
    args: dict[str, Any]
    user_id: str


def requires_confirmation(name: str, args: dict[str, Any]) -> bool:
    """Return True when a tool call must round-trip a user confirmation.

    Exactly two calls are gated: ``delete_folder`` WITH ``delete_content``
    (destructive) and ``generate_video`` (costs money). ``delete_folder``
    without content deletion only detaches videos and stays ungated.
    """
    if name == "generate_video":
        return True
    if name == "delete_folder":
        return bool(args.get("delete_content", False))
    return False


def describe_action(name: str, args: dict[str, Any]) -> str:
    """Human summary of a pending action for the confirm UI (no raw ids)."""
    if name == "generate_video":
        url = args.get("url") or "this video"
        return f"Generate a knowledge app from {url} (this costs money)"
    if name == "delete_folder":
        return "Delete this folder AND every video inside it"
    return f"Run {name}"


class ConfirmationGate:
    """In-memory store of pending confirmations (single-use, TTL-bound)."""

    def __init__(self, ttl_seconds: float = CONFIRMATION_TTL_SECONDS) -> None:
        self._pending = TTLCache[str, PendingAction](
            maxsize=_MAX_PENDING,
            ttl=ttl_seconds,
        )

    def create(self, name: str, args: dict[str, Any], user_id: str) -> str:
        """Park a gated action and return its single-use token."""
        token = secrets.token_urlsafe(32)
        self._pending[token] = PendingAction(
            name=name,
            args=dict(args),
            user_id=user_id,
        )
        return token

    def consume(self, token: str, user_id: str) -> PendingAction | None:
        """Redeem a token (removing it) if it's live and owned by *user_id*."""
        pending = self._pending.pop(token, None)
        if pending is None or pending.user_id != user_id:
            return None
        return pending


def park_tool_call(
    gate: ConfirmationGate,
    *,
    name: str,
    args: dict[str, Any],
    call_id: str,
    user_id: str,
    messages: list[dict],
) -> ChatEvent:
    """Park a gated tool call and build its ``pending_confirmation`` event.

    Appends the stand-down tool result to *messages* (so the tool call is
    answered and the model explains instead of retrying) and returns the SSE
    event whose metadata carries the token to the UI. The token deliberately
    never enters the LLM context.
    """
    token = gate.create(name, args, user_id)
    messages.append(
        {
            "role": "tool",
            "tool_call_id": call_id,
            "content": json.dumps({"pending_confirmation": True, "message": _PENDING_MESSAGE}),
        }
    )
    logger.info("agent_tool_confirmation_pending", tool=name, user_id=user_id)
    return ChatEvent(
        type="tool",
        content="Waiting for your confirmation…",
        metadata={
            "status": "pending_confirmation",
            "action": name,
            "confirmation": {
                "token": token,
                "action": name,
                "summary": describe_action(name, args),
                "expires_in": CONFIRMATION_TTL_SECONDS,
            },
        },
    )


async def resolve_confirmation(
    gate: ConfirmationGate,
    token: str,
    *,
    user_id: str,
    api_client: ApiClient,
    llm: LLMProvider,
    messages: list[dict],
) -> AsyncGenerator[ChatEvent, None]:
    """Redeem *token* and execute its parked action before the agentic loop.

    Yields the same start/done tool events as a normal tool execution so the
    UI treats a confirmed action identically. Appends a bracketed user-role
    note to *messages* so the model reports the outcome instead of re-calling
    the tool. Invalid/expired tokens yield ``confirmation_failed`` and execute
    nothing.
    """
    pending = gate.consume(token, user_id)
    if pending is None:
        logger.warning("agent_tool_confirmation_invalid", user_id=user_id)
        messages.append(
            {
                "role": "user",
                "content": (
                    "[system note] The confirmation token was invalid or expired — "
                    "the action was NOT executed. Tell the user to ask again if "
                    "they still want it."
                ),
            }
        )
        yield ChatEvent(
            type="tool",
            content="Confirmation expired — the action was not executed.",
            metadata={"status": "confirmation_failed"},
        )
        return

    yield ChatEvent(
        type="tool",
        content=f"Running {pending.name}…",
        metadata={"status": "start", "action": pending.name},
    )
    result = await execute_tool(
        pending.name,
        pending.args,
        user_id=user_id,
        api_client=api_client,
        llm=llm,
    )
    messages.append(
        {
            "role": "user",
            "content": (
                f"[system note] The user confirmed via the confirmation UI and "
                f"the '{pending.name}' action was already executed. Result: "
                f"{json.dumps(result)}. Briefly report the outcome — do not call "
                f"the tool again."
            ),
        }
    )
    yield ChatEvent(
        type="tool",
        content=summarize_tool_result(pending.name, result),
        metadata={"status": "done", "action": pending.name},
    )
