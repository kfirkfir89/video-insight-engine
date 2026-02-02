"""explain_chat tool: Interactive conversation about memorized items."""

from datetime import datetime, timezone

from src.exceptions import ResourceNotFoundError, UnauthorizedError
from src.repositories.base import ChatRepositoryProtocol, MemorizedItemRepositoryProtocol
from src.services.llm import LLMService
from src.tools.chat_utils import build_system_prompt


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


async def explain_chat(
    memorized_item_id: str,
    user_id: str,
    message: str,
    memorized_item_repo: MemorizedItemRepositoryProtocol,
    chat_repo: ChatRepositoryProtocol,
    llm_service: LLMService,
    chat_id: str | None = None,
) -> dict:
    """Interactive conversation about a memorized item.

    Personalized per user, not cached.

    Args:
        memorized_item_id: ID of the memorized item
        user_id: ID of the user
        message: User's message
        memorized_item_repo: Repository for memorized items
        chat_repo: Repository for chats
        llm_service: LLM service for generation
        chat_id: Optional - continue existing chat

    Returns:
        Dict with response text and chat ID

    Raises:
        UnauthorizedError: If memorized item not owned by user
        ResourceNotFoundError: If chat not found
    """
    # 1. Load memorized item (verify user ownership)
    item = await memorized_item_repo.find_by_id_and_user(memorized_item_id, user_id)
    if not item:
        raise UnauthorizedError("Memorized item not found or unauthorized")

    # 2. Load or create chat
    if chat_id:
        chat = await chat_repo.find_by_id_and_user(chat_id, user_id)
        if not chat:
            raise ResourceNotFoundError("Chat not found", resource_type="chat")
        chat_messages = chat.messages
    else:
        chat_id = await chat_repo.create(user_id, memorized_item_id)
        chat_messages = []

    # 3. Build messages for LLM
    system_prompt = build_system_prompt(item)

    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in chat_messages
    ]
    messages.append({"role": "user", "content": message})

    # 4. Call LLM
    response = await llm_service.chat_completion(system_prompt, messages)

    # 5. Save messages to chat
    now = _utc_now()
    await chat_repo.add_messages(
        chat_id,
        [
            {"role": "user", "content": message, "createdAt": now},
            {"role": "assistant", "content": response, "createdAt": now},
        ],
    )

    return {
        "response": response,
        "chatId": chat_id,
    }
