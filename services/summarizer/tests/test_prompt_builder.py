"""Tests for prompt_builder schema injection system."""

from src.services.pipeline.prompt_builder import (
    build_extraction_prompt,
    build_extraction_template,
    build_tab_goals,
    _load_schema,
    SCHEMAS_DIR,
)


class TestBuildTabGoals:
    """Test build_tab_goals function."""

    def test_empty_tabs_returns_fallback(self):
        result = build_tab_goals([])
        assert "best judgment" in result

    def test_formats_tabs_with_goal(self):
        tabs = [
            {"id": "itinerary", "label": "Itinerary", "component": "spot_explorer", "goal": "Browse day-by-day spots"},
            {"id": "budget", "label": "Budget", "component": "budget", "goal": "See cost breakdown"},
        ]
        result = build_tab_goals(tabs)
        assert 'Tab: "Itinerary" (spot_explorer)' in result
        assert "Browse day-by-day spots" in result
        assert 'Tab: "Budget" (budget)' in result

    def test_handles_missing_fields_gracefully(self):
        tabs = [{"id": "overview"}]
        result = build_tab_goals(tabs)
        assert 'Tab: "overview" (overview)' in result


class TestBuildExtractionPrompt:
    """Test build_extraction_prompt function."""

    def test_single_domain_tag(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=[],
            transcript="Hello world transcript",
            quality_rules="Be accurate",
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
            quality_rules="Rules",
            title="Travel & Food",
        )

        assert "TRAVEL DOMAIN" in prompt
        assert "FOOD DOMAIN" in prompt

    def test_domain_with_modifier(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=["finance"],
            transcript="Test transcript",
            quality_rules="Rules",
        )

        assert "TRAVEL DOMAIN" in prompt
        assert "FINANCE MODIFIER" in prompt

    def test_multiple_modifiers(self):
        prompt = build_extraction_prompt(
            content_tags=["food"],
            modifiers=["narrative", "finance"],
            transcript="Test",
            quality_rules="Rules",
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
                quality_rules="Rules",
            )
            assert tag.upper() in prompt, f"Domain {tag} not found in prompt"

    def test_empty_tags_uses_fallback(self):
        prompt = build_extraction_prompt(
            content_tags=[],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
        )

        assert "general-purpose extraction" in prompt

    def test_unknown_tag_skipped(self):
        prompt = build_extraction_prompt(
            content_tags=["nonexistent_domain"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
        )

        # Should not crash, unknown tag just skipped
        assert "NONEXISTENT_DOMAIN" not in prompt or "general-purpose" in prompt

    def test_uses_replace_not_format(self):
        """Ensure user-controlled content with format specifiers doesn't crash."""
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="I have {curly_braces} and {more}",
            quality_rules="Rule: use {templates} safely",
            title="Video with special chars",
        )

        assert "{curly_braces}" in prompt
        assert "{more}" in prompt
        assert "{templates}" in prompt

    def test_title_and_duration_injected(self):
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
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
            quality_rules="Rules",
        )

        assert "<voice>" in prompt
        assert "<quality_rules>" in prompt
        assert "<output_rules>" in prompt

    def test_user_goal_injected(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
            user_goal="Plan a trip to Japan",
        )

        assert "Plan a trip to Japan" in prompt

    def test_tab_goals_injected(self):
        prompt = build_extraction_prompt(
            content_tags=["travel"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
            tab_goals="Tab: \"Itinerary\" (spot_explorer) — Browse spots\nTab: \"Budget\" (budget) — See costs",
        )

        assert "Itinerary" in prompt
        assert "Browse spots" in prompt

    def test_interactive_component_map_present(self):
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
        )

        assert "Checklist" in prompt
        assert "SpotExplorer" in prompt
        assert "FlashDeck" in prompt

    def test_no_duplicated_rules(self):
        """Ensure quality_rules replaces old duplicated DATA RULES + WHERE VOICE APPLIES."""
        prompt = build_extraction_prompt(
            content_tags=["learning"],
            modifiers=[],
            transcript="Test",
            quality_rules="Rules",
        )

        # Old duplicated sections should NOT be present
        assert "DATA RULES:" not in prompt
        assert "WHERE VOICE APPLIES:" not in prompt
        assert "ACCURACY RULES:" not in prompt

    def test_multi_domain_with_all_placeholders(self):
        """Verify a multi-domain prompt has all placeholders replaced."""
        prompt = build_extraction_prompt(
            content_tags=["travel", "food"],
            modifiers=["finance"],
            transcript="Test transcript content",
            quality_rules="Quality rules here",
            title="My Trip Video",
            duration_minutes=30,
            user_goal="Plan a budget trip with food stops",
            tab_goals="Tab: \"Itinerary\" (spot_explorer) — Trip Plan\nTab: \"Ingredients\" (checklist) — Recipe",
        )

        # No unreplaced placeholders
        assert "{tab_goals}" not in prompt
        assert "{user_goal}" not in prompt
        assert "{quality_rules}" not in prompt
        assert "{title}" not in prompt
        assert "{domain_schemas}" not in prompt
        assert "{transcript}" not in prompt

        # Content present
        assert "TRAVEL DOMAIN" in prompt
        assert "FOOD DOMAIN" in prompt
        assert "FINANCE MODIFIER" in prompt
        assert "Plan a budget trip" in prompt
        assert "Trip Plan" in prompt


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

    def test_schemas_have_ui_hints(self):
        """Verify domain schemas contain UI rendering hints."""
        domains_with_hints = ["travel", "food", "learning", "review", "tech", "fitness", "project", "narrative", "music"]
        for domain in domains_with_hints:
            schema = _load_schema(domain)
            assert "> UI:" in schema or "→ UI:" in schema, f"Schema {domain} missing UI hints"


