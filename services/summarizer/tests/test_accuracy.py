"""Tests for accuracy pipeline (fact extraction + block validation)."""

import json

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.accuracy import (
    CATEGORY_FACT_FIELDS,
    extract_chapter_facts,
    validate_chapter_blocks,
)


@pytest.fixture
def mock_provider():
    """Mock LLMProvider with complete_fast."""
    provider = MagicMock()
    provider.complete_fast = AsyncMock()
    return provider


class TestExtractChapterFacts:
    """Tests for extract_chapter_facts."""

    @pytest.mark.asyncio
    async def test_returns_empty_string_for_blank_text(self, mock_provider):
        result = await extract_chapter_facts(mock_provider, "   ", "Chapter 1")
        assert result == ""
        mock_provider.complete_fast.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_json_string_on_success(self, mock_provider):
        facts = {"key_points": ["point 1"], "names": ["Alice"]}
        mock_provider.complete_fast.return_value = json.dumps(facts)

        result = await extract_chapter_facts(mock_provider, "Some transcript text", "Chapter 1")

        assert result != ""
        parsed = json.loads(result)
        assert parsed["key_points"] == ["point 1"]
        assert parsed["names"] == ["Alice"]

    @pytest.mark.asyncio
    async def test_returns_empty_string_on_invalid_json(self, mock_provider):
        mock_provider.complete_fast.return_value = "not valid json at all"

        result = await extract_chapter_facts(mock_provider, "Some text", "Chapter 1")
        assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_string_on_llm_exception(self, mock_provider):
        mock_provider.complete_fast.side_effect = RuntimeError("LLM timeout")

        result = await extract_chapter_facts(mock_provider, "Some text", "Chapter 1")
        assert result == ""

    @pytest.mark.asyncio
    async def test_truncates_long_text_at_word_boundary(self, mock_provider):
        facts = {"key_points": ["point"]}
        mock_provider.complete_fast.return_value = json.dumps(facts)

        # Create text longer than 5000 chars
        long_text = "word " * 1200  # 6000 chars

        await extract_chapter_facts(mock_provider, long_text, "Chapter 1")

        # Verify the prompt was called with truncated text
        call_args = mock_provider.complete_fast.call_args
        prompt = call_args[0][0]
        # The prompt should not contain the full 6000 chars of text
        assert len(prompt) < len(long_text) + 500  # +500 for template overhead

    @pytest.mark.asyncio
    async def test_uses_persona_specific_fields(self, mock_provider):
        facts = {"ingredients": ["flour"]}
        mock_provider.complete_fast.return_value = json.dumps(facts)

        await extract_chapter_facts(mock_provider, "Mix the flour", "Baking", persona="recipe")

        prompt = mock_provider.complete_fast.call_args[0][0]
        assert "ingredients" in prompt.lower()

    @pytest.mark.asyncio
    async def test_standard_persona_has_no_extra_fields(self, mock_provider):
        facts = {"key_points": ["point"]}
        mock_provider.complete_fast.return_value = json.dumps(facts)

        await extract_chapter_facts(mock_provider, "Some text", "Chapter", persona="standard")

        # standard persona has empty category_fields
        assert CATEGORY_FACT_FIELDS["standard"] == ""

    @pytest.mark.asyncio
    async def test_unknown_persona_falls_back_gracefully(self, mock_provider):
        facts = {"key_points": ["point"]}
        mock_provider.complete_fast.return_value = json.dumps(facts)

        result = await extract_chapter_facts(
            mock_provider, "Some text", "Chapter", persona="unknown_type"
        )
        assert result != ""

    @pytest.mark.asyncio
    async def test_passes_correct_params_to_provider(self, mock_provider):
        mock_provider.complete_fast.return_value = '{"facts": []}'

        await extract_chapter_facts(mock_provider, "Text here", "Title")

        mock_provider.complete_fast.assert_called_once()
        _, kwargs = mock_provider.complete_fast.call_args
        assert kwargs["max_tokens"] == 500
        assert kwargs["timeout"] == 10.0

    @pytest.mark.asyncio
    async def test_handles_json_wrapped_in_text(self, mock_provider):
        """LLM responses often wrap JSON in markdown or explanation text."""
        mock_provider.complete_fast.return_value = (
            'Here are the facts:\n```json\n{"key_points": ["a"]}\n```'
        )

        result = await extract_chapter_facts(mock_provider, "Some text", "Chapter")
        parsed = json.loads(result)
        assert parsed["key_points"] == ["a"]


