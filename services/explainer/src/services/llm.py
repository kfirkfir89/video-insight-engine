"""LLM service for vie-explainer using Anthropic Claude."""

import asyncio
import atexit
import concurrent.futures
import logging
from pathlib import Path

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

# Bounded thread pool to prevent exhaustion from concurrent streams.
# Max workers and timeout are configurable via environment variables.
_stream_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=settings.LLM_STREAM_MAX_WORKERS,
    thread_name_prefix="llm_stream"
)


def _shutdown_executor():
    """Shutdown the thread pool executor on process exit."""
    logger.info("Shutting down LLM stream executor...")
    _stream_executor.shutdown(wait=True, cancel_futures=True)
    logger.info("LLM stream executor shutdown complete")


# Register cleanup on process exit to prevent thread leaks
atexit.register(_shutdown_executor)

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
    """LLM service with proper async handling.

    Uses asyncio.to_thread() to run blocking Anthropic SDK calls
    without blocking the event loop.
    """

    def __init__(self, client: anthropic.Anthropic):
        self._client = client
        self._model = settings.ANTHROPIC_MODEL

    def _create_message_sync(
        self,
        prompt: str,
        max_tokens: int = 2000,
        system: str | None = None,
        messages: list[dict] | None = None,
    ) -> str:
        """Make synchronous LLM call (internal)."""
        if messages is None:
            messages = [{"role": "user", "content": prompt}]

        kwargs = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        response = self._client.messages.create(**kwargs)
        return response.content[0].text

    async def generate_expansion(self, template_name: str, context: dict) -> str:
        """Generate expansion using template.

        Args:
            template_name: Name of the prompt template to use
            context: Dictionary of variables to substitute in template

        Returns:
            Generated markdown content from Claude

        Raises:
            TimeoutError: If LLM call exceeds timeout
        """
        template = load_prompt(template_name)

        # Format bullets if present (convert list to string)
        if "bullets" in context and isinstance(context["bullets"], list):
            context = {**context, "bullets": "\n".join(f"- {b}" for b in context["bullets"])}

        prompt = template.format(**context)

        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await asyncio.to_thread(
                self._create_message_sync,
                prompt,
                2000,
            )

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
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await asyncio.to_thread(
                self._create_message_sync,
                "",  # prompt is empty when using messages
                2000,
                system_prompt,
                messages,
            )

    async def chat_completion_stream(
        self,
        system_prompt: str,
        messages: list[dict],
    ):
        """Stream chat completion tokens.

        Args:
            system_prompt: System prompt with context about the memorized item
            messages: List of message dicts with 'role' and 'content'

        Yields:
            String tokens as they are generated

        This uses the Anthropic streaming API for real-time token delivery.
        """
        kwargs = {
            "model": self._model,
            "max_tokens": 2000,
            "messages": messages,
            "system": system_prompt,
        }

        # Issue #8: Use bounded thread pool instead of creating new threads
        import queue

        q: queue.Queue[str | None] = queue.Queue()

        def producer():
            """Stream tokens from LLM into queue."""
            try:
                with self._client.messages.stream(**kwargs) as stream:
                    for text in stream.text_stream:
                        q.put(text)
            finally:
                q.put(None)  # Signal completion

        # Submit to bounded executor instead of creating unbounded threads
        _stream_executor.submit(producer)

        token_timeout = settings.LLM_STREAM_TOKEN_TIMEOUT_SECONDS
        while True:
            try:
                item = await asyncio.to_thread(q.get, timeout=token_timeout)
                if item is None:
                    break
                yield item
            except (TimeoutError, asyncio.TimeoutError, queue.Empty):
                # Timeout waiting for next token - stream is done or stalled
                logger.warning(
                    f"Stream token timeout after {token_timeout}s - stream may be stalled"
                )
                break
            except asyncio.CancelledError:
                # Task was cancelled - clean exit
                break


# Global instance for backward compatibility
# Will be replaced with DI in main.py
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Get or create LLM service instance."""
    global _llm_service
    if _llm_service is None:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        _llm_service = LLMService(client)
    return _llm_service


# Convenience functions for backward compatibility with existing tools
async def generate_expansion(template_name: str, context: dict) -> str:
    """Generate expansion (backward compatible wrapper)."""
    return await get_llm_service().generate_expansion(template_name, context)


async def chat_completion(system_prompt: str, messages: list[dict]) -> str:
    """Complete chat (backward compatible wrapper)."""
    return await get_llm_service().chat_completion(system_prompt, messages)


async def chat_completion_stream(system_prompt: str, messages: list[dict]):
    """Stream chat completion (backward compatible wrapper)."""
    async for token in get_llm_service().chat_completion_stream(system_prompt, messages):
        yield token
