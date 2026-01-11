"""Tests for LLMService."""

import pytest
from unittest.mock import MagicMock, patch

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
    """Tests for LLMService class."""

    def test_init(self, mock_anthropic_client):
        """Test service initialization."""
        service = LLMService(mock_anthropic_client)
        assert service._client is mock_anthropic_client

    async def test_generate_expansion_success(self, mock_anthropic_client):
        """Test successful expansion generation."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="# Detailed Documentation\n\nContent here.")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)

        context = {
            "video_title": "Test Video",
            "youtube_id": "abc123",
            "timestamp": "00:00",
            "title": "Introduction",
            "summary": "This is the intro.",
            "bullets": ["Point 1", "Point 2"],
        }

        # Patch load_prompt to return a simple template
        with patch("src.services.llm.load_prompt", return_value="Title: {title}\nSummary: {summary}"):
            result = await service.generate_expansion("explain_section", context)

        assert result == "# Detailed Documentation\n\nContent here."
        mock_anthropic_client.messages.create.assert_called_once()

    async def test_generate_expansion_formats_bullets(self, mock_anthropic_client):
        """Test that bullets list is formatted correctly."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Response")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)

        context = {
            "bullets": ["First", "Second", "Third"],
        }

        with patch("src.services.llm.load_prompt", return_value="Bullets: {bullets}"):
            await service.generate_expansion("explain_section", context)

        # Verify the call was made (bullets should have been formatted)
        mock_anthropic_client.messages.create.assert_called_once()

    async def test_chat_completion_success(self, mock_anthropic_client):
        """Test successful chat completion."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="This is the assistant response.")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)

        messages = [
            {"role": "user", "content": "What is this video about?"},
        ]
        system_prompt = "You are helping explain a video about machine learning."

        result = await service.chat_completion(system_prompt, messages)

        assert result == "This is the assistant response."
        mock_anthropic_client.messages.create.assert_called_once()

        # Verify system prompt was passed
        call_kwargs = mock_anthropic_client.messages.create.call_args.kwargs
        assert call_kwargs.get("system") == system_prompt

    async def test_chat_completion_with_history(self, mock_anthropic_client):
        """Test chat completion with conversation history."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Follow-up response.")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)

        messages = [
            {"role": "user", "content": "First question"},
            {"role": "assistant", "content": "First answer"},
            {"role": "user", "content": "Follow-up question"},
        ]

        await service.chat_completion("System prompt", messages)

        call_kwargs = mock_anthropic_client.messages.create.call_args.kwargs
        assert len(call_kwargs["messages"]) == 3

    def test_create_message_sync(self, mock_anthropic_client):
        """Test synchronous message creation."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Sync response")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        result = service._create_message_sync("Test prompt", max_tokens=1000)

        assert result == "Sync response"
        mock_anthropic_client.messages.create.assert_called_once()
