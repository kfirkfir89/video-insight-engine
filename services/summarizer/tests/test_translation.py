"""Tests for the translation module."""

from __future__ import annotations

import json

import pytest
from unittest.mock import AsyncMock, patch

from src.services.pipeline.translation import (
    translate_assembled_output,
    _translate_json,
)


# ─── Fixtures ───


@pytest.fixture
def mock_llm_service():
    """Create a mock LLM service."""
    return AsyncMock()


@pytest.fixture
def sample_tabs():
    """Sample assembled tabs in a non-English language."""
    return [
        {"id": "overview", "label": "Resumen", "emoji": "📋", "component": "overview", "props": {"title": "Resumen del video"}},
        {"id": "key_points", "label": "Puntos clave", "emoji": "🔑", "component": "info_grid", "props": {"items": [{"title": "Punto 1"}]}},
    ]


@pytest.fixture
def sample_meta():
    """Sample assembled meta dict."""
    return {"title": "Mi Video", "description": "Una descripcion del video", "duration": 600}


@pytest.fixture
def sample_synthesis():
    """Sample synthesis result dict."""
    return {"summary": "Este video trata de programacion", "highlights": ["Punto importante uno"]}


# ─── translate_assembled_output ───


class TestTranslateAssembledOutput:
    """Tests for translate_assembled_output()."""

    @patch("src.services.pipeline.translation.parse_json_response")
    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_translated_content_when_llm_succeeds(
        self, mock_llm, mock_prompt, mock_parse, mock_llm_service, sample_tabs, sample_meta, sample_synthesis,
    ):
        """Should return translated tabs, meta, and synthesis when LLM calls succeed."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"

        translated_tabs = [
            {"id": "overview", "label": "Overview", "emoji": "📋", "component": "overview", "props": {"title": "Video summary"}},
            {"id": "key_points", "label": "Key Points", "emoji": "🔑", "component": "info_grid", "props": {"items": [{"title": "Point 1"}]}},
        ]
        translated_meta_synthesis = {
            "meta": {"title": "My Video", "description": "A video description", "duration": 600},
            "synthesis": {"summary": "This video is about programming", "highlights": ["Important point one"]},
        }

        mock_llm.side_effect = ["raw_tabs_json", "raw_meta_json"]
        mock_parse.side_effect = [translated_tabs, translated_meta_synthesis]

        tabs_en, meta_en, synthesis_en = await translate_assembled_output(
            mock_llm_service, sample_tabs, sample_meta, sample_synthesis, "es",
        )

        assert tabs_en == translated_tabs
        assert meta_en == translated_meta_synthesis["meta"]
        assert synthesis_en == translated_meta_synthesis["synthesis"]
        assert mock_llm.call_count == 2

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_content_when_llm_fails(
        self, mock_llm, mock_prompt, mock_llm_service, sample_tabs, sample_meta, sample_synthesis,
    ):
        """Should return original content when LLM calls return None (graceful degradation)."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        mock_llm.return_value = None

        tabs_en, meta_en, synthesis_en = await translate_assembled_output(
            mock_llm_service, sample_tabs, sample_meta, sample_synthesis, "es",
        )

        assert tabs_en == sample_tabs
        assert meta_en == sample_meta
        assert synthesis_en == sample_synthesis

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_content_when_llm_raises_exception(
        self, mock_llm, mock_prompt, mock_llm_service, sample_tabs, sample_meta, sample_synthesis,
    ):
        """Should return original content when LLM raises an exception."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        mock_llm.side_effect = Exception("LLM service unavailable")

        tabs_en, meta_en, synthesis_en = await translate_assembled_output(
            mock_llm_service, sample_tabs, sample_meta, sample_synthesis, "es",
        )

        assert tabs_en == sample_tabs
        assert meta_en == sample_meta
        assert synthesis_en == sample_synthesis

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_handle_empty_tabs_list(
        self, mock_llm, mock_prompt, mock_llm_service, sample_meta, sample_synthesis,
    ):
        """Should handle empty tabs list gracefully (content < 10 chars skips LLM)."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"

        translated_meta_synthesis = {
            "meta": {"title": "My Video", "description": "A description", "duration": 600},
            "synthesis": {"summary": "About programming", "highlights": ["Point one"]},
        }
        # Empty list serializes to "[]" which is < 10 chars, so _translate_json skips the LLM call
        # Only the meta+synthesis call should happen
        mock_llm.return_value = json.dumps(translated_meta_synthesis)

        tabs_en, meta_en, synthesis_en = await translate_assembled_output(
            mock_llm_service, [], sample_meta, sample_synthesis, "es",
        )

        assert meta_en == translated_meta_synthesis["meta"]
        assert synthesis_en == translated_meta_synthesis["synthesis"]
        # 1 call: meta/synthesis only (tabs skipped — "[]" < 10 chars, no labels to reverse)
        assert mock_llm.call_count == 1

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_use_fast_model_for_llm_calls(
        self, mock_llm, mock_prompt, mock_llm_service, sample_tabs, sample_meta, sample_synthesis,
    ):
        """Should pass use_fast_model=True to LLM calls (Haiku for cost efficiency)."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        mock_llm.return_value = json.dumps(sample_tabs)

        await translate_assembled_output(
            mock_llm_service, sample_tabs, sample_meta, sample_synthesis, "es",
        )

        for call in mock_llm.call_args_list:
            assert call.kwargs.get("use_fast_model") is True

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_fallback_tabs_to_original_when_llm_returns_non_list(
        self, mock_llm, mock_prompt, mock_llm_service, sample_tabs, sample_meta, sample_synthesis,
    ):
        """Should use original tabs when LLM returns a dict instead of a list."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"

        # LLM returns a dict for tabs (wrong type) and valid meta+synthesis
        translated_meta_synthesis = {
            "meta": {"title": "My Video", "description": "A description", "duration": 600},
            "synthesis": {"summary": "About programming", "highlights": ["Point one"]},
        }
        mock_llm.side_effect = [
            json.dumps({"wrong": "format"}),  # tabs - wrong type (dict not list)
            json.dumps(translated_meta_synthesis),
        ]

        tabs_en, meta_en, synthesis_en = await translate_assembled_output(
            mock_llm_service, sample_tabs, sample_meta, sample_synthesis, "es",
        )

        assert tabs_en == sample_tabs  # Falls back to original
        assert meta_en == translated_meta_synthesis["meta"]


