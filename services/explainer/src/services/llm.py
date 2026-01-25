"""LLM service for vie-explainer using LiteLLM multi-provider support.

Supports Anthropic, OpenAI, and Gemini with automatic fallbacks.
"""

import asyncio
import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from src.config import settings
from src.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

# Prompts directory
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file.

    Args:
        name: Name of the prompt file (without .txt extension)

    Returns:
        Contents of the prompt template file
    """
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


class LLMService:
    """LLM service with native async handling via LiteLLM.

    Uses LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
    All API calls are native async - no threading required.
    """

    def __init__(self, provider: LLMProvider):
        """Initialize LLM service.

        Args:
            provider: LLMProvider instance for making LLM calls
        """
        self._provider = provider

    async def generate_expansion(self, template_name: str, context: dict) -> str:
        """Generate expansion using template.

        Args:
            template_name: Name of the prompt template to use
            context: Dictionary of variables to substitute in template

        Returns:
            Generated markdown content

        Raises:
            TimeoutError: If LLM call exceeds timeout
        """
        template = load_prompt(template_name)

        # Format bullets if present (convert list to string)
        if "bullets" in context and isinstance(context["bullets"], list):
            context = {**context, "bullets": "\n".join(f"- {b}" for b in context["bullets"])}

        prompt = template.format(**context)

        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete(prompt, max_tokens=2000)

    async def chat_completion(self, system_prompt: str, messages: list[dict]) -> str:
        """Complete chat with context.

        Args:
            system_prompt: System prompt with context about the memorized item
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Assistant's response text

        Raises:
            TimeoutError: If LLM call exceeds timeout
        """
        # Prepend system message to messages
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete_with_messages(
                full_messages, max_tokens=2000
            )

    async def chat_completion_stream(
        self,
        system_prompt: str,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion tokens.

        Args:
            system_prompt: System prompt with context about the memorized item
            messages: List of message dicts with 'role' and 'content'

        Yields:
            String tokens as they are generated

        This uses LiteLLM's native async streaming - no threading required.
        """
        # Prepend system message to messages
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            async for token in self._provider.stream_with_messages(
                full_messages, max_tokens=2000
            ):
                yield token
        except asyncio.CancelledError:
            # Task was cancelled - clean exit
            pass
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            raise


# Global instance for backward compatibility
# Will be replaced with DI in main.py
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Get or create LLM service instance."""
    global _llm_service
    if _llm_service is None:
        provider = LLMProvider()
        _llm_service = LLMService(provider)
    return _llm_service


# Convenience functions for backward compatibility with existing tools
async def generate_expansion(template_name: str, context: dict) -> str:
    """Generate expansion (backward compatible wrapper)."""
    return await get_llm_service().generate_expansion(template_name, context)


async def chat_completion(system_prompt: str, messages: list[dict]) -> str:
    """Complete chat (backward compatible wrapper)."""
    return await get_llm_service().chat_completion(system_prompt, messages)


async def chat_completion_stream(
    system_prompt: str, messages: list[dict]
) -> AsyncGenerator[str, None]:
    """Stream chat completion (backward compatible wrapper)."""
    async for token in get_llm_service().chat_completion_stream(system_prompt, messages):
        yield token
