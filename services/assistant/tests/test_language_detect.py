"""Tests for language detection utility."""

from __future__ import annotations

import pytest

from src.utils.language_detect import _detect_by_script, detect_language


class TestDetectLanguage:
    """detect_language() behaviour."""

    def test_should_return_en_for_english_text(self):
        result = detect_language("This is a simple English sentence for testing purposes.")
        assert result == "en"

    def test_should_return_en_for_empty_string(self):
        result = detect_language("")
        assert result == "en"

    def test_should_return_en_for_very_short_text(self):
        result = detect_language("Hello")
        assert result == "en"

    def test_should_detect_hebrew_text(self):
        result = detect_language("שלום עולם זהו טקסט בעברית לבדיקה")
        assert result == "he"

    def test_should_detect_arabic_text(self):
        result = detect_language("مرحبا بالعالم هذا نص عربي للاختبار")
        assert result == "ar"


class TestDetectByScript:
    """_detect_by_script() internal script detection."""

    def test_should_return_he_for_hebrew_characters(self):
        result = _detect_by_script("שלום עולם זהו טקסט בעברית לבדיקה")
        assert result == "he"

    def test_should_return_ar_for_arabic_characters(self):
        result = _detect_by_script("مرحبا بالعالم هذا نص عربي للاختبار")
        assert result == "ar"

    def test_should_return_none_for_latin_text(self):
        result = _detect_by_script("This is plain English text with no special scripts.")
        assert result is None

    def test_should_return_none_for_short_text(self):
        result = _detect_by_script("ab")
        assert result is None
