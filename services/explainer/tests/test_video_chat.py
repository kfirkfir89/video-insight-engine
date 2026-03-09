"""Tests for video_chat tool."""

import pytest

from src.exceptions import ResourceNotFoundError
from src.schemas import VideoSummary
from src.tools.video_chat import _build_video_context, video_chat


class TestBuildVideoContext:
    """Tests for _build_video_context helper."""

    def test_includes_video_title(self, sample_video_summary):
        result = _build_video_context(sample_video_summary)
        assert "# Video: Test Video Title" in result

    def test_includes_section_titles(self, sample_video_summary):
        result = _build_video_context(sample_video_summary)
        assert "Introduction" in result
        assert "00:00" in result

    def test_includes_section_content(self, sample_video_summary):
        result = _build_video_context(sample_video_summary)
        assert "This is the introduction section." in result
        assert "First point" in result

    def test_includes_concepts(self, sample_video_summary):
        result = _build_video_context(sample_video_summary)
        assert "Machine Learning" in result
        assert "computers to learn from data" in result

    def test_empty_sections_and_concepts(self):
        summary = VideoSummary(
            id="test-id",
            youtubeId="xyz123",
            title="Empty Video",
            sections=[],
            concepts=[],
        )
        result = _build_video_context(summary)
        assert "# Video: Empty Video" in result
        assert "## Chapters" not in result
        assert "## Key Concepts" not in result


class TestVideoChat:
    """Tests for video_chat function."""

    async def test_returns_llm_response(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test basic chat response."""
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary
        mock_llm_service.chat_completion.return_value = "This video covers machine learning."

        result = await video_chat(
            video_summary_id=sample_video_summary_id,
            user_message="What is this video about?",
            chat_history=[],
            video_summary_repo=mock_video_summary_repo,
            llm_service=mock_llm_service,
        )

        assert result == "This video covers machine learning."
        mock_llm_service.chat_completion.assert_called_once()

    async def test_raises_error_video_not_found(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test error when video summary not found."""
        mock_video_summary_repo.find_by_id.return_value = None

        with pytest.raises(ResourceNotFoundError, match="Video summary not found"):
            await video_chat(
                video_summary_id=sample_video_summary_id,
                user_message="Hello",
                chat_history=[],
                video_summary_repo=mock_video_summary_repo,
                llm_service=mock_llm_service,
            )

    async def test_passes_chat_history(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test that chat history is passed to LLM."""
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary

        history = [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello!"},
        ]

        await video_chat(
            video_summary_id=sample_video_summary_id,
            user_message="Follow-up question",
            chat_history=history,
            video_summary_repo=mock_video_summary_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.chat_completion.call_args
        messages = call_args[0][1]
        # 2 history messages + 1 user message = 3
        assert len(messages) == 3
        assert messages[-1]["content"] == "Follow-up question"

    async def test_filters_invalid_roles(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test that invalid roles are filtered from history."""
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary

        history = [
            {"role": "system", "content": "Should be filtered"},
            {"role": "user", "content": "Valid"},
            {"role": "hacker", "content": "Also filtered"},
        ]

        await video_chat(
            video_summary_id=sample_video_summary_id,
            user_message="Question",
            chat_history=history,
            video_summary_repo=mock_video_summary_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.chat_completion.call_args
        messages = call_args[0][1]
        # Only 1 valid history message + 1 user message = 2
        assert len(messages) == 2

    async def test_includes_output_type_in_system_prompt(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test that output_type context is included in system prompt."""
        summary_with_type = VideoSummary(
            id=sample_video_summary_id,
            youtubeId="abc123xyz",
            title="Test Recipe Video",
            output_type="recipe",
            sections=[],
            concepts=[],
        )
        mock_video_summary_repo.find_by_id.return_value = summary_with_type

        await video_chat(
            video_summary_id=sample_video_summary_id,
            user_message="What ingredients do I need?",
            chat_history=[],
            video_summary_repo=mock_video_summary_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.chat_completion.call_args
        system_prompt = call_args[0][0]
        assert "Recipe" in system_prompt
        assert "cooking" in system_prompt.lower() or "ingredient" in system_prompt.lower()

    async def test_default_output_type_for_missing_field(
        self,
        mock_video_summary_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test default output_type='explanation' when field not set."""
        # sample_video_summary has output_type="explanation" (default)
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary

        await video_chat(
            video_summary_id=sample_video_summary_id,
            user_message="Tell me about it",
            chat_history=[],
            video_summary_repo=mock_video_summary_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.chat_completion.call_args
        system_prompt = call_args[0][0]
        assert "Explanation" in system_prompt