# ─── _translate_json ───


class TestTranslateJson:
    """Tests for _translate_json() internal function."""

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_when_content_too_small(
        self, mock_llm, mock_prompt, mock_llm_service,
    ):
        """Should skip LLM call and return original when JSON content is < 10 chars."""
        result = await _translate_json(mock_llm_service, [], "es", "test")

        assert result == []
        mock_llm.assert_not_called()

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_when_content_is_short_string(
        self, mock_llm, mock_prompt, mock_llm_service,
    ):
        """Should skip LLM for short content like a small dict."""
        result = await _translate_json(mock_llm_service, {"a": 1}, "es", "test")

        assert result == {"a": 1}
        mock_llm.assert_not_called()

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_translate_valid_content(
        self, mock_llm, mock_prompt, mock_llm_service,
    ):
        """Should call LLM and return translated content for valid input."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        original = {"title": "Titulo largo que tiene mas de diez caracteres", "items": ["uno", "dos"]}
        translated = {"title": "Long title that has more than ten characters", "items": ["one", "two"]}
        mock_llm.return_value = json.dumps(translated)

        result = await _translate_json(mock_llm_service, original, "es", "test_stage")

        assert result == translated
        mock_llm.assert_called_once()

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_when_parse_fails(
        self, mock_llm, mock_prompt, mock_llm_service,
    ):
        """Should return original content when LLM returns unparseable response."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        original = {"title": "Titulo largo que tiene mas de diez caracteres"}
        mock_llm.return_value = "This is not valid JSON at all {{"

        result = await _translate_json(mock_llm_service, original, "es", "test_stage")

        assert result == original

    @patch("src.services.pipeline.translation._load_translate_prompt")
    @patch("src.services.pipeline.translation.call_llm_with_retry")
    async def test_should_return_original_when_llm_returns_empty(
        self, mock_llm, mock_prompt, mock_llm_service,
    ):
        """Should return original content when LLM returns empty string."""
        mock_prompt.return_value = "Translate from {source_language}:\n{content_json}"
        original = {"title": "Titulo largo que tiene mas de diez caracteres"}
        mock_llm.return_value = ""

        result = await _translate_json(mock_llm_service, original, "es", "test_stage")

        assert result == original
