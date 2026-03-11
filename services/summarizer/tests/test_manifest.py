"""Tests for manifest pipeline stage."""

import json
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.manifest import (
    run_manifest,
    format_manifest_for_triage,
)
from src.models.pipeline_types import ManifestResult, ItemCounts, ManifestFlags


@pytest.fixture
def mock_llm():
    """Mock LLM service with call_llm method."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


VALID_MANIFEST_RESPONSE = {
    "summary": "A cooking tutorial showing how to make carbonara",
    "contentType": "recipe",
    "mainTopics": ["carbonara", "pasta", "Italian cooking"],
    "itemCounts": {
        "steps": 5,
        "spots": 0,
        "exercises": 0,
        "ingredients": 8,
        "songs": 0,
        "tips": 3,
        "products": 0,
    },
    "sections": [
        {"title": "Introduction", "startPercent": 0, "endPercent": 15, "density": "low"},
        {"title": "Prep ingredients", "startPercent": 15, "endPercent": 50, "density": "high"},
        {"title": "Cooking", "startPercent": 50, "endPercent": 90, "density": "high"},
        {"title": "Plating", "startPercent": 90, "endPercent": 100, "density": "low"},
    ],
    "keyNames": ["guanciale", "Pecorino Romano", "carbonara"],
    "flags": {
        "hasStorytelling": False,
        "hasBudgetDiscussion": False,
        "hasCodeSnippets": False,
        "hasRecipe": True,
        "hasWorkout": False,
        "speakerCount": 1,
    },
}


class TestRunManifest:
    """Test run_manifest function."""

    @pytest.mark.asyncio
    async def test_returns_manifest_for_valid_response(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps(VALID_MANIFEST_RESPONSE)

        result = await run_manifest(
            title="Perfect Carbonara",
            duration=600,
            transcript="Today we're making authentic carbonara...",
            llm_service=mock_llm,
        )

        assert result is not None
        assert result.summary == "A cooking tutorial showing how to make carbonara"
        assert result.content_type == "recipe"
        assert result.item_counts.ingredients == 8
        assert result.item_counts.steps == 5
        assert result.flags.has_recipe is True
        assert len(result.sections) == 4

    @pytest.mark.asyncio
    async def test_returns_none_on_empty_response(self, mock_llm):
        mock_llm.call_llm.return_value = ""

        result = await run_manifest(
            title="Test", duration=300, transcript="Test", llm_service=mock_llm,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = Exception("LLM error")

        result = await run_manifest(
            title="Test", duration=300, transcript="Test", llm_service=mock_llm,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_timeout(self, mock_llm):
        async def slow_call(*args, **kwargs):
            await asyncio.sleep(20)
            return json.dumps(VALID_MANIFEST_RESPONSE)

        mock_llm.call_llm.side_effect = slow_call

        result = await run_manifest(
            title="Test", duration=300, transcript="Test", llm_service=mock_llm,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_json(self, mock_llm):
        mock_llm.call_llm.return_value = "This is not JSON at all"

        result = await run_manifest(
            title="Test", duration=300, transcript="Test", llm_service=mock_llm,
        )
        assert result is None


class TestFormatManifestForTriage:
    """Test format_manifest_for_triage function."""

    def test_formats_full_manifest(self):
        manifest = ManifestResult.model_validate(VALID_MANIFEST_RESPONSE)
        text = format_manifest_for_triage(manifest)

        assert "carbonara" in text
        assert "recipe" in text
        assert "8 ingredients" in text
        assert "5 steps" in text
        assert "3 tips" in text

    def test_formats_minimal_manifest(self):
        manifest = ManifestResult(summary="A video")
        text = format_manifest_for_triage(manifest)

        assert "Summary: A video" in text

    def test_includes_flags(self):
        manifest = ManifestResult.model_validate(VALID_MANIFEST_RESPONSE)
        text = format_manifest_for_triage(manifest)

        assert "recipe" in text.lower()

    def test_skips_zero_counts(self):
        manifest = ManifestResult.model_validate(VALID_MANIFEST_RESPONSE)
        text = format_manifest_for_triage(manifest)

        assert "exercises" not in text
        assert "songs" not in text

    def test_multi_speaker_flag(self):
        manifest = ManifestResult(
            flags=ManifestFlags(speakerCount=3),
        )
        text = format_manifest_for_triage(manifest)

        assert "3 speakers" in text


class TestManifestResultModel:
    """Test ManifestResult Pydantic model."""

    def test_default_values(self):
        result = ManifestResult()
        assert result.summary == ""
        assert result.item_counts.steps == 0
        assert result.flags.has_recipe is False

    def test_item_counts_coercion(self):
        counts = ItemCounts.model_validate({
            "steps": None,
            "spots": "5",
            "exercises": 3,
        })
        assert counts.steps == 0
        assert counts.spots == 5
        assert counts.exercises == 3

    def test_full_validation(self):
        result = ManifestResult.model_validate(VALID_MANIFEST_RESPONSE)
        assert result.content_type == "recipe"
        assert len(result.key_names) == 3
        assert result.sections[0].title == "Introduction"
