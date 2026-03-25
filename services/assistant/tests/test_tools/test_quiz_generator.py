"""Tests for the quiz generator tool."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from src.exceptions import LLMError
from src.repositories.video_repository import VideoContext
from src.tools.quiz_generator import QuizGeneratorTool


def _make_video_ctx() -> VideoContext:
    return VideoContext(
        id="vid1",
        youtube_id="yt1",
        title="Python for Beginners",
        creator="Code Academy",
        summary="A beginner's guide to Python covering variables, loops, and functions.",
        takeaways=["Variables store data", "Loops repeat actions", "Functions organize code"],
        tabs=[],
        output_data=None,
    )


def _valid_quiz_json(n: int = 3) -> str:
    questions = [
        {
            "question": f"Question {i + 1}?",
            "options": ["A", "B", "C", "D"],
            "correct_index": i % 4,
            "explanation": f"Because answer {i + 1} is correct.",
        }
        for i in range(n)
    ]
    return json.dumps({"questions": questions})


class TestQuizGenerator:
    """Quiz generator tool tests."""

    async def test_should_return_quiz_questions(self) -> None:
        """Should return parsed quiz questions from the LLM response."""
        # Arrange
        llm = AsyncMock()
        mock_fast_llm = AsyncMock()
        mock_fast_llm.complete_with_messages.return_value = _valid_quiz_json(3)

        tool = QuizGeneratorTool(llm=llm)
        params = {"topic": "variables"}
        context = {"video_ctx": _make_video_ctx()}

        # Act — patch LLMProvider constructor to return our mock
        with patch("src.tools.quiz_generator.LLMProvider", return_value=mock_fast_llm):
            result = await tool.execute(params, context)

        # Assert
        assert len(result["questions"]) == 3
        assert result["questions"][0]["question"] == "Question 1?"
        assert len(result["questions"][0]["options"]) == 4
        assert isinstance(result["questions"][0]["correct_index"], int)

    async def test_should_respect_num_questions_param(self) -> None:
        """Should pass the requested number of questions to the prompt."""
        # Arrange
        llm = AsyncMock()
        mock_fast_llm = AsyncMock()
        mock_fast_llm.complete_with_messages.return_value = _valid_quiz_json(2)

        tool = QuizGeneratorTool(llm=llm)
        params = {"num_questions": 2}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        with patch("src.tools.quiz_generator.LLMProvider", return_value=mock_fast_llm):
            result = await tool.execute(params, context)

        # Assert
        call_args = mock_fast_llm.complete_with_messages.call_args
        system_content = call_args.kwargs["messages"][0]["content"]
        assert "2 quiz questions" in system_content

    async def test_should_handle_invalid_json_from_llm(self) -> None:
        """Should return empty questions list when LLM returns non-JSON."""
        # Arrange
        llm = AsyncMock()
        mock_fast_llm = AsyncMock()
        mock_fast_llm.complete_with_messages.return_value = "This is not valid JSON at all."

        tool = QuizGeneratorTool(llm=llm)
        params = {}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        with patch("src.tools.quiz_generator.LLMProvider", return_value=mock_fast_llm):
            result = await tool.execute(params, context)

        # Assert — gracefully returns empty list instead of crashing
        assert result["questions"] == []

    async def test_should_use_fast_model(self) -> None:
        """Should create a new LLMProvider with the fast model setting."""
        # Arrange
        llm = AsyncMock()
        mock_fast_llm = AsyncMock()
        mock_fast_llm.complete_with_messages.return_value = _valid_quiz_json(1)

        tool = QuizGeneratorTool(llm=llm)
        params = {}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        with patch("src.tools.quiz_generator.LLMProvider", return_value=mock_fast_llm) as mock_cls, \
             patch("src.tools.quiz_generator.settings") as mock_settings:
            mock_settings.llm_fast_model = "anthropic/claude-3-5-haiku-20241022"
            mock_settings.llm_fallback_models = None
            await tool.execute(params, context)

        # Assert — LLMProvider was constructed with the fast model
        mock_cls.assert_called_once_with(
            model=mock_settings.llm_fast_model,
            fallback_models=mock_settings.llm_fallback_models,
        )
