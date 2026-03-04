"""Tests for prompt builder utilities."""

import pytest

from src.services.prompt_builders import build_output_type_framing


class TestBuildOutputTypeFraming:
    """Test build_output_type_framing() function."""

    def test_summary_returns_empty(self):
        assert build_output_type_framing("summary") == ""

    def test_empty_string_returns_empty(self):
        assert build_output_type_framing("") == ""

    def test_none_like_returns_empty(self):
        # Falsy values return empty
        assert build_output_type_framing("") == ""

    @pytest.mark.parametrize(
        "output_type, expected_label, expected_reminder_fragment",
        [
            ("recipe", "Recipe", "missing ingredient"),
            ("tutorial", "Tutorial", "reproducible"),
            ("workout", "Workout Plan", "exercises"),
            ("study_guide", "Study Guide", "teaching progression"),
            ("travel_plan", "Travel Plan", "locations"),
            ("review", "Review", "pros, cons"),
            ("podcast_notes", "Podcast Notes", "Attribute"),
            ("diy_guide", "DIY Guide", "materials"),
            ("game_guide", "Game Guide", "game mechanics"),
            ("music_guide", "Music Guide", "credits"),
        ],
    )
    def test_known_output_types(
        self, output_type: str, expected_label: str, expected_reminder_fragment: str,
    ):
        result = build_output_type_framing(output_type)
        assert result.startswith(f"OUTPUT TYPE: {expected_label}")
        assert expected_reminder_fragment in result

    def test_unknown_output_type_uses_fallback(self):
        result = build_output_type_framing("custom_thing")
        assert "OUTPUT TYPE: Custom Thing" in result
        assert "comprehensive, actionable content" in result

    def test_format_is_two_lines(self):
        result = build_output_type_framing("recipe")
        lines = result.strip().split("\n")
        assert len(lines) == 2
        assert lines[0].startswith("OUTPUT TYPE:")
