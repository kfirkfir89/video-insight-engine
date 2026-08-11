"""Tests for Settings surface (project-score-9 6.1 dead-code sweep)."""

from src.config import Settings


class TestSettingsSurface:
    def test_vestigial_prompt_version_removed(self):
        """PROMPT_VERSION was declared but never read anywhere — deleted."""
        assert not hasattr(Settings, "PROMPT_VERSION")

    def test_pipeline_version_still_present(self):
        """PIPELINE_VERSION is live (Redis response-cache key) and must stay."""
        assert isinstance(Settings().PIPELINE_VERSION, str)
        assert Settings().PIPELINE_VERSION.startswith("v")
