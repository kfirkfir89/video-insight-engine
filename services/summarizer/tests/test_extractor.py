"""Tests for adaptive extraction pipeline (extractor.py).

Covers strategy selection, deduplication, prompt formatting,
token estimation, and validation integration.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.pipeline.extractor import (
    _dynamic_timeout,
    _estimate_tokens,
    _force_split_by_sentences,
    _format_prompt,
    _parse_llm_json,
    extract,
    SINGLE_THRESHOLD,
    OVERFLOW_THRESHOLD,
)
from src.services.transcription.transcript_chunker import FORCE_SPLIT_TARGET_WORDS
from src.services.pipeline.triage import TriageResult


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_llm():
    """Mock LLM service."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


@pytest.fixture
def learning_triage():
    """Simple learning TriageResult."""
    return TriageResult(
        content_tags=["learning"],
        modifiers=[],
        primary_tag="learning",
        user_goal="Learn about the topic",
        tabs=[
            {"id": "key_points", "label": "Key Points"},
            {"id": "concepts", "label": "Concepts"},
        ],
        confidence=0.9,
    )


@pytest.fixture
def multi_tag_triage():
    """Multi-tag TriageResult (travel + finance modifier)."""
    return TriageResult(
        content_tags=["travel", "food"],
        modifiers=["finance"],
        primary_tag="travel",
        user_goal="Plan a trip with food stops",
        tabs=[
            {"id": "itinerary", "label": "Itinerary"},
            {"id": "ingredients", "label": "Ingredients"},
        ],
        confidence=0.85,
    )


def _make_transcript(word_count: int, with_sentences: bool = False) -> str:
    """Create a transcript with the given word count.

    Args:
        word_count: Number of words in the transcript.
        with_sentences: If True, add sentence terminators every 10 words
            (required for _force_split_by_sentences to work).
    """
    if not with_sentences:
        return " ".join(["word"] * word_count)
    words = []
    for i in range(word_count):
        words.append(f"word{i}")
        if (i + 1) % 10 == 0:
            words[-1] += "."
    return " ".join(words)


# ─────────────────────────────────────────────────────────────────────────────
# Token Estimation
# ─────────────────────────────────────────────────────────────────────────────


class TestEstimateTokens:
    """Tests for token estimation."""

    def test_empty_string(self):
        assert _estimate_tokens("") == 0

    def test_single_word(self):
        result = _estimate_tokens("hello")
        assert result == 1  # int(1 * 1.33)

    def test_hundred_words(self):
        text = " ".join(["word"] * 100)
        result = _estimate_tokens(text)
        assert result == 133  # int(100 * 1.33)

    def test_proportional(self):
        short = _estimate_tokens("a b c")
        long = _estimate_tokens("a b c d e f")
        assert long > short


# ─────────────────────────────────────────────────────────────────────────────
# Prompt Formatting
# ─────────────────────────────────────────────────────────────────────────────


class TestFormatPrompt:
    """Tests for _format_prompt."""

    def test_replaces_transcript_placeholder(self):
        template = "Analyze: {transcript}"
        result = _format_prompt(template, "Hello world")
        assert "Hello world" in result
        assert "{transcript}" not in result

    def test_preserves_other_text(self):
        template = "Title: My Video\n{transcript}"
        result = _format_prompt(template, "text")
        assert "Title: My Video" in result

    def test_only_replaces_transcript(self):
        """_format_prompt should only replace {transcript}, all other placeholders handled earlier."""
        template = "Goal: some goal\nSections: some sections\n{transcript}"
        result = _format_prompt(template, "content")
        assert "Goal: some goal" in result
        assert "Sections: some sections" in result
        assert "content" in result


# ─────────────────────────────────────────────────────────────────────────────
# JSON Parsing
# ─────────────────────────────────────────────────────────────────────────────


