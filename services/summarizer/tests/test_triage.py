"""Tests for the triage module — post-dead-code-sweep surface (project-score-9 6.1).

The LLM-driven ``run_triage`` stage was deleted (superseded by the plan
stage); ``TriageResult`` is the only surviving export. These tests pin that
contract so the dead path cannot silently return.
"""

import dataclasses

import pytest

from src.services.pipeline import triage
from src.services.pipeline.triage import TriageResult


class TestTriageModuleSurface:
    """The module exposes only the TriageResult carrier."""

    def test_run_triage_is_deleted(self):
        """run_triage was replaced by the plan stage and must not exist."""
        assert not hasattr(triage, "run_triage")

    def test_no_llm_or_prompt_machinery_remains(self):
        """Prompt paths and LLM helpers went with run_triage."""
        for dead_name in (
            "PROMPT_PATH",
            "COMPONENT_TOOLKIT_PATH",
            "CONFIDENCE_THRESHOLD",
            "_build_fallback",
            "_parse_triage_response",
        ):
            assert not hasattr(triage, dead_name), f"{dead_name} should be deleted"


class TestTriageResult:
    """TriageResult keeps its learning-first defaults for downstream stages."""

    def test_defaults(self):
        result = TriageResult()
        assert result.content_tags == ["learning"]
        assert result.modifiers == []
        assert result.primary_tag == "learning"
        assert result.user_goal == "General summary of the video content"
        assert result.tabs == []
        assert result.confidence == 0.0

    def test_default_lists_are_not_shared_between_instances(self):
        a = TriageResult()
        b = TriageResult()
        a.content_tags.append("food")
        a.tabs.append({"id": "x"})
        assert b.content_tags == ["learning"]
        assert b.tabs == []

    def test_is_dataclass_with_expected_fields(self):
        field_names = {f.name for f in dataclasses.fields(TriageResult)}
        assert field_names == {
            "content_tags",
            "modifiers",
            "primary_tag",
            "user_goal",
            "tabs",
            "confidence",
        }

    def test_accepts_plan_stage_shape(self):
        result = TriageResult(
            content_tags=["food", "learning"],
            modifiers=["budget"],
            primary_tag="food",
            user_goal="Learn a recipe",
            tabs=[{"id": "ingredients", "label": "Ingredients", "component": "checklist"}],
            confidence=0.97,
        )
        assert result.primary_tag == "food"
        assert result.tabs[0]["component"] == "checklist"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
