"""LLM service for video summarization.

Uses LiteLLM via LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
Pipeline modules (triage, extractor, enrichment, synthesis) use call_llm()
for all LLM interactions.
"""

import asyncio
import logging
from typing import AsyncGenerator

from src.config import settings
from src.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM-based video processing.

    Uses LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
    All API calls are native async via LiteLLM's acompletion().
    """

    def __init__(self, provider: LLMProvider):
        self._provider = provider

    @property
    def provider(self) -> LLMProvider:
        """Get the underlying LLM provider."""
        return self._provider

    @property
    def fast_model(self) -> str:
        """Get the configured fast model from the provider."""
        return self._provider.fast_model

    async def call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        """Make an async LLM call.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response

        Returns:
            Generated text content

        Raises:
            TimeoutError: If LLM call exceeds configured timeout
        """
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete(prompt, max_tokens=max_tokens)

    async def stream_llm(
        self, prompt: str, max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Stream LLM response tokens.

        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens in response

        Yields:
            String tokens as they are generated
        """
        try:
            async for token in self._provider.stream(prompt, max_tokens=max_tokens):
                yield token
        except asyncio.CancelledError:
            logger.debug("LLM streaming cancelled")
        except Exception as e:
            logger.error("Error during streaming: %s", e)
            raise