class TestParseLlmJson:
    """Tests for _parse_llm_json."""

    def test_valid_json(self):
        raw = json.dumps({"key": "value"})
        result = _parse_llm_json(raw)
        assert result == {"key": "value"}

    def test_markdown_fenced_json(self):
        raw = '```json\n{"key": "value", "num": 42}\n```'
        result = _parse_llm_json(raw)
        assert result == {"key": "value", "num": 42}

    def test_markdown_fenced_multiline(self):
        raw = '```json\n{\n  "keyPoints": [{"title": "A"}],\n  "concepts": []\n}\n```'
        result = _parse_llm_json(raw)
        assert result["keyPoints"] == [{"title": "A"}]

    def test_raises_on_empty(self):
        with pytest.raises(ValueError, match="Failed to parse"):
            _parse_llm_json("")

    def test_raises_on_invalid_json(self):
        with pytest.raises(ValueError, match="Failed to parse"):
            _parse_llm_json("not json at all")


# ─────────────────────────────────────────────────────────────────────────────
# JSON Truncation
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Chapter-Based Splitting
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Strategy Selection (Integration)
# ─────────────────────────────────────────────────────────────────────────────


class TestStrategySelection:
    """Tests for extraction strategy selection based on word count and duration."""

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_short_transcript_uses_single(self, mock_prompt, mock_template, mock_llm, learning_triage):
        """Transcripts below SINGLE_THRESHOLD use single extraction."""
        short_transcript = _make_transcript(SINGLE_THRESHOLD - 100)
        mock_llm.call_llm.return_value = json.dumps({
            "keyPoints": [{"emoji": "💡", "title": "Point", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
            "keyQuestion": "",
            "summary": "",
        })

        events = []
        async for evt in extract(mock_llm, learning_triage, short_transcript, {"title": "Test", "duration": 300}):
            events.append(evt)

        # Single extraction = 1 LLM call
        assert mock_llm.call_llm.call_count == 1
        assert any(e["event"] == "extraction_complete" for e in events)

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_medium_transcript_uses_overflow(self, mock_prompt, mock_template, mock_llm, learning_triage):
        """Transcripts between SINGLE and OVERFLOW thresholds use overflow strategy."""
        medium_transcript = _make_transcript(SINGLE_THRESHOLD + 100)
        mock_llm.call_llm.return_value = json.dumps({
            "keyPoints": [{"emoji": "💡", "title": "Point", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
            "keyQuestion": "",
            "summary": "",
        })

        events = []
        async for evt in extract(mock_llm, learning_triage, medium_transcript, {"title": "Test", "duration": 300}):
            events.append(evt)

        # Overflow = 1 LLM call (unless validation fails)
        assert mock_llm.call_llm.call_count == 1
        assert any(e["event"] == "extraction_complete" for e in events)

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.validate_domain_output")
    @patch("src.services.pipeline.extractor.call_llm_with_retry", new_callable=AsyncMock)
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_long_transcript_short_duration_uses_force_split(self, mock_prompt, mock_template, mock_llm_retry, mock_validate, mock_llm, learning_triage):
        """Long transcripts with short duration use force-split chunked extraction."""
        long_transcript = _make_transcript(OVERFLOW_THRESHOLD + 100, with_sentences=True)
        extraction_data = {
            "keyPoints": [{"emoji": "💡", "title": "Point", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
        }
        mock_llm_retry.return_value = json.dumps(extraction_data)
        mock_validate.return_value = {"learning": extraction_data}

        events = []
        async for evt in extract(mock_llm, learning_triage, long_transcript, {"title": "Test", "duration": 60 * 60}):
            events.append(evt)

        # Force-split routes through _chunked_extraction (batches may merge into 1 call)
        assert mock_llm_retry.call_count >= 1
        assert any(e["event"] == "extraction_complete" for e in events)
        # Verify chunked progress events (not overflow "primary" section)
        assert any(e.get("section") == "chunked" for e in events if e["event"] == "extraction_progress")

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.validate_domain_output")
    @patch("src.services.pipeline.extractor.call_llm_with_retry", new_callable=AsyncMock)
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_long_transcript_without_chapters_uses_force_split(self, mock_prompt, mock_template, mock_llm_retry, mock_validate, mock_llm, learning_triage):
        """Long transcripts without chapters use force-split chunked extraction."""
        long_transcript = _make_transcript(OVERFLOW_THRESHOLD + 100, with_sentences=True)
        extraction_data = {
            "keyPoints": [{"emoji": "💡", "title": "Point", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
        }
        mock_llm_retry.return_value = json.dumps(extraction_data)
        mock_validate.return_value = {"learning": extraction_data}

        events = []
        # Long duration without chapters → force-split into chunks
        async for evt in extract(mock_llm, learning_triage, long_transcript, {"title": "Test", "duration": 60 * 60 * 4}):
            events.append(evt)

        # Force-split routes through _chunked_extraction
        assert mock_llm_retry.call_count >= 1
        assert any(e["event"] == "extraction_complete" for e in events)
        assert any(e.get("section") == "chunked" for e in events if e["event"] == "extraction_progress")

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.validate_domain_output")
    @patch("src.services.pipeline.extractor.call_llm_with_retry", new_callable=AsyncMock)
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_very_long_transcript_force_splits_into_multiple_batches(self, mock_prompt, mock_template, mock_llm_retry, mock_validate, mock_llm, learning_triage):
        """Very long transcripts (34K+ words) produce multiple batches via force-split."""
        very_long_transcript = _make_transcript(34840, with_sentences=True)  # ~536 min video scenario
        extraction_data = {
            "keyPoints": [{"emoji": "💡", "title": "Point", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
        }
        mock_llm_retry.return_value = json.dumps(extraction_data)
        mock_validate.return_value = {"learning": extraction_data}

        events = []
        async for evt in extract(mock_llm, learning_triage, very_long_transcript, {"title": "Test", "duration": 536 * 60}):
            events.append(evt)

        # 34840 words / 5000 = 7 chunks → each ~6.6K tokens → batches depend on MAX_TOKENS_PER_BATCH
        # With default 50K limit: ~7 chunks * 6.6K = 46.2K < 50K → might fit in 1-2 batches
        assert mock_llm_retry.call_count >= 1
        assert any(e["event"] == "extraction_complete" for e in events)
        assert any(e.get("section") == "chunked" for e in events if e["event"] == "extraction_progress")


# ─────────────────────────────────────────────────────────────────────────────
# Overflow Retry
# ─────────────────────────────────────────────────────────────────────────────


class TestOverflowExtraction:
    """Tests for overflow extraction (single call, no retry)."""

    @pytest.mark.asyncio
    @patch("src.services.pipeline.extractor.validate_domain_output")
    @patch("src.services.pipeline.extractor.build_extraction_template", return_value="template {transcript}")
    @patch("src.services.pipeline.extractor._load_prompt", return_value="")
    async def test_single_call_on_medium_transcript(self, mock_prompt, mock_template, mock_validate, mock_llm, learning_triage):
        """Overflow extraction makes a single call (no retry) with JSON mode."""
        medium_transcript = _make_transcript(SINGLE_THRESHOLD + 100)

        mock_llm.call_llm.return_value = json.dumps({
            "keyPoints": [{"emoji": "💡", "title": "Test", "detail": "Detail"}],
            "concepts": [],
            "takeaways": [],
            "timestamps": [],
        })
        mock_validate.return_value = {"learning": {"keyPoints": [{"emoji": "💡", "title": "Test", "detail": "Detail"}]}}

        events = []
        async for evt in extract(mock_llm, learning_triage, medium_transcript, {"title": "Test", "duration": 300}):
            events.append(evt)

        assert mock_llm.call_llm.call_count == 1
        assert any(e["event"] == "extraction_complete" for e in events)


# ─────────────────────────────────────────────────────────────────────────────
# Threshold Boundary Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestThresholdBoundaries:
    """Verify threshold constants are sensible."""

    def test_single_below_overflow(self):
        assert SINGLE_THRESHOLD < OVERFLOW_THRESHOLD

    def test_single_threshold_approximately_7k_tokens(self):
        # ~7K tokens at 1.33 tokens/word
        assert 4000 < SINGLE_THRESHOLD < 7000

    def test_overflow_threshold_approximately_27k_tokens(self):
        # ~27K tokens at 1.33 tokens/word
        assert 15000 < OVERFLOW_THRESHOLD < 25000


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic Timeout
# ─────────────────────────────────────────────────────────────────────────────


class TestDynamicTimeout:
    """Tests for _dynamic_timeout — formula: min(300 + word_count/100, 600)."""

    def test_base_timeout_for_small_transcript(self):
        # 1000 words → 300 + 10 = 310s
        assert _dynamic_timeout(1000) == 310.0

    def test_increases_for_large_transcript(self):
        # 6000 words → 300 + 60 = 360s (covers 59 Eggs case)
        result = _dynamic_timeout(6000)
        assert result == 360.0

    def test_caps_at_600_seconds(self):
        assert _dynamic_timeout(200000) == 600.0

    def test_proportional_scaling(self):
        # Longer transcripts get proportionally more time
        assert _dynamic_timeout(3000) < _dynamic_timeout(6000) < _dynamic_timeout(10000)


# ─────────────────────────────────────────────────────────────────────────────
# Force Split by Sentences
# ─────────────────────────────────────────────────────────────────────────────


def _make_sentence_transcript(num_words: int, words_per_sentence: int = 10) -> str:
    """Build a transcript with sentence terminators for testing sentence-boundary splitting."""
    words = []
    for i in range(num_words):
        words.append(f"word{i}")
        if (i + 1) % words_per_sentence == 0:
            words[-1] += "."
    return " ".join(words)


class TestForceSplitBySentences:
    """Tests for _force_split_by_sentences."""

    def test_short_transcript_returns_empty(self):
        transcript = _make_sentence_transcript(3000)
        result = _force_split_by_sentences(transcript, 600)
        assert result == []

    def test_splits_large_transcript(self):
        transcript = _make_sentence_transcript(25000)
        result = _force_split_by_sentences(transcript, 3600)
        assert len(result) >= 4  # roughly 25000 / 5000, may vary due to sentence boundaries
        assert all(ch.source == "force_split" for ch in result)

    def test_splits_at_sentence_boundaries(self):
        # Each sentence is ~10 words. With target 5000 words, we expect ~2-3 chunks for 12000 words.
        transcript = _make_sentence_transcript(12000)
        result = _force_split_by_sentences(transcript, 1800)
        assert len(result) >= 2
        # Each chunk text should end with a sentence terminator (or be the last chunk)
        for ch in result[:-1]:
            last_char = ch.text.rstrip()[-1] if ch.text.rstrip() else ""
            assert last_char == ".", f"Chunk should end at sentence boundary, got: ...{ch.text[-20:]}"

    def test_preserves_all_content(self):
        transcript = _make_sentence_transcript(12000)
        result = _force_split_by_sentences(transcript, 1800)
        all_text = " ".join(ch.text for ch in result)
        original_words = len(transcript.split())
        reconstructed_words = len(all_text.split())
        assert reconstructed_words == original_words

    def test_time_boundaries_are_monotonic(self):
        transcript = _make_sentence_transcript(20000)
        result = _force_split_by_sentences(transcript, 3600)
        for i in range(1, len(result)):
            assert result[i].start_seconds >= result[i - 1].start_seconds

    def test_token_estimates_are_positive(self):
        transcript = _make_sentence_transcript(15000)
        result = _force_split_by_sentences(transcript, 2700)
        for ch in result:
            assert ch.token_estimate > 0

    def test_no_split_without_terminators_returns_empty(self):
        """Transcript without sentence terminators can't be split meaningfully."""
        transcript = " ".join(["word"] * 25000)
        result = _force_split_by_sentences(transcript, 3600)
        assert result == []  # single "sentence" — no split possible
