"""Tests for synthesis service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.synthesis import synthesize


@pytest.fixture
def mock_llm():
    """Mock LLM service."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


class TestSynthesize:
    """Test synthesize function."""

    @pytest.mark.asyncio
    async def test_returns_synthesis_result(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "tldr": "A comprehensive guide to testing.",
            "keyTakeaways": ["Write tests first", "Mock external deps"],
            "masterSummary": "This video covers testing fundamentals and best practices.",
            "seoDescription": "Learn testing best practices in 30 minutes",
        })

        result = await synthesize(
            mock_llm,
            title="Testing Guide",
            channel="CodeChannel",
            duration=1800,
            output_type="code_walkthrough",
            extraction_summary='{"snippets": [...]}',
        )

        assert result.tldr == "A comprehensive guide to testing."
        assert len(result.key_takeaways) == 2
        assert "testing" in result.master_summary.lower()
        assert len(result.seo_description) > 0

    @pytest.mark.asyncio
    async def test_handles_null_channel(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "tldr": "Summary",
            "keyTakeaways": ["Takeaway"],
            "masterSummary": "Full summary text",
            "seoDescription": "SEO text",
        })

        result = await synthesize(
            mock_llm,
            title="Test",
            channel=None,
            duration=600,
            output_type="explanation",
            extraction_summary="test",
        )

        assert result.tldr == "Summary"
        # Verify "Unknown" was passed to the prompt
        prompt = mock_llm.call_llm.call_args[0][0]
        assert "Unknown" in prompt

    @pytest.mark.asyncio
    async def test_handles_null_duration(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "tldr": "Summary",
            "keyTakeaways": ["Takeaway"],
            "masterSummary": "Full summary",
            "seoDescription": "SEO",
        })

        result = await synthesize(
            mock_llm,
            title="Test",
            channel="Channel",
            duration=None,
            output_type="explanation",
            extraction_summary="test",
        )

        assert result.tldr == "Summary"
        prompt = mock_llm.call_llm.call_args[0][0]
        assert "unknown" in prompt

    @pytest.mark.asyncio
    async def test_raises_on_empty_response(self, mock_llm):
        mock_llm.call_llm.return_value = "Sorry, I cannot do that."

        with pytest.raises(ValueError, match="Failed to parse"):
            await synthesize(
                mock_llm,
                title="Test",
                channel="Test",
                duration=300,
                output_type="explanation",
                extraction_summary="test",
            )

    @pytest.mark.asyncio
    async def test_raises_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("timeout")

        with pytest.raises(TimeoutError):
            await synthesize(
                mock_llm,
                title="Test",
                channel="Test",
                duration=300,
                output_type="explanation",
                extraction_summary="test",
            )

    @pytest.mark.asyncio
    async def test_truncates_long_extraction_summary(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "tldr": "Summary",
            "keyTakeaways": ["Takeaway"],
            "masterSummary": "Full summary",
            "seoDescription": "SEO",
        })

        long_summary = "x" * 10000
        await synthesize(
            mock_llm,
            title="Test",
            channel="Test",
            duration=600,
            output_type="explanation",
            extraction_summary=long_summary,
        )

        prompt = mock_llm.call_llm.call_args[0][0]
        # The extraction_summary is truncated to 4000 chars
        assert "x" * 4001 not in prompt
