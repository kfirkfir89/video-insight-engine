"""Tests for transcript chunking service."""

import pytest

from src.services.vector.chunking import chunk_transcript


class TestChunkTranscript:
    """Test chunk_transcript function."""

    def test_empty_text_returns_empty(self):
        assert chunk_transcript("") == []
        assert chunk_transcript("   ") == []
        assert chunk_transcript(None) == []

    def test_short_text_single_chunk(self):
        text = "Hello world. This is a test."
        chunks = chunk_transcript(text, max_chunk_chars=1000)
        assert len(chunks) == 1
        assert chunks[0]["text"] == text
        assert chunks[0]["start_char"] == 0

    def test_long_text_multiple_chunks(self):
        # Create text that exceeds max_chunk_chars
        sentences = [f"Sentence number {i} with some content." for i in range(50)]
        text = " ".join(sentences)
        chunks = chunk_transcript(text, max_chunk_chars=200, overlap_chars=50)
        assert len(chunks) > 1
        # All chunks should have text
        for chunk in chunks:
            assert chunk["text"]
            assert chunk["start_char"] >= 0
            assert chunk["end_char"] > chunk["start_char"]

    def test_overlap_between_chunks(self):
        sentences = [f"Sentence {i} has some words." for i in range(20)]
        text = " ".join(sentences)
        chunks = chunk_transcript(text, max_chunk_chars=100, overlap_chars=30)

        if len(chunks) >= 2:
            # Second chunk should start before first chunk ends (overlap)
            assert chunks[1]["start_char"] < chunks[0]["end_char"]

    def test_sentence_boundary_splitting(self):
        text = "First sentence. Second sentence. Third sentence."
        chunks = chunk_transcript(text, max_chunk_chars=35, overlap_chars=0)
        # Should split at sentence boundaries, not mid-sentence
        for chunk in chunks:
            # Each chunk should end with a complete word
            assert not chunk["text"].endswith(" ")

    def test_no_sentences_still_works(self):
        text = "just some text without any sentence boundaries at all"
        chunks = chunk_transcript(text, max_chunk_chars=1000)
        assert len(chunks) == 1
        assert chunks[0]["text"] == text

    def test_start_end_chars_are_monotonic(self):
        sentences = [f"Test sentence number {i}." for i in range(30)]
        text = " ".join(sentences)
        chunks = chunk_transcript(text, max_chunk_chars=150, overlap_chars=30)
        # start_char should be non-decreasing
        for i in range(1, len(chunks)):
            assert chunks[i]["start_char"] >= chunks[i - 1]["start_char"]