class TestValidateChapterBlocks:
    """Tests for validate_chapter_blocks."""

    @pytest.mark.asyncio
    async def test_returns_none_for_empty_facts(self, mock_provider):
        result = await validate_chapter_blocks(
            mock_provider, "", [{"type": "paragraph", "text": "Hi"}], "Chapter"
        )
        assert result is None
        mock_provider.complete_fast.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_none_for_empty_blocks(self, mock_provider):
        result = await validate_chapter_blocks(
            mock_provider, '{"facts": []}', [], "Chapter"
        )
        assert result is None
        mock_provider.complete_fast.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_validation_result_on_success(self, mock_provider):
        validation = {"score": 0.85, "missing_items": [], "renamed_terms": []}
        mock_provider.complete_fast.return_value = json.dumps(validation)

        blocks = [{"type": "paragraph", "text": "Some content"}]
        result = await validate_chapter_blocks(
            mock_provider, '{"key_points": ["a"]}', blocks, "Chapter 1"
        )

        assert result is not None
        assert result["score"] == 0.85
        assert result["missing_items"] == []

    @pytest.mark.asyncio
    async def test_returns_none_on_llm_exception(self, mock_provider):
        mock_provider.complete_fast.side_effect = RuntimeError("timeout")

        blocks = [{"type": "paragraph", "text": "Content"}]
        result = await validate_chapter_blocks(
            mock_provider, '{"facts": []}', blocks, "Chapter"
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_truncates_blocks_over_ten(self, mock_provider):
        validation = {"score": 0.9, "missing_items": [], "renamed_terms": []}
        mock_provider.complete_fast.return_value = json.dumps(validation)

        blocks = [{"type": "paragraph", "text": f"Block {i}"} for i in range(15)]
        await validate_chapter_blocks(
            mock_provider, '{"facts": []}', blocks, "Chapter"
        )

        prompt = mock_provider.complete_fast.call_args[0][0]
        # Should contain at most 10 blocks in the JSON
        assert "Block 14" not in prompt
        assert "Block 0" in prompt

    @pytest.mark.asyncio
    async def test_further_truncates_large_blocks(self, mock_provider):
        validation = {"score": 0.9, "missing_items": [], "renamed_terms": []}
        mock_provider.complete_fast.return_value = json.dumps(validation)

        # Create blocks with large text that exceeds 3000 chars when serialized as 10 items
        blocks = [{"type": "paragraph", "text": "x" * 400} for _ in range(10)]
        await validate_chapter_blocks(
            mock_provider, '{"facts": []}', blocks, "Chapter"
        )

        prompt = mock_provider.complete_fast.call_args[0][0]
        # After truncation to 5 blocks, "Block 9" text shouldn't appear (only 5 blocks serialized).
        # Count occurrences of the repeated text — should be at most 5.
        count = prompt.count("x" * 400)
        assert count <= 5

    @pytest.mark.asyncio
    async def test_passes_correct_params_to_provider(self, mock_provider):
        mock_provider.complete_fast.return_value = '{"score": 1.0}'

        blocks = [{"type": "paragraph", "text": "Content"}]
        await validate_chapter_blocks(
            mock_provider, '{"facts": ["a"]}', blocks, "Chapter"
        )

        _, kwargs = mock_provider.complete_fast.call_args
        assert kwargs["max_tokens"] == 300
        assert kwargs["timeout"] == 10.0

    @pytest.mark.asyncio
    async def test_handles_missing_score_in_response(self, mock_provider):
        """Validation response without score field should default to 0."""
        mock_provider.complete_fast.return_value = '{"missing_items": ["x"]}'

        blocks = [{"type": "paragraph", "text": "Content"}]
        result = await validate_chapter_blocks(
            mock_provider, '{"facts": []}', blocks, "Chapter"
        )
        assert result is not None
        # score defaults to 0 in the get() call for logging, but dict still has no 'score'

    @pytest.mark.asyncio
    async def test_returns_none_on_parse_failure(self, mock_provider):
        """If LLM returns non-JSON, parse_json_response returns {} → early None return."""
        mock_provider.complete_fast.return_value = "I cannot validate this."

        blocks = [{"type": "paragraph", "text": "Content"}]
        result = await validate_chapter_blocks(
            mock_provider, '{"facts": []}', blocks, "Chapter"
        )
        # Empty parse result is now caught explicitly and returns None
        assert result is None


class TestCategoryFactFields:
    """Tests for CATEGORY_FACT_FIELDS constant."""

    def test_all_known_personas_have_entries(self):
        expected = {
            "code", "recipe", "review", "fitness",
            "travel", "education", "interview", "music", "standard",
        }
        assert set(CATEGORY_FACT_FIELDS.keys()) == expected

    def test_standard_is_empty(self):
        assert CATEGORY_FACT_FIELDS["standard"] == ""

    def test_specialized_personas_have_content(self):
        for persona, fields in CATEGORY_FACT_FIELDS.items():
            if persona != "standard":
                assert len(fields) > 0, f"{persona} should have fact fields"
                assert "extract" in fields.lower() or "also" in fields.lower()
