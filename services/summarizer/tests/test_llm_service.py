"""Tests for LLMService."""

import pytest
from unittest.mock import MagicMock, patch

from src.services.llm import LLMService, load_prompt, seconds_to_timestamp


class TestSecondsToTimestamp:
    """Tests for seconds_to_timestamp helper."""

    def test_zero_seconds(self):
        assert seconds_to_timestamp(0) == "00:00"

    def test_under_minute(self):
        assert seconds_to_timestamp(45) == "00:45"

    def test_one_minute(self):
        assert seconds_to_timestamp(60) == "01:00"

    def test_multiple_minutes(self):
        assert seconds_to_timestamp(125) == "02:05"

    def test_over_hour(self):
        assert seconds_to_timestamp(3661) == "61:01"


class TestLoadPrompt:
    """Tests for load_prompt helper."""

    def test_load_section_detect_prompt(self):
        prompt = load_prompt("section_detect")
        assert "sections" in prompt.lower()

    def test_load_section_summary_prompt(self):
        prompt = load_prompt("section_summary")
        assert "summary" in prompt.lower()

    def test_load_concept_extract_prompt(self):
        prompt = load_prompt("concept_extract")
        assert "concept" in prompt.lower()

    def test_load_global_synthesis_prompt(self):
        prompt = load_prompt("global_synthesis")
        assert "tldr" in prompt.lower() or "summary" in prompt.lower()


class TestLLMService:
    """Tests for LLMService class."""

    def test_init(self, mock_anthropic_client):
        """Test service initialization."""
        service = LLMService(mock_anthropic_client)
        assert service._client is mock_anthropic_client

    async def test_detect_sections_success(
        self,
        mock_anthropic_client,
        sample_transcript,
        sample_segments,
        sample_llm_sections_response,
    ):
        """Test successful section detection."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=sample_llm_sections_response)]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        sections = await service.detect_sections(sample_transcript, sample_segments)

        assert len(sections) == 2
        assert sections[0]["title"] == "Introduction"
        assert sections[1]["title"] == "Testing Basics"
        mock_anthropic_client.messages.create.assert_called_once()

    async def test_detect_sections_fallback(
        self,
        mock_anthropic_client,
        sample_transcript,
        sample_segments,
    ):
        """Test fallback when JSON parsing fails."""
        # Setup mock to return non-JSON
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="No JSON here")]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        sections = await service.detect_sections(sample_transcript, sample_segments)

        # Should return fallback single section
        assert len(sections) == 1
        assert sections[0]["title"] == "Full Video"

    async def test_summarize_section_success(
        self,
        mock_anthropic_client,
        sample_llm_summary_response,
    ):
        """Test successful section summarization."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=sample_llm_summary_response)]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        result = await service.summarize_section("Some section text", "Test Section")

        assert "summary" in result
        assert result["summary"] == "This section covers the basics of testing."
        assert len(result["bullets"]) == 2

    async def test_extract_concepts_success(
        self,
        mock_anthropic_client,
        sample_transcript,
        sample_llm_concepts_response,
    ):
        """Test successful concept extraction."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=sample_llm_concepts_response)]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        concepts = await service.extract_concepts(sample_transcript)

        assert len(concepts) == 2
        assert concepts[0]["name"] == "Unit Testing"

    async def test_synthesize_summary_success(
        self,
        mock_anthropic_client,
        sample_llm_synthesis_response,
    ):
        """Test successful summary synthesis."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=sample_llm_synthesis_response)]
        mock_anthropic_client.messages.create.return_value = mock_response

        service = LLMService(mock_anthropic_client)
        sections = [{"title": "Section 1", "summary": "Test"}]
        concepts = [{"name": "Concept 1"}]

        result = await service.synthesize_summary(sections, concepts)

        assert "tldr" in result
        assert "keyTakeaways" in result
        assert len(result["keyTakeaways"]) == 2

    async def test_process_video_calls_all_steps(
        self,
        mock_anthropic_client,
        sample_transcript,
        sample_segments,
    ):
        """Test that process_video calls all LLM steps."""
        # Setup mock to return appropriate responses based on call count
        call_count = [0]

        def get_mock_response(*args, **kwargs):
            call_count[0] += 1
            mock_response = MagicMock()
            if call_count[0] == 1:
                # Section detection
                mock_response.content = [MagicMock(text='{"sections": [{"title": "Test", "startSeconds": 0, "endSeconds": 10}]}')]
            elif call_count[0] == 2:
                # Section summary
                mock_response.content = [MagicMock(text='{"summary": "Test summary", "bullets": ["Point 1"]}')]
            elif call_count[0] == 3:
                # Concept extraction
                mock_response.content = [MagicMock(text='{"concepts": [{"name": "Test Concept"}]}')]
            else:
                # Synthesis
                mock_response.content = [MagicMock(text='{"tldr": "Test TLDR", "keyTakeaways": ["Take 1"]}')]
            return mock_response

        mock_anthropic_client.messages.create.side_effect = get_mock_response

        service = LLMService(mock_anthropic_client)
        result = await service.process_video(sample_transcript, sample_segments)

        assert "tldr" in result
        assert "key_takeaways" in result
        assert "sections" in result
        assert "concepts" in result
        assert len(result["sections"]) > 0
