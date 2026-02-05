"""Tests for explain_chat tool."""

import pytest
from unittest.mock import patch

from src.exceptions import ResourceNotFoundError, UnauthorizedError
from src.tools.chat_utils import build_system_prompt, format_content
from src.tools.explain_chat import explain_chat


class TestFormatContent:
    """Tests for format_content helper."""

    def test_formats_sections(self):
        """Test formatting of sections content."""
        source = {
            "content": {
                "sections": [
                    {
                        "title": "Introduction",
                        "timestamp": "00:00",
                        "content": [
                            {"type": "paragraph", "text": "Intro summary"},
                            {"type": "bullets", "items": ["Point 1", "Point 2"]},
                        ],
                    }
                ]
            }
        }

        result = format_content(source)

        assert "## Introduction (00:00)" in result
        assert "Intro summary" in result
        assert "- Point 1" in result
        assert "- Point 2" in result

    def test_formats_concept(self):
        """Test formatting of concept content."""
        source = {
            "content": {
                "concept": {
                    "name": "Machine Learning",
                    "definition": "A type of AI",
                }
            }
        }

        result = format_content(source)

        assert "## Concept: Machine Learning" in result
        assert "A type of AI" in result

    def test_formats_expansion(self):
        """Test formatting of expansion content."""
        source = {
            "content": {
                "expansion": "# Detailed Explanation\n\nThis is expanded content."
            }
        }

        result = format_content(source)

        assert "## Detailed Explanation" in result
        assert "This is expanded content." in result

    def test_handles_empty_content(self):
        """Test handling of empty content."""
        source = {"content": {}}
        result = format_content(source)
        assert result == ""


class TestBuildSystemPrompt:
    """Tests for build_system_prompt helper."""

    @patch("src.tools.explain_chat.load_prompt")
    def test_builds_prompt_from_item(self, mock_load_prompt, sample_memorized_item):
        """Test system prompt building."""
        mock_load_prompt.return_value = (
            "Title: {title}\nVideo: {video_title}\nURL: {youtube_url}\n"
            "Content: {content}\nNotes: {notes}"
        )

        result = build_system_prompt(sample_memorized_item)

        assert "Saved ML Content" in result
        assert "Test Video Title" in result
        assert "My personal notes" in result


class TestExplainChat:
    """Tests for explain_chat function with dependency injection."""

    async def test_creates_new_chat_success(
        self,
        mock_memorized_item_repo,
        mock_chat_repo,
        mock_llm_service,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test successful chat creation."""
        mock_memorized_item_repo.find_by_id_and_user.return_value = sample_memorized_item
        mock_chat_repo.create.return_value = "new-chat-id"
        mock_llm_service.chat_completion.return_value = "This is the assistant response."

        result = await explain_chat(
            memorized_item_id=sample_memorized_item.id,
            user_id=sample_user_id,
            message="What is this about?",
            memorized_item_repo=mock_memorized_item_repo,
            chat_repo=mock_chat_repo,
            llm_service=mock_llm_service,
        )

        assert result["response"] == "This is the assistant response."
        assert result["chatId"] == "new-chat-id"
        mock_chat_repo.create.assert_called_once()
        mock_chat_repo.add_messages.assert_called_once()

    async def test_continues_existing_chat(
        self,
        mock_memorized_item_repo,
        mock_chat_repo,
        mock_llm_service,
        sample_user_id,
        sample_memorized_item,
        sample_chat,
    ):
        """Test continuing existing chat."""
        mock_memorized_item_repo.find_by_id_and_user.return_value = sample_memorized_item
        mock_chat_repo.find_by_id_and_user.return_value = sample_chat
        mock_llm_service.chat_completion.return_value = "Follow-up response."

        result = await explain_chat(
            memorized_item_id=sample_memorized_item.id,
            user_id=sample_user_id,
            message="Tell me more.",
            memorized_item_repo=mock_memorized_item_repo,
            chat_repo=mock_chat_repo,
            llm_service=mock_llm_service,
            chat_id=sample_chat.id,
        )

        assert result["response"] == "Follow-up response."
        assert result["chatId"] == sample_chat.id
        mock_chat_repo.create.assert_not_called()

        # Verify messages include history
        mock_llm_service.chat_completion.assert_called_once()
        call_args = mock_llm_service.chat_completion.call_args
        messages = call_args[0][1]
        assert len(messages) == 3  # 2 history + 1 new

    async def test_raises_error_item_not_found(
        self,
        mock_memorized_item_repo,
        mock_chat_repo,
        mock_llm_service,
        sample_user_id,
    ):
        """Test error when memorized item not found."""
        mock_memorized_item_repo.find_by_id_and_user.return_value = None

        with pytest.raises(UnauthorizedError, match="Memorized item not found"):
            await explain_chat(
                memorized_item_id="some-item-id",
                user_id=sample_user_id,
                message="Hello",
                memorized_item_repo=mock_memorized_item_repo,
                chat_repo=mock_chat_repo,
                llm_service=mock_llm_service,
            )

    async def test_raises_error_chat_not_found(
        self,
        mock_memorized_item_repo,
        mock_chat_repo,
        mock_llm_service,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test error when chat not found."""
        mock_memorized_item_repo.find_by_id_and_user.return_value = sample_memorized_item
        mock_chat_repo.find_by_id_and_user.return_value = None

        with pytest.raises(ResourceNotFoundError, match="Chat not found"):
            await explain_chat(
                memorized_item_id=sample_memorized_item.id,
                user_id=sample_user_id,
                message="Hello",
                memorized_item_repo=mock_memorized_item_repo,
                chat_repo=mock_chat_repo,
                llm_service=mock_llm_service,
                chat_id="nonexistent-chat-id",
            )

    async def test_saves_both_messages(
        self,
        mock_memorized_item_repo,
        mock_chat_repo,
        mock_llm_service,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test that both user and assistant messages are saved."""
        mock_memorized_item_repo.find_by_id_and_user.return_value = sample_memorized_item
        mock_chat_repo.create.return_value = "new-chat-id"
        mock_llm_service.chat_completion.return_value = "Assistant response"

        await explain_chat(
            memorized_item_id=sample_memorized_item.id,
            user_id=sample_user_id,
            message="User message",
            memorized_item_repo=mock_memorized_item_repo,
            chat_repo=mock_chat_repo,
            llm_service=mock_llm_service,
        )

        # Verify add_messages was called with both messages
        mock_chat_repo.add_messages.assert_called_once()
        call_args = mock_chat_repo.add_messages.call_args
        messages = call_args[0][1]

        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "User message"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["content"] == "Assistant response"
