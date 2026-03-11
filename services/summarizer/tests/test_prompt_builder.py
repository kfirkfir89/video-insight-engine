"""Tests for prompt_builder schema injection system."""

import pytest
from unittest.mock import patch
from pathlib import Path

from src.services.pipeline.prompt_builder import build_extraction_prompt, build_extraction_template, _load_schema, SCHEMAS_DIR


class TestBuildExtractionPrompt:
    """Test build_extraction_prompt function."""

    def test_single_domain_tag(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=[],
            transcript="Hello world transcript",
            accuracy_rules="Be accurate",
            title="My Trip",
            duration_minutes=30,
        )

        assert "TRAVEL DOMAIN" in prompt
        assert "Hello world transcript" in prompt
        assert "Be accurate" in prompt
        assert "My Trip" in prompt
        assert "30" in prompt

    def test_multiple_domain_tags(self):
        prompt = build_extraction_prompt(
            content_tags=["travel", "food"],
            modifiers=[],
            transcript="Test transcript",
            accuracy_rules="Rules",
            title="Travel & Food",
        )

        assert "TRAVEL DOMAIN" in prompt
        assert "FOOD DOMAIN" in prompt

    def test_domain_with_modifier(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=["finance"],
            transcript="Test transcript",
            accuracy_rules="Rules",
        )

        assert "TRAVEL DOMAIN" in prompt
        assert "FINANCE MODIFIER" in prompt

    def test_multiple_modifiers(self):
        prompt = build_extraction_prompt(
            content_tags=["food"],
            modifiers=["narrative", "finance"],
            transcript="Test",
            accuracy_rules="Rules",
        )

        assert "FOOD DOMAIN" in prompt
        assert "NARRATIVE MODIFIER" in prompt
        assert "FINANCE MODIFIER" in prompt

    def test_all_eight_domains(self):
        all_tags = ["travel", "food", "learning", "review", "tech", "fitness", "music", "project"]
        for tag in all_tags:
            prompt = build_extraction_prompt(
                content_tags=[tag],
                modifiers=[],
                transcript="Test",
                accuracy_rules="Rules",
            )
            assert tag.upper() in prompt, f"Domain {tag} not found in prompt"

    def test_empty_tags_uses_fallback(self):
        prompt = build_extraction_prompt(
            content_tags=[],
            modifiers=[],
            transcript="Test",
            accuracy_rules="Rules",
        )

        assert "general-purpose extraction" in prompt

    def test_unknown_tag_skipped(self):
        prompt = build_extraction_prompt(
            content_tags=["nonexistent_domain"],
            modifiers=[],
            transcript="Test",
            accuracy_rules="Rules",
        )

        # Should not crash, unknown tag just skipped
        assert "NONEXISTENT_DOMAIN" not in prompt or "general-purpose" in prompt

    def test_uses_replace_not_format(self):
        """Ensure user-controlled content with format specifiers doesn't crash."""
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="I have {curly_braces} and {more}",
            accuracy_rules="Rule: use {templates} safely",
            title="Video with {special} chars",
        )

        assert "{curly_braces}" in prompt
        assert "{more}" in prompt
        assert "{templates}" in prompt
        assert "{special}" in prompt

    def test_title_and_duration_injected(self):
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="Test",
            accuracy_rules="Rules",
            title="My Great Video",
            duration_minutes=45,
        )

        assert "My Great Video" in prompt
        assert "45" in prompt

    def test_base_template_content_present(self):
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="Test",
            accuracy_rules="Rules",
        )

        assert "VIE VOICE RULES" in prompt
        assert "DATA RULES" in prompt
        assert "OUTPUT FORMAT" in prompt


class TestLoadSchema:
    """Test _load_schema helper."""

    def test_loads_existing_schema(self):
        schema = _load_schema("travel")
        assert len(schema) > 0
        assert "TravelData" in schema

    def test_returns_empty_for_missing_schema(self):
        schema = _load_schema("nonexistent_xyz")
        assert schema == ""

    def test_all_domain_schemas_exist(self):
        domains = ["travel", "food", "learning", "review", "tech", "fitness", "music", "project"]
        for domain in domains:
            schema_path = SCHEMAS_DIR / f"{domain}.txt"
            assert schema_path.exists(), f"Missing schema file: {schema_path}"

    def test_all_modifier_schemas_exist(self):
        modifiers = ["narrative", "finance"]
        for modifier in modifiers:
            schema_path = SCHEMAS_DIR / f"{modifier}.txt"
            assert schema_path.exists(), f"Missing modifier schema: {schema_path}"


class TestBuildExtractionTemplate:
    """Test build_extraction_template function (leaves {transcript} as placeholder)."""

    def test_transcript_placeholder_preserved(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            accuracy_rules="Be accurate",
            title="My Video",
            duration_minutes=30,
        )

        # {transcript} should NOT be replaced
        assert "{transcript}" in template
        # Other placeholders should be replaced
        assert "{domain_schemas}" not in template
        assert "{accuracy_rules}" not in template
        assert "{title}" not in template
        assert "{duration_minutes}" not in template

    def test_domain_schemas_injected(self):
        template = build_extraction_template(
            content_tags=["travel", "food"],
            modifiers=["narrative"],
            accuracy_rules="Rules",
        )

        assert "TRAVEL DOMAIN" in template
        assert "FOOD DOMAIN" in template
        assert "NARRATIVE MODIFIER" in template
        assert "{transcript}" in template

    def test_accuracy_rules_injected(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            accuracy_rules="Custom accuracy rules here",
        )

        assert "Custom accuracy rules here" in template

    def test_title_and_duration_injected(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            accuracy_rules="Rules",
            title="Great Video Title",
            duration_minutes=45,
        )

        assert "Great Video Title" in template
        assert "45" in template

    def test_empty_tags_uses_fallback(self):
        template = build_extraction_template(
            content_tags=[],
            modifiers=[],
            accuracy_rules="Rules",
        )

        assert "general-purpose extraction" in template
        assert "{transcript}" in template
