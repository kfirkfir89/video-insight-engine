"""Registry + component-inference tests (ASSEMBLER_REGISTRY, infer_component, domains.json sync guard)."""

from src.services.pipeline.assembly import (
    ASSEMBLER_REGISTRY,
    infer_component,
)


# ─── resolve_data_source ───


# ─── Component Inference ───


class TestInferComponent:
    def test_known_tab_ids(self):
        assert infer_component("itinerary") == "spot_explorer"
        assert infer_component("ingredients") == "checklist"
        # Video-to-action overhaul: renamed component routes
        assert infer_component("exercises") == "workout_room"
        assert infer_component("quizzes") == "quiz_arena"
        assert infer_component("code") == "code_playground"
        # Verdict tab IDs now route to comparison (verdict folds into ReviewSummary header)
        assert infer_component("verdict") == "comparison"
        # New overhaul-era routes
        assert infer_component("concepts") == "concept_canvas"
        assert infer_component("packing") == "packing_mission"
        assert infer_component("gallery") == "video_filmstrip"
        assert infer_component("lyrics") == "lyrics_karaoke"

    def test_unknown_tab_id(self):
        assert infer_component("unknown_tab") == "display_section"


# ─── Registry Coverage ───


class TestRegistryCoverage:
    def test_all_registered(self):
        # 2026-05-29 cleanup: legacy aliases removed. P2 added 6 secondary-tier
        # assemblers; P3B added `connect_canvas` (primary); P5b added
        # `claims_tracker`; P5c/d added `tier_list` + `formation_diagram`
        # (primaries). The registry now holds 22 primaries + display_section +
        # 6 secondaries = 29.
        expected = {
            # primary (22)
            "spot_explorer",
            "moment_track",
            "comparison",
            "info_grid",
            "checklist",
            "step_player",
            "flash_deck",
            "budget",
            "overview",
            "concept_canvas",
            "connect_canvas",
            "step_flow_canvas",
            "comparison_radar",
            "code_playground",
            "quiz_arena",
            "packing_mission",
            "workout_room",
            "lyrics_karaoke",
            "video_filmstrip",
            "claims_tracker",
            "tier_list",
            "formation_diagram",
            # display
            "display_section",
            # secondary (6, P2)
            "stat_banner",
            "tip_callout",
            "summary_header",
            "diagram_card",
            "frame_strip",
            "quick_quiz",
        }
        assert set(ASSEMBLER_REGISTRY.keys()) == expected

    def test_registry_has_29_entries(self):
        # 27 → 29 after adding `tier_list` + `formation_diagram` (P5c/d).
        assert len(ASSEMBLER_REGISTRY) == 29

    def test_all_assemblers_handle_none(self):
        for name, assembler in ASSEMBLER_REGISTRY.items():
            result = assembler({}, None, {}, None)
            assert result is None, f"{name} should return None for None data"

    def test_all_assemblers_handle_empty_list(self):
        for name, assembler in ASSEMBLER_REGISTRY.items():
            # Assemblers that expect a dict / read extraction directly
            if name in (
                "overview",
                "display_section",
                "comparison",
                "comparison_radar",
                "budget",
                "info_grid",
                "lyrics_karaoke",
            ):
                continue
            result = assembler({}, [], {}, None)
            assert result is None, f"{name} should return None for empty list"


# ─── Sync Guard: domains.json ↔ ASSEMBLER_REGISTRY ───


class TestSyncGuard:
    def test_assembler_registry_matches_domains_json_components(self):
        """domains.json components[] must all have an ASSEMBLER_REGISTRY entry,
        and every registry key must be a known component — primary (components[]),
        secondary (componentTiers), or the display_section fallback.

        interactive-overhaul-v2 P2 split components into tiers: primaries are
        planner-selectable; secondaries are attachment-only. Both are assemblable.
        """
        import json
        from pathlib import Path

        domains_path = (
            Path(__file__).resolve().parent.parent.parent.parent
            / "packages"
            / "shared"
            / "src"
            / "config"
            / "domains.json"
        )
        config = json.loads(domains_path.read_text())
        json_components = frozenset(config["components"])
        secondaries = frozenset(
            name for name, tier in config.get("componentTiers", {}).items() if tier == "secondary"
        )
        registry_keys = frozenset(ASSEMBLER_REGISTRY.keys())

        # Every primary component must be assemblable.
        in_json_not_registry = json_components - registry_keys
        assert not in_json_not_registry, (
            f"components[] in domains.json but NOT in ASSEMBLER_REGISTRY: {in_json_not_registry}. "
            "Add the assembler function and register it."
        )

        # Every registry key must be a known primary, secondary, or the fallback.
        known = json_components | secondaries | {"display_section"}
        orphan_registry = registry_keys - known
        assert not orphan_registry, (
            f"ASSEMBLER_REGISTRY keys with no tier/component: {orphan_registry}. "
            "Add the name to domains.json components[] (primary) or componentTiers (secondary)."
        )
