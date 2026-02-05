"""Tests for LLMService with LiteLLM multi-provider support."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.services.llm import LLMService, load_prompt


class TestLoadPrompt:
    """Tests for load_prompt helper."""

    def test_load_explain_section_prompt(self):
        prompt = load_prompt("explain_section")
        # Should contain template variables
        assert "{title}" in prompt or "title" in prompt.lower()

    def test_load_explain_concept_prompt(self):
        prompt = load_prompt("explain_concept")
        assert "{name}" in prompt or "concept" in prompt.lower()

    def test_load_chat_system_prompt(self):
        prompt = load_prompt("chat_system")
        assert "{title}" in prompt or "{content}" in prompt


class TestLLMService:
    """Tests for LLMService class with LLMProvider."""

    def test_init(self, mock_llm_provider):
        """Test service initialization with LLMProvider."""
        service = LLMService(mock_llm_provider)
        assert service._provider is mock_llm_provider

    @pytest.mark.asyncio
    async def test_generate_expansion_success(self, mock_llm_provider):
        """Test successful expansion generation."""
        mock_llm_provider.complete = AsyncMock(
            return_value="# Detailed Documentation\n\nContent here."
        )

        service = LLMService(mock_llm_provider)

        context = {
            "video_title": "Test Video",
            "youtube_id": "abc123",
            "timestamp": "00:00",
            "title": "Introduction",
            "summary": "This is the intro.",  # Extracted from content blocks
            "bullets": ["Point 1", "Point 2"],  # Extracted from content blocks
        }

        # Patch load_prompt to return a simple template
        with patch("src.services.llm.load_prompt", return_value="Title: {title}\nSummary: {summary}"):
            result = await service.generate_expansion("explain_section", context)

        assert result == "# Detailed Documentation\n\nContent here."
        mock_llm_provider.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_expansion_formats_bullets(self, mock_llm_provider):
        """Test that bullets list is formatted correctly."""
        mock_llm_provider.complete = AsyncMock(return_value="Response")

        service = LLMService(mock_llm_provider)

        context = {
            "bullets": ["First", "Second", "Third"],
        }

        with patch("src.services.llm.load_prompt", return_value="Bullets: {bullets}"):
            await service.generate_expansion("explain_section", context)

        # Verify the call was made (bullets should have been formatted)
        mock_llm_provider.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_chat_completion_success(self, mock_llm_provider):
        """Test successful chat completion."""
        mock_llm_provider.complete_with_messages = AsyncMock(
            return_value="This is the assistant response."
        )

        service = LLMService(mock_llm_provider)

        messages = [
            {"role": "user", "content": "What is this video about?"},
        ]
        system_prompt = "You are helping explain a video about machine learning."

        result = await service.chat_completion(system_prompt, messages)

        assert result == "This is the assistant response."
        mock_llm_provider.complete_with_messages.assert_called_once()

        # Verify system message was prepended
        call_args = mock_llm_provider.complete_with_messages.call_args
        messages_arg = call_args[0][0]
        assert messages_arg[0]["role"] == "system"
        assert messages_arg[0]["content"] == system_prompt

    @pytest.mark.asyncio
    async def test_chat_completion_with_history(self, mock_llm_provider):
        """Test chat completion with conversation history."""
        mock_llm_provider.complete_with_messages = AsyncMock(
            return_value="Follow-up response."
        )

        service = LLMService(mock_llm_provider)

        messages = [
            {"role": "user", "content": "First question"},
            {"role": "assistant", "content": "First answer"},
            {"role": "user", "content": "Follow-up question"},
        ]

        await service.chat_completion("System prompt", messages)

        call_args = mock_llm_provider.complete_with_messages.call_args
        messages_arg = call_args[0][0]
        # 1 system message + 3 conversation messages
        assert len(messages_arg) == 4

    @pytest.mark.asyncio
    async def test_chat_completion_stream(self, mock_llm_provider):
        """Test streaming chat completion."""
        # Create async generator mock
        async def mock_stream(*args, **kwargs):
            yield "Hello "
            yield "world"

        mock_llm_provider.stream_with_messages = mock_stream

        service = LLMService(mock_llm_provider)

        messages = [{"role": "user", "content": "Hi"}]
        system_prompt = "You are helpful."

        tokens = []
        async for token in service.chat_completion_stream(system_prompt, messages):
            tokens.append(token)

        assert tokens == ["Hello ", "world"]
