"""explain_chat_stream tool: Streaming interactive conversation about memorized items."""

from datetime import datetime, timezone
from typing import AsyncGenerator

from src.exceptions import ResourceNotFoundError, UnauthorizedError
from src.services import mongodb
from src.services.llm import chat_completion_stream, load_prompt


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


def format_content(source: dict) -> str:
    """Format memorized item content for prompt.

    Args:
        source: Source data from memorized item

    Returns:
        Formatted content string for the system prompt
    """
    content_parts = []
    content = source.get("content", {})

    # Sections
    if "sections" in content:
        for section in content["sections"]:
            content_parts.append(
                f"## {section.get('title', 'Section')} ({section.get('timestamp', '')})"
            )
            content_parts.append(section.get("summary", ""))
            if section.get("bullets"):
                content_parts.append("Key points:")
                for bullet in section["bullets"]:
                    content_parts.append(f"- {bullet}")
            content_parts.append("")

    # Concept
    if "concept" in content:
        concept = content["concept"]
        content_parts.append(f"## Concept: {concept.get('name', '')}")
        content_parts.append(concept.get("definition", ""))

    # Expansion
    if "expansion" in content:
        content_parts.append("## Detailed Explanation")
        content_parts.append(content["expansion"])

    return "\n".join(content_parts)


def build_system_prompt(item: dict) -> str:
    """Build system prompt from memorized item.

    Args:
        item: Memorized item document

    Returns:
        Formatted system prompt string
    """
    source = item.get("source", {})

    return load_prompt("chat_system").format(
        title=item.get("title", "Saved Content"),
        video_title=source.get("videoTitle", "Unknown Video"),
        youtube_url=source.get("youtubeUrl", ""),
        content=format_content(source),
        notes=item.get("notes") or "None",
    )


async def explain_chat_stream(
    memorized_item_id: str,
    user_id: str,
    message: str,
    chat_id: str | None = None,
) -> AsyncGenerator[tuple[str, str], None]:
    """Stream interactive conversation about a memorized item.

    Personalized per user, not cached.

    Args:
        memorized_item_id: ID of the memorized item
        user_id: ID of the user
        message: User's message
        chat_id: Optional - continue existing chat

    Yields:
        Tuple of (token, chat_id) for each streamed token

    Raises:
        UnauthorizedError: If memorized item not owned by user
        ResourceNotFoundError: If chat not found
    """
    # 1. Load memorized item (verify user ownership)
    item = mongodb.get_memorized_item(memorized_item_id, user_id)
    if not item:
        raise UnauthorizedError("Memorized item not found or unauthorized")

    # 2. Load or create chat
    if chat_id:
        chat = mongodb.get_chat(chat_id, user_id)
        if not chat:
            raise ResourceNotFoundError("Chat not found", resource_type="chat")
    else:
        chat_id = mongodb.create_chat(user_id, memorized_item_id)
        chat = {"messages": []}

    # 3. Build messages for LLM
    system_prompt = build_system_prompt(item)

    messages = []
    for msg in chat.get("messages", []):
        messages.append(
            {
                "role": msg["role"],
                "content": msg["content"],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": message,
        }
    )

    # 4. Stream LLM response
    full_response = ""
    async for token in chat_completion_stream(system_prompt, messages):
        full_response += token
        yield token, chat_id

    # 5. Save messages to chat after streaming completes
    now = _utc_now()
    mongodb.add_messages(
        chat_id,
        [
            {"role": "user", "content": message, "createdAt": now},
            {"role": "assistant", "content": full_response, "createdAt": now},
        ],
    )
