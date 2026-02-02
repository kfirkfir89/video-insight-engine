"""explain_chat_stream tool: Streaming interactive conversation about memorized items."""

from datetime import datetime, timezone
from typing import AsyncGenerator

from src.exceptions import ResourceNotFoundError, UnauthorizedError
from src.repositories.base import ChatRepositoryProtocol, MemorizedItemRepositoryProtocol
from src.services.llm import LLMService
from src.tools.chat_utils import build_system_prompt


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


async def explain_chat_stream(
    memorized_item_id: str,
    user_id: str,
    message: str,
    memorized_item_repo: MemorizedItemRepositoryProtocol,
    chat_repo: ChatRepositoryProtocol,
    llm_service: LLMService,
    chat_id: str | None = None,
) -> AsyncGenerator[tuple[str, str], None]:
    """Stream interactive conversation about a memorized item.

    Personalized per user, not cached.

    Args:
        memorized_item_id: ID of the memorized item
        user_id: ID of the user
        message: User's message
        memorized_item_repo: Repository for memorized items
        chat_repo: Repository for chats
        llm_service: LLM service for generation
        chat_id: Optional - continue existing chat

    Yields:
        Tuple of (token, chat_id) for each streamed token

    Raises:
        UnauthorizedError: If memorized item not owned by user
        ResourceNotFoundError: If chat not found
    """
    # 1. Load memorized item (verify user ownership)
    item = await memorized_item_repo.find_by_id_and_user(memorized_item_id, user_id)
    if not item:
        raise UnauthorizedError("Memorized item not found or unauthorized")

    # 2. Load or create chat
    active_chat_id: str
    if chat_id:
        chat = await chat_repo.find_by_id_and_user(chat_id, user_id)
        if not chat:
            raise ResourceNotFoundError("Chat not found", resource_type="chat")
        chat_messages = chat.messages
        active_chat_id = chat_id
    else:
        active_chat_id = await chat_repo.create(user_id, memorized_item_id)
        chat_messages = []

    # 3. Build messages for LLM
    system_prompt = build_system_prompt(item)

    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in chat_messages
    ]
    messages.append({"role": "user", "content": message})

    # 4. Stream LLM response
    full_response = ""
    async for token in llm_service.chat_completion_stream(system_prompt, messages):
        full_response += token
        yield token, active_chat_id

    # 5. Save messages to chat after streaming completes
    now = _utc_now()
    await chat_repo.add_messages(
        active_chat_id,
        [
            {"role": "user", "content": message, "createdAt": now},
            {"role": "assistant", "content": full_response, "createdAt": now},
        ],
    )
