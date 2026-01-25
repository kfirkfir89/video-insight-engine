"""Tests for LLMService with LiteLLM multi-provider support."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.services.llm import (
    LLMService,
    load_prompt,
    load_persona,
    load_examples,
    seconds_to_timestamp,
    VALID_PERSONAS,
    _extract_summary_from_content,
    _extract_bullets_from_content,
)
from src.services.youtube import _load_persona_rules


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
        # Prompt transforms section content into article format
        assert "section" in prompt.lower()

    def test_load_concept_extract_prompt(self):
        prompt = load_prompt("concept_extract")
        assert "concept" in prompt.lower()

    def test_load_global_synthesis_prompt(self):
        prompt = load_prompt("global_synthesis")
        assert "tldr" in prompt.lower() or "summary" in prompt.lower()


class TestExtractFromContent:
    """Tests for content extraction helpers."""

    def test_extract_summary_from_paragraph(self):
        content = [{"type": "paragraph", "text": "Test summary"}]
        assert _extract_summary_from_content(content) == "Test summary"

    def test_extract_summary_from_multiple_paragraphs(self):
        content = [
            {"type": "paragraph", "text": "First part."},
            {"type": "paragraph", "text": "Second part."},
        ]
        assert _extract_summary_from_content(content) == "First part. Second part."

    def test_extract_summary_fallback_to_definition(self):
        content = [{"type": "definition", "term": "API", "meaning": "Application Programming Interface"}]
        assert "API" in _extract_summary_from_content(content)

    def test_extract_summary_empty_content(self):
        assert _extract_summary_from_content([]) == ""

    def test_extract_bullets_from_bullets_block(self):
        content = [{"type": "bullets", "items": ["Item 1", "Item 2"]}]
        bullets = _extract_bullets_from_content(content)
        assert len(bullets) == 2
        assert "Item 1" in bullets

    def test_extract_bullets_from_numbered_block(self):
        content = [{"type": "numbered", "items": ["Step 1", "Step 2"]}]
        bullets = _extract_bullets_from_content(content)
        assert len(bullets) == 2


class TestLLMService:
    """Tests for LLMService class with LLMProvider."""

    def test_init(self, mock_llm_provider):
        """Test service initialization with LLMProvider."""
        service = LLMService(mock_llm_provider)
        assert service._provider is mock_llm_provider

    @pytest.mark.asyncio
    async def test_detect_sections_success(
        self,
        mock_llm_provider,
        sample_transcript,
        sample_segments,
        sample_llm_sections_response,
    ):
        """Test successful section detection."""
        mock_llm_provider.complete = AsyncMock(return_value=sample_llm_sections_response)

        service = LLMService(mock_llm_provider)
        sections = await service.detect_sections(sample_transcript, sample_segments)

        assert len(sections) == 2
        assert sections[0]["title"] == "Introduction"
        assert sections[1]["title"] == "Testing Basics"
        mock_llm_provider.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_detect_sections_fallback(
        self,
        mock_llm_provider,
        sample_transcript,
        sample_segments,
    ):
        """Test fallback when JSON parsing fails."""
        mock_llm_provider.complete = AsyncMock(return_value="No JSON here")

        service = LLMService(mock_llm_provider)
        sections = await service.detect_sections(sample_transcript, sample_segments)

        # Should return fallback single section
        assert len(sections) == 1
        assert sections[0]["title"] == "Full Video"

    @pytest.mark.asyncio
    async def test_summarize_section_success(
        self,
        mock_llm_provider,
        sample_llm_summary_response,
    ):
        """Test successful section summarization with content blocks."""
        mock_llm_provider.complete = AsyncMock(return_value=sample_llm_summary_response)

        service = LLMService(mock_llm_provider)
        result = await service.summarize_section("Some section text", "Test Section")

        assert "content" in result
        assert isinstance(result["content"], list)
        assert "summary" in result  # Legacy field
        assert "bullets" in result  # Legacy field

    @pytest.mark.asyncio
    async def test_extract_concepts_success(
        self,
        mock_llm_provider,
        sample_transcript,
        sample_llm_concepts_response,
    ):
        """Test successful concept extraction."""
        mock_llm_provider.complete = AsyncMock(return_value=sample_llm_concepts_response)

        service = LLMService(mock_llm_provider)
        concepts = await service.extract_concepts(sample_transcript)

        assert len(concepts) == 2
        assert concepts[0]["name"] == "Unit Testing"

    @pytest.mark.asyncio
    async def test_synthesize_summary_success(
        self,
        mock_llm_provider,
        sample_llm_synthesis_response,
    ):
        """Test successful summary synthesis."""
        mock_llm_provider.complete = AsyncMock(return_value=sample_llm_synthesis_response)

        service = LLMService(mock_llm_provider)
        sections = [{"title": "Section 1", "summary": "Test"}]
        concepts = [{"name": "Concept 1"}]

        result = await service.synthesize_summary(sections, concepts)

        assert "tldr" in result
        assert "keyTakeaways" in result
        assert len(result["keyTakeaways"]) == 2

    @pytest.mark.asyncio
    async def test_process_video_calls_all_steps(
        self,
        mock_llm_provider,
        sample_transcript,
        sample_segments,
    ):
        """Test that process_video calls all LLM steps."""
        call_count = [0]

        async def mock_complete(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return '{"sections": [{"title": "Test", "startSeconds": 0, "endSeconds": 10}]}'
            elif call_count[0] == 2:
                return '{"content": [{"type": "paragraph", "text": "Test summary"}]}'
            elif call_count[0] == 3:
                return '{"concepts": [{"name": "Test Concept"}]}'
            else:
                return '{"tldr": "Test TLDR", "keyTakeaways": ["Take 1"]}'

        mock_llm_provider.complete = mock_complete

        service = LLMService(mock_llm_provider)
        result = await service.process_video(sample_transcript, sample_segments)

        assert "tldr" in result
        assert "key_takeaways" in result
        assert "sections" in result
        assert "concepts" in result
        assert len(result["sections"]) > 0


class TestLoadPersona:
    """Tests for load_persona helper."""

    def test_load_valid_persona_code(self):
        """Test loading a valid 'code' persona returns content."""
        result = load_persona("code")
        assert isinstance(result, str)
        assert len(result) > 0
        assert "code" in result.lower() or "developer" in result.lower()

    def test_load_valid_persona_recipe(self):
        """Test loading a valid 'recipe' persona returns content."""
        result = load_persona("recipe")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_load_valid_persona_standard(self):
        """Test loading a valid 'standard' persona returns content."""
        result = load_persona("standard")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_load_invalid_persona_falls_back_to_standard(self):
        """Test that invalid persona names fall back to 'standard'."""
        load_persona.cache_clear()

        result_traversal = load_persona("../../../etc/passwd")
        standard = load_persona("standard")
        assert result_traversal == standard

        load_persona.cache_clear()
        result_invalid = load_persona("nonexistent_persona")
        assert result_invalid == standard

    def test_all_valid_personas_exist(self):
        """Test that all personas in VALID_PERSONAS can be loaded."""
        load_persona.cache_clear()
        for persona in VALID_PERSONAS:
            result = load_persona(persona)
            assert isinstance(result, str)
            assert len(result) > 0, f"Persona '{persona}' returned empty content"


class TestLoadExamples:
    """Tests for load_examples helper."""

    def test_load_valid_examples_code(self):
        """Test loading valid 'code' examples returns content."""
        result = load_examples("code")
        assert isinstance(result, str)
        assert len(result) > 0
        assert "{" in result or "[" in result

    def test_load_valid_examples_recipe(self):
        """Test loading valid 'recipe' examples returns content."""
        result = load_examples("recipe")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_load_valid_examples_standard(self):
        """Test loading valid 'standard' examples returns content."""
        result = load_examples("standard")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_load_invalid_examples_falls_back_to_standard(self):
        """Test that invalid example names fall back to 'standard'."""
        load_examples.cache_clear()

        result_traversal = load_examples("../../../etc/passwd")
        standard = load_examples("standard")
        assert result_traversal == standard

        load_examples.cache_clear()
        result_invalid = load_examples("nonexistent_examples")
        assert result_invalid == standard

    def test_all_valid_examples_exist(self):
        """Test that all examples in VALID_PERSONAS can be loaded."""
        load_examples.cache_clear()
        for persona in VALID_PERSONAS:
            result = load_examples(persona)
            assert isinstance(result, str)
            assert len(result) > 0, f"Examples for '{persona}' returned empty content"


class TestLoadPersonaRules:
    """Tests for _load_persona_rules helper."""

    def test_persona_rules_structure(self):
        """Test that persona_rules.json has the expected structure."""
        _load_persona_rules.cache_clear()
        rules = _load_persona_rules()

        assert "personas" in rules
        assert "default_persona" in rules
        assert rules["default_persona"] == "standard"

    def test_persona_rules_has_required_personas(self):
        """Test that required personas are defined in rules."""
        rules = _load_persona_rules()
        personas = rules["personas"]

        assert "code" in personas
        assert "recipe" in personas
        assert "interview" in personas
        assert "review" in personas

    def test_persona_config_structure(self):
        """Test that each persona config has keywords and categories."""
        rules = _load_persona_rules()

        for persona_name, config in rules["personas"].items():
            assert "keywords" in config, f"'{persona_name}' missing 'keywords'"
            assert "categories" in config, f"'{persona_name}' missing 'categories'"
            assert isinstance(config["keywords"], list), f"'{persona_name}' keywords should be list"
            assert isinstance(config["categories"], list), f"'{persona_name}' categories should be list"
            assert len(config["keywords"]) > 0, f"'{persona_name}' should have at least one keyword"
            assert len(config["categories"]) > 0, f"'{persona_name}' should have at least one category"
