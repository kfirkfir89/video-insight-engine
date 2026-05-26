"""Tests for the sound-only force-English gate.

Whisper hallucinates a language (often Chinese or Japanese) on instrumental
music with no real speech. The gate flips ``ctx.language`` to ``"en"`` only
when YouTube reports the video as music AND words-per-second is below the
configured floor — vocal songs in any language sit well above this floor.
"""

from __future__ import annotations

import pytest

from src.utils.language_utils import is_sound_only_video

WPS_THRESHOLD = 0.15


class TestIsSoundOnlyVideo:
    """The Mendelssohn / Turkish-pop / sparse-edge-case behavior of the gate."""

    def test_should_force_english_when_music_has_zero_words(self):
        """Mendelssohn case: a 5-minute instrumental piece with zero transcribed words."""
        assert is_sound_only_video(
            is_music=True,
            language="zh",
            raw_text="",
            duration=300,
            wps_threshold=WPS_THRESHOLD,
        ) is True

    def test_should_force_english_when_music_has_a_handful_of_hallucinated_words(self):
        """A 10-minute trance track with ~5 fake words is still sound-only."""
        assert is_sound_only_video(
            is_music=True,
            language="zh",
            raw_text="one two three four five",
            duration=600,
            wps_threshold=WPS_THRESHOLD,
        ) is True

    def test_should_preserve_language_for_vocal_song(self):
        """A Turkish pop song has real lyrics — ~0.33 wps clears the 0.15 floor."""
        # 100 words across 300s = 0.33 wps
        text = " ".join(["kelime"] * 100)
        assert is_sound_only_video(
            is_music=True,
            language="tr",
            raw_text=text,
            duration=300,
            wps_threshold=WPS_THRESHOLD,
        ) is False

    def test_should_not_apply_gate_to_non_music_videos(self):
        """A non-music video with zero words (silent documentary?) is out of scope."""
        assert is_sound_only_video(
            is_music=False,
            language="he",
            raw_text="",
            duration=600,
            wps_threshold=WPS_THRESHOLD,
        ) is False

    def test_should_not_apply_gate_to_already_english_videos(self):
        """English music videos don't need the override — gate stays silent."""
        assert is_sound_only_video(
            is_music=True,
            language="en",
            raw_text="",
            duration=300,
            wps_threshold=WPS_THRESHOLD,
        ) is False

    def test_should_not_apply_gate_when_language_is_none(self):
        """No detected language means nothing to override."""
        assert is_sound_only_video(
            is_music=True,
            language=None,
            raw_text="",
            duration=300,
            wps_threshold=WPS_THRESHOLD,
        ) is False

    def test_should_handle_zero_duration_without_crashing(self):
        """Defensive: division-by-zero guard if duration is missing."""
        # With duration coerced to 1s and no words, wps is 0 → below threshold → True.
        assert is_sound_only_video(
            is_music=True,
            language="zh",
            raw_text="",
            duration=0,
            wps_threshold=WPS_THRESHOLD,
        ) is True

    @pytest.mark.parametrize(
        ("word_count", "duration", "expected"),
        [
            (0, 300, True),     # 0.00 wps — instrumental
            (10, 300, True),    # 0.03 wps — sparse hallucination
            (44, 300, True),    # 0.147 wps — below threshold
            (45, 300, False),   # 0.15  wps — exactly at threshold, not below
            (100, 300, False),  # 0.33  wps — sparse vocal song, well above
        ],
    )
    def test_should_classify_wps_around_the_threshold(
        self, word_count: int, duration: int, expected: bool,
    ):
        """Boundary check: gate fires strictly below 0.15 wps, otherwise stays silent."""
        text = " ".join(["w"] * word_count)
        assert is_sound_only_video(
            is_music=True,
            language="zh",
            raw_text=text,
            duration=duration,
            wps_threshold=WPS_THRESHOLD,
        ) is expected
