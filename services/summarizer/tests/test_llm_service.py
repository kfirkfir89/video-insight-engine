"""Tests for LLMService."""

import pytest
from unittest.mock import MagicMock, patch

from src.services.llm import (
    LLMService,
    load_prompt,
    load_persona,
    load_examples,
    seconds_to_timestamp,
    VALID_PERSONAS,
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


class TestLoadPersona:
    """Tests for load_persona helper."""

    def test_load_valid_persona_code(self):
        """Test loading a valid 'code' persona returns content."""
        result = load_persona("code")
        assert isinstance(result, str)
        assert len(result) > 0
        # Code persona should mention technical concepts
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
        # Clear cache to ensure fresh load
        load_persona.cache_clear()

        # Test path traversal attempt
        result_traversal = load_persona("../../../etc/passwd")
        standard = load_persona("standard")
        assert result_traversal == standard

        # Test random invalid name
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
        # Examples should contain JSON-like content
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
        # Clear cache to ensure fresh load
        load_examples.cache_clear()

        # Test path traversal attempt
        result_traversal = load_examples("../../../etc/passwd")
        standard = load_examples("standard")
        assert result_traversal == standard

        # Test random invalid name
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
        # Clear cache to ensure fresh load
        _load_persona_rules.cache_clear()
        rules = _load_persona_rules()

        # Check top-level keys
        assert "personas" in rules
        assert "default_persona" in rules
        assert rules["default_persona"] == "standard"

    def test_persona_rules_has_required_personas(self):
        """Test that required personas are defined in rules."""
        rules = _load_persona_rules()
        personas = rules["personas"]

        # Check that key personas exist
        assert "code" in personas
        assert "recipe" in personas
        # interview and review are optional but should exist
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

    def test_code_persona_has_expected_keywords(self):
        """Test that code persona includes programming-related keywords."""
        rules = _load_persona_rules()
        keywords = rules["personas"]["code"]["keywords"]

        # Check for some expected programming keywords
        keyword_set = set(k.lower() for k in keywords)
        assert "python" in keyword_set or "programming" in keyword_set
        assert "code" in keyword_set or "coding" in keyword_set

    def test_recipe_persona_has_expected_keywords(self):
        """Test that recipe persona includes food-related keywords."""
        rules = _load_persona_rules()
        keywords = rules["personas"]["recipe"]["keywords"]

        # Check for some expected food keywords
        keyword_set = set(k.lower() for k in keywords)
        assert "recipe" in keyword_set or "cooking" in keyword_set
        assert "food" in keyword_set or "chef" in keyword_set
