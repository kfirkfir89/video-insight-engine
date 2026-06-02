"""Tests for ``translate_to_source`` — the English-canonical translation engine.

Generation is English; this engine translates the English output INTO the
source language and nests it under ``sourceLanguage``. Covers:
  - successful translation: top level stays English, the translated artifact
    nests under ``sourceLanguage`` with code/native name/isRTL/payloads.
  - LLM failure → returns input unchanged (no ``sourceLanguage`` key).
  - mirror detection (LLM echoed English back) → returns input unchanged.
  - leaf-only deny-list: string values under denied keys are NOT collected,
    but containers under the same key names ARE recursed into their contents.
  - short strings (<= 3 chars after strip) not collected.
  - large string sets are batched (no fail-closed cap), nothing dropped.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from src.services.pipeline.translation import (
    _collect_strings,
    _is_mirror,
    _SKIP_KEYS,
    translate_to_source,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_llm():
    return AsyncMock()


@pytest.fixture
def english_output() -> dict[str, Any]:
    """An assembled English output dict, mirroring real pipeline shape."""
    return {
        "tabs": [
            {
                "id": "exercises",
                "label": "Exercises",
                "emoji": "💪",
                "component": "exercise_tracker",
                "props": {
                    "exercises": [
                        {
                            "name": "Crunches",
                            "description": "Basic ab exercise",
                            "formCues": ["Keep legs straight"],
                            "sets": 3,
                            "reps": "30 seconds",
                            "emoji": "🔄",
                        },
                    ],
                    "warmup": [{"name": "Light stretches"}],
                },
            },
        ],
        "meta": {
            "tldr": "Ab workout",
            "masterSummary": "Short home workout",
            "userGoal": "Tone your abs",
            "language": "en",
            "isRTL": False,
        },
    }


# ─── Walker / deny-list semantics ────────────────────────────────────────────


class TestCollectStrings:
    def test_collects_translatable_prose(self):
        pairs: list = []
        _collect_strings({"label": "Hello world"}, (), pairs)
        assert pairs == [(("label",), "Hello world")]

    def test_skips_short_strings(self):
        pairs: list = []
        _collect_strings({"label": "Hi", "id": "abc"}, (), pairs)
        # "Hi" is 2 chars, "abc" is in deny-list anyway. Both skipped.
        assert pairs == []

    def test_skip_keys_blocks_primitive_strings(self):
        pairs: list = []
        _collect_strings(
            {"url": "https://example.com/foo", "label": "Real text"},
            (), pairs,
        )
        # url is in deny-list (primitive string → skipped); label translates.
        paths = [p for p, _ in pairs]
        assert ("url",) not in paths
        assert ("label",) in paths

    def test_leaf_only_descends_into_containers_named_in_deny_list(self):
        """Critical rule: deny applies only when value is a primitive string.

        If a container has a deny-listed name, the walker MUST still recurse.
        This protects against accidentally listing list/dict keys.
        """
        pairs: list = []
        # ``code`` is in deny-list. As a primitive string → skipped.
        # As a dict containing prose → recursed and prose collected.
        _collect_strings(
            {"code": {"explanation": "This is an explanation"}},
            (), pairs,
        )
        assert (("code", "explanation"), "This is an explanation") in pairs

    def test_walker_recurses_lists(self):
        pairs: list = []
        _collect_strings(
            {"items": [{"label": "First item"}, {"label": "Second item"}]},
            (), pairs,
        )
        paths = [p for p, _ in pairs]
        assert ("items", 0, "label") in paths
        assert ("items", 1, "label") in paths

    def test_deny_list_includes_expected_keys(self):
        """Sanity-check the deny-list shape — guards against accidental removal."""
        for key in ("id", "component", "url", "thumbnailUrl", "s3Key",
                    "emoji", "timestamp", "seconds", "language"):
            assert key in _SKIP_KEYS

    def test_fitness_prose_fields_are_translated(self):
        """Regression: ``reps``/``rest``/``duration`` carry prose in fitness videos.

        Schema (services/summarizer/src/prompts/schemas/fitness.txt) produces
        values like ``"30 שניות"``, ``"AMRAP"``, ``"until failure"`` — these
        must flow through translation, not be deny-listed as numeric-shape.
        """
        for key in ("reps", "rest", "duration"):
            assert key not in _SKIP_KEYS, (
                f"{key} must be translatable — fitness schema emits prose at this key"
            )
        pairs: list = []
        _collect_strings(
            {"exercises": [{"reps": "30 שניות", "rest": "60 שניות", "duration": "AMRAP"}]},
            (), pairs,
        )
        collected = {p[-1]: v for p, v in pairs}
        assert collected.get("reps") == "30 שניות"
        assert collected.get("rest") == "60 שניות"
        assert collected.get("duration") == "AMRAP"


# ─── Mirror detection ────────────────────────────────────────────────────────


class TestIsMirror:
    def test_identical_strings_detected_as_mirror(self):
        originals = ["This is a long string A", "This is a long string B", "Short", "Medium length text"]
        translations = list(originals)  # identical
        assert _is_mirror(originals, translations) is True

    def test_different_translations_not_a_mirror(self):
        originals = ["This is a long string A", "This is a long string B", "Medium length"]
        translations = ["A", "B", "C"]  # different content (length 1)
        assert _is_mirror(originals, translations) is False

    def test_empty_input_not_mirror(self):
        assert _is_mirror([], []) is False


# ─── translate_to_source orchestrator ────────────────────────────────────────


class TestTranslateToSource:
    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_keeps_english_primary_and_nests_translation_on_success(
        self, mock_flat, mock_llm, english_output,
    ):
        """Happy path: top level stays English, translation nests under sourceLanguage."""
        # Fake translation: prefix each English string with "HE:" so the result
        # is unambiguously different and passes mirror detection.
        async def fake(_llm, strings, *_a, **_k):
            return [f"HE: {s}" for s in strings]
        mock_flat.side_effect = fake

        result = await translate_to_source(mock_llm, english_output, "he")

        # Top level stays English (unchanged).
        assert result["tabs"][0]["label"] == "Exercises"
        assert result["meta"]["language"] == "en"
        assert result["meta"]["isRTL"] is False
        # sourceLanguage carries the translated copy.
        assert result["sourceLanguage"]["code"] == "he"
        assert result["sourceLanguage"]["name"] == "עברית"
        assert result["sourceLanguage"]["isRTL"] is True
        assert result["sourceLanguage"]["tabs"][0]["label"] == "HE: Exercises"
        assert result["sourceLanguage"]["meta"]["language"] == "he"
        assert result["sourceLanguage"]["meta"]["isRTL"] is True

    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_returns_input_unchanged_when_llm_fails(
        self, mock_flat, mock_llm, english_output,
    ):
        """LLM None → no sourceLanguage key → FE renders no toggle."""
        mock_flat.return_value = None
        result = await translate_to_source(mock_llm, english_output, "he")
        assert "sourceLanguage" not in result
        assert result is english_output  # exact same object returned

    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_returns_input_unchanged_when_llm_mirrors_english(
        self, mock_flat, mock_llm, english_output,
    ):
        """LLM echoed English back → mirror detection trips → no sourceLanguage."""
        async def echo(_llm, strings, *_a, **_k):
            return list(strings)  # byte-identical mirror
        mock_flat.side_effect = echo

        result = await translate_to_source(mock_llm, english_output, "he")
        assert "sourceLanguage" not in result

    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_skips_llm_call_when_no_translatable_strings(
        self, mock_flat, mock_llm,
    ):
        """Empty / structural-only inputs short-circuit before the LLM call."""
        result = await translate_to_source(
            mock_llm,
            {"tabs": [], "meta": {"language": "en", "isRTL": False}},
            "he",
        )
        mock_flat.assert_not_called()
        assert "sourceLanguage" not in result

    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_deny_listed_url_string_never_reaches_llm(
        self, mock_flat, mock_llm,
    ):
        """Sanity: a deny-listed primitive string is NOT in the strings list."""
        async def fake(_llm, strings, *_a, **_k):
            return [f"HE: {s}" for s in strings]
        mock_flat.side_effect = fake

        await translate_to_source(
            mock_llm,
            {"tabs": [{"label": "Exercises", "props": {"url": "https://example.com/asset.mp4"}}],
             "meta": {}},
            "he",
        )
        call_strings = mock_flat.call_args.args[1]
        assert "https://example.com/asset.mp4" not in call_strings
        assert "Exercises" in call_strings

    @patch("src.services.pipeline.translation._MAX_TRANSLATION_BATCH", 2)
    @patch("src.services.pipeline.translation._translate_flat_list")
    async def test_batches_large_string_set_without_dropping(
        self, mock_flat, mock_llm,
    ):
        """A large string set is split into batches and FULLY translated — the
        old fail-closed cap is gone, nothing is silently dropped.
        """
        async def fake(_llm, strings, *_a, **_k):
            return [f"HE: {s}" for s in strings]
        mock_flat.side_effect = fake

        output = {
            "tabs": [
                {
                    "id": "spots",
                    "label": "Recommended spots",
                    "component": "spot_explorer",
                    "props": {
                        "spots": [
                            {"name": f"Place number {i}",
                             "description": f"A long description of place number {i}"}
                            for i in range(5)
                        ],
                    },
                },
            ],
            "meta": {"masterSummary": "Overall summary of the video"},
        }

        result = await translate_to_source(mock_llm, output, "he")

        # sourceLanguage built, every collected string translated (none dropped).
        sl = result["sourceLanguage"]
        spots = sl["tabs"][0]["props"]["spots"]
        assert spots[0]["name"].startswith("HE: ")
        assert spots[4]["description"].startswith("HE: ")
        assert sl["meta"]["masterSummary"].startswith("HE: ")
        # The low batch size forced more than one LLM call.
        assert mock_flat.call_count > 1
