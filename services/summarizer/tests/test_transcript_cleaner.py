"""Tests for advanced transcript cleaning service."""

import pytest

from src.services.transcript.cleaner import (
    remove_fillers,
    collapse_repetitions,
    clean_transcript_advanced,
)


class TestRemoveFillers:
    """Test filler word removal."""

    def test_removes_common_fillers(self):
        text = "So um I think uh this is basically a good idea you know"
        result = remove_fillers(text)
        assert "um" not in result.lower().split()
        assert "uh" not in result.lower().split()
        assert "basically" not in result.lower()
        assert "good idea" in result

    def test_preserves_meaningful_words(self):
        text = "The algorithm runs in O(n) time and uses a hash sort of mechanism"
        result = remove_fillers(text)
        assert "algorithm" in result
        assert "O(n)" in result
        assert "hash" in result

    def test_preserves_technical_terms(self):
        text = "Use React useState hook for state management"
        result = remove_fillers(text)
        assert "React" in result
        assert "useState" in result
        assert "state management" in result

    def test_preserves_numbers(self):
        text = "The function returns 42 and um takes 3 parameters"
        result = remove_fillers(text)
        assert "42" in result
        assert "3" in result

    def test_empty_text(self):
        assert remove_fillers("") == ""
        assert remove_fillers(None) is None

    def test_no_fillers_unchanged(self):
        text = "The quick brown fox jumps over the lazy dog."
        result = remove_fillers(text)
        assert result == text

    def test_case_insensitive(self):
        text = "UM UH basically BASICALLY you know YOU KNOW"
        result = remove_fillers(text)
        # All fillers should be removed regardless of case
        assert result.strip() == ""


class TestCollapseRepetitions:
    """Test near-duplicate sentence removal."""

    def test_removes_exact_duplicates(self):
        sentences = [
            "The weather is nice today.",
            "The weather is nice today.",
            "Something completely different.",
        ]
        result = collapse_repetitions(sentences)
        assert len(result) == 2

    def test_removes_near_duplicates(self):
        sentences = [
            "The weather is really nice today and I love going to the park.",
            "The weather is really nice today and I love going to the park too.",
            "Python is a programming language used for data science.",
        ]
        result = collapse_repetitions(sentences, threshold=0.85)
        # Near-duplicates should be collapsed
        assert len(result) <= 2

    def test_preserves_different_sentences(self):
        sentences = [
            "Python is a programming language.",
            "JavaScript runs in the browser.",
            "Rust is memory safe.",
        ]
        result = collapse_repetitions(sentences)
        assert len(result) == 3

    def test_single_sentence_unchanged(self):
        sentences = ["Hello world."]
        result = collapse_repetitions(sentences)
        assert result == sentences

    def test_empty_list(self):
        assert collapse_repetitions([]) == []

    def test_preserves_order(self):
        sentences = ["First.", "Second.", "Third."]
        result = collapse_repetitions(sentences)
        assert result == sentences

    def test_skips_tfidf_above_300_sentences(self):
        """TF-IDF is capped at 300 sentences to avoid O(n^2) blocking."""
        sentences = [f"Unique sentence number {i} about topic {i}." for i in range(400)]
        result = collapse_repetitions(sentences)
        # Should return all sentences unchanged (skips TF-IDF)
        assert len(result) == 400


class TestCleanTranscriptAdvanced:
    """Test full advanced cleaning pipeline."""

    def test_reduces_text_length(self):
        # Simulate a real transcript with fillers and repetition
        text = (
            "So um basically what we're going to do today is talk about um "
            "machine learning. You know machine learning is basically a way to "
            "teach computers. I mean computers can learn from data. "
            "So yeah that's basically what machine learning is about. "
            "You know what I mean. Okay so let's get started."
        )
        result = clean_transcript_advanced(text)
        # Should be shorter after filler removal
        assert len(result) < len(text)
        # Should preserve meaningful content
        assert "machine learning" in result

    def test_short_text_passthrough(self):
        text = "Hi there."
        result = clean_transcript_advanced(text)
        assert result == text

    def test_empty_text(self):
        assert clean_transcript_advanced("") == ""
        assert clean_transcript_advanced(None) == ""

    def test_preserves_code_content(self):
        text = (
            "First we import numpy. Then we create an array with numpy dot zeros. "
            "The function takes a shape parameter like 3 comma 4. "
            "This returns a 3 by 4 matrix of zeros."
        )
        result = clean_transcript_advanced(text)
        assert "numpy" in result
        assert "array" in result
        assert "3" in result
