"""Tests for ContentTraits parsing in the classifier."""

import pytest
from unittest.mock import AsyncMock, patch

from src.services.pipeline.classifier import (
    ContentTraits,
    classify_domain_format,
)


class TestContentTraits:
    def test_from_dict_full(self):
        data = {
            "has_steps": True,
            "has_drills": True,
            "has_comparison": False,
            "has_narrative": False,
            "has_code": True,
            "has_visual_demo": False,
            "is_opinionated": False,
            "is_list": True,
        }
        traits = ContentTraits.from_dict(data)
        assert traits.has_steps is True
        assert traits.has_drills is True
        assert traits.has_code is True
        assert traits.is_list is True
        assert traits.has_comparison is False

    def test_from_dict_missing_defaults_false(self):
        traits = ContentTraits.from_dict({"has_steps": True})
        assert traits.has_steps is True
        assert traits.has_drills is False
        assert traits.has_code is False

    def test_from_dict_empty(self):
        traits = ContentTraits.from_dict({})
        assert traits.has_steps is False
        assert traits.has_drills is False

    def test_from_dict_none(self):
        traits = ContentTraits.from_dict(None)
        assert traits.has_steps is False

    def test_from_dict_non_dict(self):
        traits = ContentTraits.from_dict("not a dict")
        assert traits.has_steps is False

    def test_bool_coercion(self):
        traits = ContentTraits.from_dict({"has_steps": 1, "has_drills": 0, "has_code": "yes"})
        assert traits.has_steps is True
        assert traits.has_drills is False
        assert traits.has_code is True

    def test_active_traits(self):
        traits = ContentTraits(has_steps=True, has_code=True)
        active = traits.active_traits()
        assert "has_steps" in active
        assert "has_code" in active
        assert "has_drills" not in active

    def test_active_traits_empty(self):
        traits = ContentTraits()
        assert traits.active_traits() == []


class TestClassifierWithTraits:
    @pytest.fixture
    def mock_llm_service(self):
        return AsyncMock()

    @pytest.mark.asyncio
    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_parses_traits(self, mock_prompt, mock_llm, mock_llm_service):
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": 0.92, "reasoning": "Code tutorial", "traits": {"has_steps": true, "has_code": true, "has_drills": false, "has_comparison": false, "has_narrative": false, "has_visual_demo": false, "is_opinionated": false, "is_list": false}}'

        result = await classify_domain_format(
            title="Python Tutorial", channel="Ch", duration=600,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.traits is not None
        assert result.traits.has_steps is True
        assert result.traits.has_code is True
        assert result.traits.has_drills is False

    @pytest.mark.asyncio
    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_missing_traits_returns_none_traits(self, mock_prompt, mock_llm, mock_llm_service):
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "learning", "format": "lecture", "confidence": 0.85}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.traits is None

    @pytest.mark.asyncio
    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_partial_traits(self, mock_prompt, mock_llm, mock_llm_service):
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "food", "format": "tutorial", "confidence": 0.9, "traits": {"has_steps": true, "has_visual_demo": true}}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.traits is not None
        assert result.traits.has_steps is True
        assert result.traits.has_visual_demo is True
        assert result.traits.has_code is False

    @pytest.mark.asyncio
    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_max_tokens_increased(self, mock_prompt, mock_llm, mock_llm_service):
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": 0.9, "traits": {}}'

        await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        call_kwargs = mock_llm.call_args[1]
        assert call_kwargs.get("max_tokens") == 250
