"""Tests for explain_chat tool."""

import pytest
from unittest.mock import patch, AsyncMock

from src.tools.explain_chat import (
    explain_chat,
    format_content,
    build_system_prompt,
)


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
                        "summary": "Intro summary",
                        "bullets": ["Point 1", "Point 2"],
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

    @patch("src.tools.explain_chat.load_prompt")
    def test_handles_missing_notes(self, mock_load_prompt):
        """Test handling of missing notes."""
        mock_load_prompt.return_value = "Notes: {notes}"
        item = {
            "title": "Test",
            "notes": None,
            "source": {"videoTitle": "Video", "youtubeUrl": "url", "content": {}},
        }

        result = build_system_prompt(item)
        assert "None" in result


class TestExplainChat:
    """Tests for explain_chat function."""

    @patch("src.tools.explain_chat.mongodb")
    @patch("src.tools.explain_chat.chat_completion", new_callable=AsyncMock)
    async def test_creates_new_chat_success(
        self,
        mock_chat_completion,
        mock_mongodb,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test successful chat creation."""
        mock_mongodb.get_memorized_item.return_value = sample_memorized_item
        mock_mongodb.create_chat.return_value = "new-chat-id"
        mock_chat_completion.return_value = "This is the assistant response."

        result = await explain_chat(
            memorized_item_id=str(sample_memorized_item["_id"]),
            user_id=sample_user_id,
            message="What is this about?",
        )

        assert result["response"] == "This is the assistant response."
        assert result["chatId"] == "new-chat-id"
        mock_mongodb.create_chat.assert_called_once()
        mock_mongodb.add_messages.assert_called_once()

    @patch("src.tools.explain_chat.mongodb")
    @patch("src.tools.explain_chat.chat_completion", new_callable=AsyncMock)
    async def test_continues_existing_chat(
        self,
        mock_chat_completion,
        mock_mongodb,
        sample_user_id,
        sample_memorized_item,
        sample_chat,
    ):
        """Test continuing existing chat."""
        mock_mongodb.get_memorized_item.return_value = sample_memorized_item
        mock_mongodb.get_chat.return_value = sample_chat
        mock_chat_completion.return_value = "Follow-up response."

        chat_id = str(sample_chat["_id"])

        result = await explain_chat(
            memorized_item_id=str(sample_memorized_item["_id"]),
            user_id=sample_user_id,
            message="Tell me more.",
            chat_id=chat_id,
        )

        assert result["response"] == "Follow-up response."
        assert result["chatId"] == chat_id
        mock_mongodb.create_chat.assert_not_called()

        # Verify messages include history
        mock_chat_completion.assert_called_once()
        call_args = mock_chat_completion.call_args
        messages = call_args[0][1]
        assert len(messages) == 3  # 2 history + 1 new

    @patch("src.tools.explain_chat.mongodb")
    async def test_raises_error_item_not_found(
        self,
        mock_mongodb,
        sample_user_id,
    ):
        """Test error when memorized item not found."""
        mock_mongodb.get_memorized_item.return_value = None

        with pytest.raises(ValueError, match="Memorized item not found"):
            await explain_chat(
                memorized_item_id="some-item-id",
                user_id=sample_user_id,
                message="Hello",
            )

    @patch("src.tools.explain_chat.mongodb")
    async def test_raises_error_chat_not_found(
        self,
        mock_mongodb,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test error when chat not found."""
        mock_mongodb.get_memorized_item.return_value = sample_memorized_item
        mock_mongodb.get_chat.return_value = None

        with pytest.raises(ValueError, match="Chat not found"):
            await explain_chat(
                memorized_item_id=str(sample_memorized_item["_id"]),
                user_id=sample_user_id,
                message="Hello",
                chat_id="nonexistent-chat-id",
            )

    @patch("src.tools.explain_chat.mongodb")
    @patch("src.tools.explain_chat.chat_completion", new_callable=AsyncMock)
    async def test_saves_both_messages(
        self,
        mock_chat_completion,
        mock_mongodb,
        sample_user_id,
        sample_memorized_item,
    ):
        """Test that both user and assistant messages are saved."""
        mock_mongodb.get_memorized_item.return_value = sample_memorized_item
        mock_mongodb.create_chat.return_value = "new-chat-id"
        mock_chat_completion.return_value = "Assistant response"

        await explain_chat(
            memorized_item_id=str(sample_memorized_item["_id"]),
            user_id=sample_user_id,
            message="User message",
        )

        # Verify add_messages was called with both messages
        mock_mongodb.add_messages.assert_called_once()
        call_args = mock_mongodb.add_messages.call_args
        messages = call_args[0][1]

        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "User message"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["content"] == "Assistant response"
