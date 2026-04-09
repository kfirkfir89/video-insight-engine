"""Tests for the LLM domain + format classifier module."""

import pytest
from unittest.mock import AsyncMock, patch

from src.services.pipeline.classifier import (
    ClassificationResult,
    VALID_DOMAINS,
    VALID_FORMATS,
    classify_domain_format,
)


@pytest.fixture
def mock_llm_service():
    """Create a mock LLM service."""
    service = AsyncMock()
    return service


class TestClassifyDomainFormat:
    """Tests for classify_domain_format()."""

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_valid_classification(self, mock_prompt, mock_llm, mock_llm_service):
        """Valid JSON response returns ClassificationResult."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": 0.92, "reasoning": "Code tutorial"}'

        result = await classify_domain_format(
            title="Python Tutorial",
            channel="Tech Channel",
            duration=600,
            tags=["python", "tutorial"],
            transcript_preview="Today we learn Python...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.domain == "tech"
        assert result.format == "tutorial"
        assert result.confidence == 0.92
        assert result.reasoning == "Code tutorial"

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_invalid_domain_returns_none(self, mock_prompt, mock_llm, mock_llm_service):
        """Invalid domain returns None."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "gaming", "format": "tutorial", "confidence": 0.9}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is None

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_invalid_format_defaults_to_commentary(self, mock_prompt, mock_llm, mock_llm_service):
        """Invalid format falls back to 'commentary'."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "learning", "format": "banana", "confidence": 0.8}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.format == "commentary"

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_llm_returns_none(self, mock_prompt, mock_llm, mock_llm_service):
        """LLM returning None (timeout/failure) returns None."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = None

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is None

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_unparseable_json_returns_none(self, mock_prompt, mock_llm, mock_llm_service):
        """Unparseable JSON response returns None."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = "this is not json at all"

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is None

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_confidence_clamped_high(self, mock_prompt, mock_llm, mock_llm_service):
        """Confidence > 1.0 is clamped to 1.0."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": 5.0}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.confidence == 1.0

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_confidence_clamped_low(self, mock_prompt, mock_llm, mock_llm_service):
        """Confidence < 0.0 is clamped to 0.0."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": -0.5}'

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.confidence == 0.0

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_transcript_preview_truncated(self, mock_prompt, mock_llm, mock_llm_service):
        """Transcript preview is truncated to 2000 chars."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "learning", "format": "lecture", "confidence": 0.85}'

        long_transcript = "x" * 5000
        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview=long_transcript,
            llm_service=mock_llm_service,
        )

        assert result is not None
        # Verify the prompt was called with truncated text
        call_args = mock_llm.call_args
        prompt_text = call_args[0][1]  # Second positional arg is the prompt
        assert "x" * 2001 not in prompt_text

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_tags_truncated_to_15(self, mock_prompt, mock_llm, mock_llm_service):
        """Only first 15 tags are used."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "learning", "format": "lecture", "confidence": 0.85}'

        tags = [f"tag{i}" for i in range(30)]
        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=tags, transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is not None
        call_args = mock_llm.call_args
        prompt_text = call_args[0][1]
        # tag15 should NOT be in the prompt
        assert "tag15" not in prompt_text
        # tag14 should be in the prompt (0-indexed, 15th item)
        assert "tag14" in prompt_text

    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_prompt_not_found_returns_none(self, mock_prompt, mock_llm_service):
        """FileNotFoundError returns None gracefully."""
        mock_prompt.side_effect = FileNotFoundError("not found")

        result = await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        assert result is None

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_all_valid_domains_accepted(self, mock_prompt, mock_llm, mock_llm_service):
        """All 8 valid domains are accepted."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"

        for domain in VALID_DOMAINS:
            mock_llm.return_value = f'{{"domain": "{domain}", "format": "commentary", "confidence": 0.9}}'
            result = await classify_domain_format(
                title="Test", channel="Ch", duration=60,
                tags=[], transcript_preview="...",
                llm_service=mock_llm_service,
            )
            assert result is not None, f"Domain '{domain}' should be valid"
            assert result.domain == domain

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_all_valid_formats_accepted(self, mock_prompt, mock_llm, mock_llm_service):
        """All 17 valid formats are accepted."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"

        for fmt in VALID_FORMATS:
            mock_llm.return_value = f'{{"domain": "learning", "format": "{fmt}", "confidence": 0.9}}'
            result = await classify_domain_format(
                title="Test", channel="Ch", duration=60,
                tags=[], transcript_preview="...",
                llm_service=mock_llm_service,
            )
            assert result is not None, f"Format '{fmt}' should be valid"
            assert result.format == fmt

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_uses_fast_model(self, mock_prompt, mock_llm, mock_llm_service):
        """Classifier uses fast model for low cost."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "tech", "format": "tutorial", "confidence": 0.9}'

        await classify_domain_format(
            title="Test", channel="Ch", duration=60,
            tags=[], transcript_preview="...",
            llm_service=mock_llm_service,
        )

        call_kwargs = mock_llm.call_args[1]
        assert call_kwargs.get("use_fast_model") is True
        assert call_kwargs.get("max_tokens") == 250

    @patch("src.services.pipeline.classifier.call_llm_with_retry")
    @patch("src.services.pipeline.classifier._load_classify_prompt")
    async def test_empty_tags_and_channel(self, mock_prompt, mock_llm, mock_llm_service):
        """Handles empty tags and empty channel gracefully."""
        mock_prompt.return_value = "prompt {title} {channel} {duration_minutes} {tags} {transcript_preview}"
        mock_llm.return_value = '{"domain": "learning", "format": "lecture", "confidence": 0.8}'

        result = await classify_domain_format(
            title="Test", channel="",
            duration=0, tags=[],
            transcript_preview="",
            llm_service=mock_llm_service,
        )

        assert result is not None
        assert result.domain == "learning"