class TestBuildExtractionTemplate:
    """Test build_extraction_template function (leaves {transcript} as placeholder)."""

    def test_transcript_placeholder_preserved(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Be accurate",
            title="My Video",
            duration_minutes=30,
        )

        # {transcript} should NOT be replaced
        assert "{transcript}" in template
        # Other placeholders should be replaced
        assert "{domain_schemas}" not in template
        assert "{quality_rules}" not in template
        assert "{title}" not in template
        assert "{duration_minutes}" not in template
        assert "{user_goal}" not in template
        assert "{tab_goals}" not in template

    def test_domain_schemas_injected(self):
        template = build_extraction_template(
            content_tags=["travel", "food"],
            modifiers=["narrative"],
            quality_rules="Rules",
        )

        assert "TRAVEL DOMAIN" in template
        assert "FOOD DOMAIN" in template
        assert "NARRATIVE MODIFIER" in template
        assert "{transcript}" in template

    def test_quality_rules_injected(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Custom quality rules here",
        )

        assert "Custom quality rules here" in template

    def test_title_and_duration_injected(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Rules",
            title="Great Video Title",
            duration_minutes=45,
        )

        assert "Great Video Title" in template
        assert "45" in template

    def test_empty_tags_uses_fallback(self):
        template = build_extraction_template(
            content_tags=[],
            modifiers=[],
            quality_rules="Rules",
        )

        assert "general-purpose extraction" in template
        assert "{transcript}" in template

    def test_user_goal_and_tab_goals_injected(self):
        template = build_extraction_template(
            content_tags=["travel"],
            modifiers=[],
            quality_rules="Rules",
            user_goal="Plan a trip",
            tab_goals="Tab: \"Itinerary\" (spot_explorer) — Trip Plan",
        )

        assert "Plan a trip" in template
        assert "Trip Plan" in template
        assert "{transcript}" in template

    def test_default_user_goal_when_empty(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Rules",
        )

        assert "Extract the most useful information" in template

    def test_video_context_injected(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Rules",
            video_context="Creator: indie dev (enthusiastic)\nCore promise: Build a CLI tool",
        )

        assert "indie dev" in template
        assert "Build a CLI tool" in template
        assert "{video_context}" not in template

    def test_video_context_default_when_empty(self):
        template = build_extraction_template(
            content_tags=["learning"],
            modifiers=[],
            quality_rules="Rules",
        )

        assert "Not available" in template
        assert "{video_context}" not in template
