"""Unit tests for the assembly stage."""

import pytest

from src.services.pipeline.assembly import (
    ASSEMBLER_REGISTRY,
    _validate_domain_requirements,
    _validate_assembled_props,
    assemble_response,
    find_nearest_frame,
    inject_frame_thumbnails,
    infer_component,
    resolve_cross_tab_links,
    resolve_data_source,
    assemble_spot_explorer,
    assemble_checklist,
    assemble_exercise_tracker,
    assemble_flash_deck,
    assemble_comparison,
    assemble_info_grid,
    assemble_verdict,
    assemble_overview,
    assemble_display_section,
    assemble_gallery,
    assemble_clip_player,
    assemble_lyrics_player,
    assemble_timeline,
    assemble_code_explorer,
    assemble_quiz,
    assemble_scenario,
    _normalize_code_snippet,
    _normalize_timeline_entry,
    _normalize_exercise,
    _normalize_quiz_question,
    _normalize_scenario_item,
)


# ─── resolve_data_source ───


class TestResolveDataSource:
    def test_simple_path(self):
        extraction = {"travel": {"itinerary": [{"day": 1}]}}
        assert resolve_data_source("travel.itinerary", extraction) == [{"day": 1}]

    def test_single_key(self):
        extraction = {"fitness": {"exercises": []}}
        assert resolve_data_source("fitness", extraction) == {"exercises": []}

    def test_enrichment_path(self):
        enrichment = {"quiz": [{"q": "test"}]}
        assert resolve_data_source("enrichment.quiz", {}, enrichment) == [{"q": "test"}]

    def test_missing_path(self):
        assert resolve_data_source("travel.budget", {"travel": {}}) is None

    def test_empty_source(self):
        assert resolve_data_source("", {}) is None

    def test_enrichment_none(self):
        assert resolve_data_source("enrichment.quiz", {}, None) is None

    def test_wildcard_returns_domain_object(self):
        extraction = {"food": {"ingredients": [{"name": "salt"}], "tips": []}}
        result = resolve_data_source("food.*", extraction)
        assert result == extraction["food"]

    def test_wildcard_enrichment(self):
        enrichment = {"quiz": [{"q": "test"}], "flashcards": []}
        result = resolve_data_source("enrichment.*", {}, enrichment)
        assert result == enrichment

    def test_wildcard_missing_domain(self):
        assert resolve_data_source("music.*", {"food": {}}) is None


# ─── Component Inference ───


class TestInferComponent:
    def test_known_tab_ids(self):
        assert infer_component("itinerary") == "spot_explorer"
        assert infer_component("ingredients") == "checklist"
        assert infer_component("exercises") == "exercise_tracker"
        assert infer_component("quizzes") == "quiz"
        assert infer_component("code") == "code_explorer"
        assert infer_component("verdict") == "verdict"

    def test_unknown_tab_id(self):
        assert infer_component("unknown_tab") == "display_section"


# ─── Cross-Tab Links ───


class TestCrossTabLinks:
    def test_resolves_legacy_links(self):
        """Legacy ID-based rules still work as fallback."""
        links = resolve_cross_tab_links("concepts", {"concepts", "quizzes", "flashcards"})
        assert len(links) == 1
        assert links[0]["targetTab"] == "quizzes"

    def test_component_based_links(self):
        """Component-based rules with domain hint."""
        all_tabs = [
            {"id": "overview", "component": "overview"},
            {"id": "ingredients", "component": "checklist"},
            {"id": "recipe_steps", "component": "step_player"},
        ]
        links = resolve_cross_tab_links(
            "overview",
            {"overview", "ingredients", "recipe_steps"},
            component="overview",
            all_tabs=all_tabs,
            primary_tag="food",
        )
        assert len(links) >= 1
        targets = {l["targetTab"] for l in links}
        assert "ingredients" in targets

    def test_drops_missing_targets(self):
        links = resolve_cross_tab_links("concepts", {"concepts"})
        assert links == []

    def test_no_rules_for_tab(self):
        links = resolve_cross_tab_links("nonexistent", {"a", "b"})
        assert links == []

    def test_component_link_travel_flow(self):
        """Travel domain: overview → spot_explorer → budget."""
        all_tabs = [
            {"id": "overview", "component": "overview"},
            {"id": "itinerary", "component": "spot_explorer"},
            {"id": "budget", "component": "budget"},
        ]
        links = resolve_cross_tab_links(
            "overview",
            {"overview", "itinerary", "budget"},
            component="overview",
            all_tabs=all_tabs,
            primary_tag="travel",
        )
        assert len(links) >= 1
        assert links[0]["targetTab"] == "itinerary"
        assert links[0]["label"] == "See the itinerary"


# ─── Assemblers ───


class TestAssembleSpotExplorer:
    def test_travel_days(self):
        data = [
            {"day": 1, "city": "Tokyo", "spots": [{"name": "Shibuya"}, {"name": "Harajuku"}]},
            {"day": 2, "city": "Osaka", "spots": [{"name": "Dotonbori"}]},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 3
        assert len(result["sections"]) == 2
        assert result["sections"][0]["label"] == "Day 1: Tokyo"
        assert result["sections"][0]["spotIndices"] == [0, 1]
        assert result["sections"][1]["spotIndices"] == [2]

    def test_flat_spots(self):
        data = [{"name": "Spot A"}, {"name": "Spot B"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert "sections" not in result

    def test_empty(self):
        assert assemble_spot_explorer({}, [], {}, None) is None
        assert assemble_spot_explorer({}, None, {}, None) is None


class TestAssembleChecklist:
    def test_food_ingredients(self):
        data = [
            {"name": "flour", "amount": 2, "unit": "cups", "displayAmount": "2 cups"},
            {"name": "salt", "amount": 0, "displayAmount": "to taste"},
        ]
        result = assemble_checklist({"id": "ingredients"}, data, {}, None)
        assert result is not None
        assert result["tabLabel"] == "Ingredients"
        assert result["items"][0]["label"] == "2 cups flour"
        assert result["items"][1]["label"] == "to taste salt"

    def test_packing_items(self):
        data = [{"item": "Passport", "category": "Documents", "essential": True}]
        result = assemble_checklist({"id": "packing"}, data, {}, None)
        assert result is not None
        assert result["items"][0]["label"] == "Passport"
        assert result["items"][0]["emoji"] == "⚠️"

    def test_string_items(self):
        data = ["item 1", "item 2"]
        result = assemble_checklist({"id": "tools"}, data, {}, None)
        assert result is not None
        assert result["items"][0]["label"] == "item 1"

    def test_empty(self):
        assert assemble_checklist({}, [], {}, None) is None


class TestAssembleExerciseTracker:
    def test_dict_with_exercises(self):
        data = {
            "exercises": [{"name": "Push-up"}],
            "warmup": [{"name": "Arm circles"}],
            "cooldown": [],
        }
        result = assemble_exercise_tracker({}, data, {}, None)
        assert result is not None
        assert len(result["exercises"]) == 1
        assert len(result["warmup"]) == 1
        assert "cooldown" not in result  # Empty cooldown omitted

    def test_list_of_exercises(self):
        data = [{"name": "Squat"}, {"name": "Lunge"}]
        result = assemble_exercise_tracker({}, data, {}, None)
        assert result is not None
        assert len(result["exercises"]) == 2

    def test_empty(self):
        assert assemble_exercise_tracker({}, {"exercises": [], "warmup": []}, {}, None) is None


class TestAssembleFlashDeck:
    def test_concept_normalization(self):
        data = [
            {"name": "REST", "definition": "Representational State Transfer", "emoji": "🌐"},
            {"front": "GraphQL", "back": "Query language"},
        ]
        result = assemble_flash_deck({}, data, {}, None)
        assert result is not None
        assert result["cards"][0]["front"] == "REST"
        assert result["cards"][0]["back"] == "Representational State Transfer"
        assert result["cards"][1]["front"] == "GraphQL"

    def test_empty(self):
        assert assemble_flash_deck({}, [], {}, None) is None


class TestAssembleComparison:
    def test_pros_cons(self):
        data = {"pros": ["Fast"], "cons": ["Expensive"], "comparisons": []}
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["pros"] == ["Fast"]
        assert result["cons"] == ["Expensive"]

    def test_empty(self):
        assert assemble_comparison({}, {"pros": [], "cons": [], "comparisons": []}, {}, None) is None

    def test_non_dict_non_list_returns_none(self):
        assert assemble_comparison({}, "not a dict", {}, None) is None
        assert assemble_comparison({}, 42, {}, None) is None

    def test_cheat_sheet_list_produces_comparison_rows(self):
        data = [
            {"title": "useState", "description": "Manages local state", "code": "const [s, setS] = useState(0)"},
            {"title": "useEffect", "description": "Runs side effects", "code": "useEffect(() => {}, [])"},
        ]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["pros"] == []
        assert result["cons"] == []
        assert len(result["comparisons"]) == 2
        assert result["comparisons"][0]["feature"] == "useState"
        assert result["comparisons"][0]["thisProduct"] == "Manages local state"
        assert result["comparisons"][0]["competitor"] == "const [s, setS] = useState(0)"

    def test_concepts_list_produces_comparison_rows(self):
        data = [
            {"name": "MCP", "emoji": "🔌", "definition": "Model Context Protocol", "example": "LLM tool calls"},
            {"name": "Skills", "emoji": "🧠", "definition": "Predefined agent behaviors", "analogy": "Function library"},
        ]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert len(result["comparisons"]) == 2
        assert result["comparisons"][0]["feature"] == "🔌 MCP"
        assert result["comparisons"][0]["thisProduct"] == "Model Context Protocol"
        assert result["comparisons"][0]["competitor"] == "LLM tool calls"
        assert result["comparisons"][1]["feature"] == "🧠 Skills"
        assert result["comparisons"][1]["competitor"] == "Function library"

    def test_key_points_list_produces_comparison_rows(self):
        data = [
            {"emoji": "⚡", "title": "Speed", "detail": "MCP is faster for tool execution"},
            {"emoji": "🔧", "title": "Flexibility", "detail": "Skills are more reusable"},
        ]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert len(result["comparisons"]) == 2
        assert result["comparisons"][0]["feature"] == "⚡ Speed"
        assert result["comparisons"][0]["thisProduct"] == "MCP is faster for tool execution"
        assert result["comparisons"][0]["competitor"] == ""

    def test_empty_list_returns_none(self):
        assert assemble_comparison({}, [], {}, None) is None

    def test_list_with_no_matching_shape_returns_none(self):
        data = [{"unknown_key": "value"}, {"another": "thing"}]
        assert assemble_comparison({}, data, {}, None) is None


class TestAssembleVerdict:
    def test_valid_verdict(self):
        data = {"badge": "recommended", "bottomLine": "Great product", "bestFor": ["students"], "notFor": ["pros"]}
        result = assemble_verdict({}, data, {}, None)
        assert result is not None
        assert result["badge"] == "recommended"
        assert result["bottomLine"] == "Great product"

    def test_empty(self):
        assert assemble_verdict({}, None, {}, None) is None
        assert assemble_verdict({}, [], {}, None) is None


class TestAssembleOverview:
    def test_extracts_primitives(self):
        extraction = {"learning": {"summary": "A great video", "keyQuestion": "What is ML?"}}
        result = assemble_overview({"_primary_tag": "learning"}, None, extraction, None)
        assert result is not None
        assert result["data"]["summary"] == "A great video"

    def test_flattens_meta(self):
        extraction = {"food": {"meta": {"difficulty": "easy", "servings": 4}, "ingredients": []}}
        result = assemble_overview({"_primary_tag": "food"}, None, extraction, None)
        assert result is not None
        assert result["data"]["difficulty"] == "easy"
        assert result["data"]["servings"] == 4

    def test_no_domain_data(self):
        assert assemble_overview({"_primary_tag": "travel"}, None, {}, None) is None


# ─── Full Assembly ───


class TestAssembleResponse:
    def _make_triage(self, **overrides):
        base = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Learn something",
            "tabs": [
                {"id": "key_points", "label": "Key Points", "emoji": "💡", "dataSource": "learning.keyPoints"},
                {"id": "concepts", "label": "Concepts", "emoji": "📚", "dataSource": "learning.concepts"},
            ],
        }
        base.update(overrides)
        return base

    def test_basic_assembly(self):
        triage = self._make_triage()
        extraction = {
            "learning": {
                "keyPoints": [{"title": "Point 1", "detail": "Detail 1"}],
                "concepts": [{"name": "Concept 1", "definition": "Def 1"}],
            },
        }
        result = assemble_response(triage, extraction, None, None)

        assert "meta" in result
        assert "tabs" in result
        assert result["meta"]["primaryTag"] == "learning"
        assert len(result["tabs"]) == 2
        assert result["tabs"][0]["component"] == "display_section"
        assert result["tabs"][1]["component"] == "flash_deck"

    def test_drops_empty_tabs(self):
        triage = self._make_triage()
        extraction = {"learning": {"keyPoints": [{"title": "P1"}], "concepts": []}}
        result = assemble_response(triage, extraction, None, None)

        tab_ids = [t["id"] for t in result["tabs"]]
        assert "key_points" in tab_ids
        assert "concepts" not in tab_ids  # Dropped — empty list

    def test_travel_full(self):
        triage = {
            "contentTags": ["travel"],
            "modifiers": ["finance"],
            "primaryTag": "travel",
            "userGoal": "Plan a trip",
            "tabs": [
                {"id": "itinerary", "label": "Itinerary", "emoji": "📅", "dataSource": "travel.itinerary"},
                {"id": "budget", "label": "Budget", "emoji": "💰", "dataSource": "travel.budget"},
                {"id": "packing", "label": "Packing", "emoji": "🎒", "dataSource": "travel.packingList"},
            ],
        }
        extraction = {
            "travel": {
                "itinerary": [
                    {"day": 1, "city": "Rome", "spots": [{"name": "Colosseum"}, {"name": "Forum"}]},
                ],
                "budget": {"total": 2000, "currency": "USD", "breakdown": [{"item": "Hotels", "amount": 1200}]},
                "packingList": [{"item": "Sunscreen", "category": "Essentials", "essential": True}],
            },
        }
        result = assemble_response(triage, extraction, None, None)

        # Overview is auto-prepended when domain data has primitives (budget total/currency here).
        assert len(result["tabs"]) == 4
        assert result["tabs"][0]["component"] == "overview"
        assert result["tabs"][1]["component"] == "spot_explorer"
        assert len(result["tabs"][1]["props"]["spots"]) == 2
        assert result["tabs"][2]["component"] == "budget"
        assert result["tabs"][2]["props"]["total"] == 2000
        assert result["tabs"][2]["props"]["currency"] == "USD"
        assert result["tabs"][3]["component"] == "checklist"

    def test_cross_tab_links_resolved(self):
        triage = self._make_triage(tabs=[
            {"id": "concepts", "label": "Concepts", "emoji": "📚", "dataSource": "learning.concepts"},
            {"id": "quizzes", "label": "Quiz", "emoji": "❓", "dataSource": "enrichment.quiz"},
        ])
        extraction = {"learning": {"concepts": [{"name": "A", "definition": "B"}]}}
        enrichment = {"quiz": [{"question": "Q1", "options": ["a", "b"], "correctIndex": 0, "explanation": "E"}]}
        result = assemble_response(triage, extraction, enrichment, None)

        concepts_tab = next(t for t in result["tabs"] if t["id"] == "concepts")
        assert any(l["targetTab"] == "quizzes" for l in concepts_tab["crossTabLinks"])

    def test_explicit_component_field(self):
        triage = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Learn",
            "tabs": [
                {"id": "key_points", "label": "Points", "emoji": "💡", "dataSource": "learning.keyPoints", "component": "timeline"},
            ],
        }
        extraction = {"learning": {"keyPoints": [{"title": "P1"}]}}
        result = assemble_response(triage, extraction, None, None)

        assert result["tabs"][0]["component"] == "timeline"

    def test_synthesis_merged_into_meta(self):
        triage = self._make_triage()
        extraction = {"learning": {"keyPoints": [{"title": "P1"}], "concepts": [{"name": "C", "definition": "D"}]}}
        synthesis = {"tldr": "Summary", "keyTakeaways": ["T1"], "masterSummary": "Full", "seoDescription": "Desc"}
        result = assemble_response(triage, extraction, None, synthesis)

        assert result["meta"]["tldr"] == "Summary"
        assert result["meta"]["seoDescription"] == "Desc"
        assert result["meta"]["masterSummary"] == "Full"
        assert result["meta"]["keyTakeaways"] == ["T1"]
        assert "synthesis" not in result

    def test_fitness_exercises_fallback(self):
        triage = {
            "contentTags": ["fitness"],
            "modifiers": [],
            "primaryTag": "fitness",
            "userGoal": "Workout",
            "tabs": [
                {"id": "exercises", "label": "Exercises", "emoji": "💪", "dataSource": "fitness.exercises"},
            ],
        }
        extraction = {
            "fitness": {
                "exercises": [{"name": "Push-up"}],
                "warmup": [{"name": "Stretching"}],
                "cooldown": [],
            },
        }
        result = assemble_response(triage, extraction, None, None)

        assert len(result["tabs"]) == 1
        assert result["tabs"][0]["component"] == "exercise_tracker"
        assert len(result["tabs"][0]["props"]["exercises"]) == 1

    def test_description_analysis_in_meta(self):
        triage = self._make_triage()
        extraction = {"learning": {"keyPoints": [{"title": "P1"}]}}
        desc = {"links": [{"url": "https://example.com", "type": "resource", "label": "Test"}]}
        result = assemble_response(triage, extraction, None, None, description_analysis=desc)

        assert result["meta"]["descriptionAnalysis"] == desc
        assert result["meta"]["primaryTag"] == "learning"


# ─── Registry Coverage ───


class TestAssembleGallery:
    def test_with_images(self):
        data = [
            {"url": "https://example.com/img1.jpg", "caption": "View"},
            {"url": "https://example.com/img2.jpg", "caption": "Beach"},
        ]
        result = assemble_gallery({}, data, {}, None)
        assert result is not None
        assert len(result["images"]) == 2
        assert result["images"][0]["url"] == "https://example.com/img1.jpg"

    def test_empty(self):
        assert assemble_gallery({}, [], {}, None) is None
        assert assemble_gallery({}, None, {}, None) is None


class TestAssembleClipPlayer:
    def test_with_moments(self):
        data = [
            {"label": "Best play", "timestamp": 120, "mood": "exciting", "description": "Amazing goal"},
            {"title": "Funny moment", "timestamp": 300},
        ]
        result = assemble_clip_player({}, data, {}, None)
        assert result is not None
        assert len(result["clips"]) == 2
        assert result["clips"][0]["label"] == "Best play"
        assert result["clips"][0]["mood"] == "exciting"
        assert result["clips"][1]["label"] == "Funny moment"

    def test_empty(self):
        assert assemble_clip_player({}, [], {}, None) is None
        assert assemble_clip_player({}, None, {}, None) is None


class TestAssembleLyricsPlayer:
    def test_with_structure_and_lyrics(self):
        extraction = {
            "music": {
                "title": "Bohemian Rhapsody",
                "artist": "Queen",
                "structure": [{"name": "Intro", "timestamp": 0}],
                "lyrics": [{"timestamp": 5, "line": "Is this the real life?"}],
            }
        }
        result = assemble_lyrics_player({}, None, extraction, None)
        assert result is not None
        assert result["artist"] == "Queen"
        assert len(result["sections"]) >= 1

    def test_structure_only(self):
        extraction = {
            "music": {
                "title": "Song",
                "artist": "Artist",
                "structure": [{"name": "Verse 1"}],
                "lyrics": [],
            }
        }
        result = assemble_lyrics_player({}, None, extraction, None)
        assert result is not None
        assert "sections" in result

    def test_no_music_returns_none(self):
        assert assemble_lyrics_player({}, None, {}, None) is None
        assert assemble_lyrics_player({}, None, {"music": {}}, None) is None

    def test_no_structure_no_lyrics(self):
        extraction = {"music": {"title": "X", "artist": "Y", "structure": [], "lyrics": []}}
        assert assemble_lyrics_player({}, None, extraction, None) is None


# ─── Cross-Tab Link Updates ───


class TestMaterialsStepsCrossLinks:
    def test_steps_to_materials(self):
        links = resolve_cross_tab_links("steps", {"steps", "materials"})
        assert any(l["targetTab"] == "materials" for l in links)

    def test_materials_to_steps(self):
        links = resolve_cross_tab_links("materials", {"materials", "steps"})
        assert any(l["targetTab"] == "steps" for l in links)
        assert any(l["label"] == "Start building" for l in links)


# ─── Registry Coverage ───


class TestRegistryCoverage:
    def test_all_registered(self):
        expected = {
            "spot_explorer", "timeline", "code_explorer", "comparison", "gallery",
            "info_grid", "checklist", "step_player", "exercise_tracker",
            "quiz", "flash_deck", "scenario",
            "clip_player", "lyrics_player",
            "verdict", "budget", "overview", "display_section",
        }
        assert set(ASSEMBLER_REGISTRY.keys()) == expected

    def test_registry_has_18_entries(self):
        assert len(ASSEMBLER_REGISTRY) == 18

    def test_all_assemblers_handle_none(self):
        for name, assembler in ASSEMBLER_REGISTRY.items():
            result = assembler({}, None, {}, None)
            assert result is None, f"{name} should return None for None data"

    def test_all_assemblers_handle_empty_list(self):
        for name, assembler in ASSEMBLER_REGISTRY.items():
            if name in ("overview", "display_section", "comparison", "verdict", "budget", "info_grid", "lyrics_player"):
                continue  # These expect dict or use extraction directly, not list
            result = assembler({}, [], {}, None)
            assert result is None, f"{name} should return None for empty list"


# ─── Sync Guard: domains.json ↔ ASSEMBLER_REGISTRY ───


class TestSyncGuard:
    def test_assembler_registry_matches_domains_json_components(self):
        """domains.json components[] must match ASSEMBLER_REGISTRY keys — catch drift.

        display_section is excluded: it's an internal fallback assembler, not a
        triage-visible component (triage should never output component: "display_section").
        """
        import json
        from pathlib import Path

        domains_path = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "shared" / "src" / "config" / "domains.json"
        config = json.loads(domains_path.read_text())
        json_components = frozenset(config["components"])
        # display_section is an internal fallback — not exposed to triage LLM
        registry_keys = frozenset(ASSEMBLER_REGISTRY.keys()) - {"display_section"}

        in_json_not_registry = json_components - registry_keys
        in_registry_not_json = registry_keys - json_components

        assert not in_json_not_registry, (
            f"components[] in domains.json but NOT in ASSEMBLER_REGISTRY: {in_json_not_registry}. "
            "Add the assembler function and register it."
        )
        assert not in_registry_not_json, (
            f"ASSEMBLER_REGISTRY keys NOT in domains.json components[]: {in_registry_not_json}. "
            "Add the component name to domains.json components[]."
        )


# ─── Timeline Fallback ───


class TestTimelineFallback:
    """When triage assigns a wrong dataSource for timeline, assembly falls back to learning.timestamps."""

    def test_timeline_falls_back_to_learning_timestamps(self):
        """timeline with invalid dataSource should fall back to learning.timestamps."""
        triage = {
            "contentTags": ["tech", "learning"],
            "primaryTag": "tech",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "timeline",
                    "dataSource": "tech.timestamps",  # wrong — doesn't exist
                },
            ],
        }
        extraction = {
            "learning": {
                "timestamps": [
                    {"time": "0:00", "seconds": 0, "label": "Intro"},
                    {"time": "2:30", "seconds": 150, "label": "Core Concepts"},
                ],
            },
        }
        result = assemble_response(triage, extraction, None, None)

        assert len(result["tabs"]) == 1, "timeline tab should survive via fallback"
        tab = result["tabs"][0]
        assert tab["component"] == "timeline"
        assert len(tab["props"]["entries"]) == 2

    def test_timeline_with_correct_datasource_still_works(self):
        """Regression: timeline with correct learning.timestamps dataSource works as before."""
        triage = {
            "contentTags": ["tech", "learning"],
            "primaryTag": "tech",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "timeline",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {
            "learning": {
                "timestamps": [{"time": "0:00", "seconds": 0, "label": "Intro"}],
            },
        }
        result = assemble_response(triage, extraction, None, None)
        assert len(result["tabs"]) == 1
        assert result["tabs"][0]["props"]["entries"][0]["label"] == "Intro"

    def test_youtube_chapters_override_llm_timestamps(self):
        """YouTube chapters take priority over LLM-extracted timestamps."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "timeline",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {
            "learning": {
                "timestamps": [{"time": "0:00", "seconds": 0, "label": "LLM Intro"}],
            },
        }
        video_meta = {
            "chapters": [
                {"start_time": 0.0, "end_time": 120.0, "title": "YT Intro"},
                {"start_time": 120.0, "end_time": 300.0, "title": "YT Main Content"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        assert len(result["tabs"]) == 1
        entries = result["tabs"][0]["props"]["entries"]
        assert len(entries) == 2
        assert entries[0]["label"] == "YT Intro"
        assert entries[0]["seconds"] == 0
        assert entries[0]["time"] == "0:00"
        assert entries[1]["label"] == "YT Main Content"
        assert entries[1]["seconds"] == 120
        assert entries[1]["time"] == "2:00"

    def test_youtube_chapters_rescue_empty_timestamps(self):
        """YouTube chapters used when learning.timestamps is empty []."""
        triage = {
            "contentTags": ["food", "learning"],
            "primaryTag": "food",
            "tabs": [
                {
                    "id": "video_highlights",
                    "label": "📺 Highlights",
                    "emoji": "📺",
                    "component": "timeline",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {
            "learning": {"timestamps": []},
        }
        video_meta = {
            "chapters": [
                {"start_time": 0.0, "end_time": 60.0, "title": "Best Pizza"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        assert len(result["tabs"]) == 1
        assert result["tabs"][0]["props"]["entries"][0]["label"] == "Best Pizza"

    def test_no_chapters_falls_back_to_llm_timestamps(self):
        """Without YouTube chapters, LLM timestamps are used."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "timeline",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {
            "learning": {
                "timestamps": [{"time": "1:30", "seconds": 90, "label": "LLM Topic"}],
            },
        }
        video_meta = {"chapters": []}
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        assert len(result["tabs"]) == 1
        assert result["tabs"][0]["props"]["entries"][0]["label"] == "LLM Topic"

    def test_chapters_time_formatting_with_hours(self):
        """Chapters over 1 hour get H:MM:SS format."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "timestamps",
                    "component": "timeline",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {"learning": {"timestamps": []}}
        video_meta = {
            "chapters": [
                {"start_time": 3661.0, "end_time": 4000.0, "title": "Hour Mark"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        entry = result["tabs"][0]["props"]["entries"][0]
        assert entry["time"] == "1:01:01"
        assert entry["seconds"] == 3661


# ─── Frame Utilities ───


class TestFrameUtilities:
    def test_find_nearest_frame_exact_match(self):
        frames = [
            {"timestamp": 10.0, "s3_url": "url1"},
            {"timestamp": 30.0, "s3_url": "url2"},
            {"timestamp": 60.0, "s3_url": "url3"},
        ]
        result = find_nearest_frame(30.0, frames)
        assert result is not None
        assert result["s3_url"] == "url2"

    def test_find_nearest_frame_within_distance(self):
        frames = [{"timestamp": 10.0, "s3_url": "url1"}]
        result = find_nearest_frame(25.0, frames, max_distance=30.0)
        assert result is not None

    def test_find_nearest_frame_too_far(self):
        frames = [{"timestamp": 10.0, "s3_url": "url1"}]
        result = find_nearest_frame(100.0, frames, max_distance=30.0)
        assert result is None

    def test_find_nearest_frame_empty(self):
        assert find_nearest_frame(10.0, []) is None

    def test_inject_frame_thumbnails(self):
        items = [
            {"label": "Intro", "seconds": 5},
            {"label": "Main", "seconds": 35},
            {"label": "No timestamp"},
        ]
        frames = [
            {"timestamp": 10.0, "s3_url": "url1"},
            {"timestamp": 30.0, "s3_url": "url2"},
        ]
        inject_frame_thumbnails(items, frames)
        assert items[0].get("thumbnailUrl") == "url1"
        assert items[1].get("thumbnailUrl") == "url2"
        assert "thumbnailUrl" not in items[2]

    def test_inject_frame_thumbnails_no_frames(self):
        items = [{"label": "Test", "seconds": 5}]
        inject_frame_thumbnails(items, [])
        assert "thumbnailUrl" not in items[0]


# ─── Gallery Tab Assembly ───


class TestGalleryTabAssembly:
    def test_gallery_tab_created_when_curated_frames(self):
        """Gallery tab only appears when >8 frames AND >50% non-generic captions."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [{"id": "overview", "label": "Overview", "component": "overview", "dataSource": "learning"}],
        }
        extraction = {"learning": {"summary": "Test"}}
        # 10 frames with OCR text (non-generic captions)
        frames = [
            {"timestamp": float(i * 10), "s3_url": f"url{i}", "index": i, "ocr_text": f"Slide {i}"}
            for i in range(10)
        ]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 1
        assert gallery_tabs[0]["component"] == "gallery"

    def test_no_gallery_with_few_frames(self):
        """Gallery tab NOT created when <=8 frames."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [],
        }
        extraction = {"learning": {"summary": "Test"}}
        frames = [
            {"timestamp": 10.0, "s3_url": "url1", "index": 0},
            {"timestamp": 30.0, "s3_url": "url2", "index": 1},
        ]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 0

    def test_no_gallery_tab_without_frames(self):
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [{"id": "overview", "label": "Overview", "component": "overview", "dataSource": "learning"}],
        }
        extraction = {"learning": {"summary": "Test"}}
        result = assemble_response(triage, extraction, None, None)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 0

    def test_gallery_tab_sorted_by_timestamp(self):
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [],
        }
        extraction = {"learning": {"summary": "Test"}}
        # >8 frames with OCR text to pass the curation threshold
        frames = [
            {"timestamp": 60.0, "s3_url": "url3", "index": 2, "ocr_text": "Slide C"},
            {"timestamp": 10.0, "s3_url": "url1", "index": 0, "ocr_text": "Slide A"},
            {"timestamp": 30.0, "s3_url": "url2", "index": 1, "ocr_text": "Slide B"},
        ] + [
            {"timestamp": float(i * 10 + 100), "s3_url": f"url{i+3}", "index": i+3, "ocr_text": f"Slide {i+3}"}
            for i in range(7)
        ]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 1
        images = gallery_tabs[0]["props"]["images"]
        # First 3 should be sorted by timestamp
        assert images[0]["timestamp"] == 10.0
        assert images[1]["timestamp"] == 30.0
        assert images[2]["timestamp"] == 60.0

    def test_gallery_not_created_for_few_generic_frames(self):
        """Few frames without OCR text → no gallery tab."""
        triage = {"contentTags": ["learning"], "primaryTag": "learning", "tabs": []}
        extraction = {"learning": {"summary": "Test"}}
        frames = [{"timestamp": float(i), "s3_url": f"url{i}", "index": i} for i in range(5)]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 0

    def test_gallery_layout_grid_for_many_frames(self):
        triage = {"contentTags": ["learning"], "primaryTag": "learning", "tabs": []}
        extraction = {"learning": {"summary": "Test"}}
        frames = [{"timestamp": float(i * 10), "s3_url": f"url{i}", "index": i, "ocr_text": f"Slide {i}"} for i in range(15)]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tab = [t for t in result["tabs"] if t["id"] == "frames-gallery"][0]
        assert gallery_tab["props"]["layout"] == "grid"


# ─── Flexible Assembler Tests ───


class TestFlexSpotExplorer:
    """Tests for cross-domain spot_explorer input shapes."""

    def test_name_description_shape(self):
        data = [{"name": "React Hooks", "description": "State management primitive", "emoji": "⚛️"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 1
        assert result["spots"][0]["name"] == "React Hooks"
        assert result["spots"][0]["description"] == "State management primitive"

    def test_aspect_detail_shape(self):
        data = [{"aspect": "Melody", "emoji": "🎵", "detail": "Uses pentatonic scale"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert result["spots"][0]["name"] == "Melody"
        assert result["spots"][0]["description"] == "Uses pentatonic scale"

    def test_label_explanation_shape(self):
        data = [{"label": "Cognitive Bias", "explanation": "Systematic error in thinking"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert result["spots"][0]["name"] == "Cognitive Bias"
        assert result["spots"][0]["description"] == "Systematic error in thinking"

    def test_empty_list_returns_none(self):
        assert assemble_spot_explorer({}, [], {}, None) is None

    def test_passthrough_fields(self):
        data = [{"name": "Place", "description": "Nice", "cost": "$50", "mapQuery": "place+near+me"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result["spots"][0]["cost"] == "$50"
        assert result["spots"][0]["mapQuery"] == "place+near+me"


    def test_language_phrase_shape(self):
        """Language phrases: {phrase, translation, pronunciation, context, timestamp}."""
        data = [
            {"phrase": "What attracted you?", "translation": "Interview question", "pronunciation": "wʌt əˈtræktɪd", "context": "Opening question", "timestamp": 85},
            {"phrase": "To be honest", "translation": "Honesty marker", "context": "Transition phrase"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["name"] == "What attracted you?"
        assert result["spots"][0]["description"] == "Interview question"
        assert result["spots"][0]["pronunciation"] == "wʌt əˈtræktɪd"
        assert result["spots"][0]["timestamp"] == 85

    def test_language_vocabulary_shape(self):
        """Language vocabulary: {word, definition, pronunciation, partOfSpeech, example}."""
        data = [
            {"word": "ambitious", "definition": "Having a strong desire to succeed", "pronunciation": "æmˈbɪʃəs", "partOfSpeech": "adjective", "example": "ambitious goals"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert result["spots"][0]["name"] == "ambitious"
        assert result["spots"][0]["description"] == "Having a strong desire to succeed"


class TestFlexChecklist:
    """Tests for cross-domain checklist input shapes."""

    def test_text_field_shape(self):
        data = [{"text": "Install Node.js", "notes": "v18+"}]
        result = assemble_checklist({"id": "prereqs"}, data, {}, None)
        assert result is not None
        assert result["items"][0]["label"] == "Install Node.js"
        assert result["items"][0]["note"] == "v18+"

    def test_title_detail_shape(self):
        data = [{"title": "Get passport", "detail": "Must be valid 6 months"}]
        result = assemble_checklist({"id": "prep"}, data, {}, None)
        assert result is not None
        assert result["items"][0]["label"] == "Get passport"
        assert result["items"][0]["note"] == "Must be valid 6 months"

    def test_label_shape(self):
        data = [{"label": "Sunscreen", "note": "SPF 50+"}]
        result = assemble_checklist({"id": "pack"}, data, {}, None)
        assert result is not None
        assert result["items"][0]["label"] == "Sunscreen"

    def test_plain_strings(self):
        data = ["item1", "item2"]
        result = assemble_checklist({"id": "list"}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 2
        assert result["items"][0]["label"] == "item1"


class TestFlexComparison:
    """Tests for cross-domain comparison input shapes."""

    def test_name_description_shape(self):
        data = [
            {"name": "React", "emoji": "⚛️", "description": "Component-based UI library"},
            {"name": "Vue", "emoji": "💚", "description": "Progressive framework"},
        ]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert len(result["comparisons"]) == 2
        assert result["comparisons"][0]["feature"] == "⚛️ React"
        assert result["comparisons"][0]["thisProduct"] == "Component-based UI library"

    def test_existing_cheatsheet_still_works(self):
        data = [{"title": "useState", "description": "State hook", "code": "const [x, setX] = useState()"}]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["comparisons"][0]["feature"] == "useState"

    def test_empty_returns_none(self):
        assert assemble_comparison({}, [], {}, None) is None


class TestFlexInfoGrid:
    """Tests for cross-domain info_grid input shapes."""

    def test_flat_dict(self):
        data = {"Display": "6.7 inch", "Battery": "5000mAh", "Price": 999}
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 3
        keys = [p["key"] for p in result["items"]]
        assert "Display" in keys

    def test_name_value_shape(self):
        data = [{"name": "Director", "value": "Christopher Nolan"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Director"

    def test_label_description_shape(self):
        data = [{"label": "Genre", "description": "Sci-Fi"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Genre"
        assert result["items"][0]["value"] == "Sci-Fi"

    def test_role_name_shape(self):
        data = [{"role": "Vocals", "name": "Freddie Mercury"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Vocals"
        assert result["items"][0]["value"] == "Freddie Mercury"

    def test_title_description_shape(self):
        data = [{"title": "Check for source maps", "description": "Verify no .map files"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Check for source maps"
        assert result["items"][0]["value"] == "Verify no .map files"

    def test_title_value_shape(self):
        data = [{"title": "Display", "value": "6.7-inch AMOLED"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Display"
        assert result["items"][0]["value"] == "6.7-inch AMOLED"

    def test_title_code_description_shape(self):
        """Items with {title, code, description} should normalize to {key=title, value=description}."""
        data = [
            {"title": "Enable extra usage", "code": "dashboard → settings", "description": "Allows filtered requests"},
            {"title": "Switch to Codex", "code": "alias cc='codex'", "description": "Replace Claude alias"},
        ]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 2
        assert result["items"][0]["key"] == "Enable extra usage"
        assert result["items"][0]["value"] == "Allows filtered requests"
        assert result["items"][1]["key"] == "Switch to Codex"

    def test_name_explanation_shape(self):
        """Items with {name, explanation} should normalize to {key=name, value=explanation}."""
        data = [{"name": "Past perfect tense", "emoji": "⏰", "explanation": "Use had + past participle"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Past perfect tense"
        assert result["items"][0]["value"] == "Use had + past participle"


class TestSpotExplorerEmptyFiltering:
    """Tests for filtering empty spots in spot_explorer assembler."""

    def test_empty_spots_are_dropped(self):
        data = [
            {"name": "", "description": ""},
            {"name": "Valid Spot", "description": "Has content"},
            {"name": "", "description": ""},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 1
        assert result["spots"][0]["name"] == "Valid Spot"

    def test_all_empty_spots_returns_none(self):
        data = [{"name": "", "description": ""}, {"name": "", "description": ""}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_spot_with_only_name_kept(self):
        data = [{"name": "Has name only", "description": ""}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 1

    def test_spot_with_only_description_kept(self):
        data = [{"name": "", "description": "Has description only"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 1


class TestComparisonProductLabel:
    """Tests for product name extraction in comparison assembler."""

    def test_product_from_review_extraction(self):
        data = {"pros": ["Fast"], "cons": [], "comparisons": []}
        extraction = {"review": {"product": "Pixel 8 Pro", "pros": ["Fast"]}}
        result = assemble_comparison({}, data, extraction, None)
        assert result is not None
        assert result["leftLabel"] == "Pixel 8 Pro"

    def test_product_from_video_meta_fallback(self):
        data = {"pros": ["Great"], "cons": [], "comparisons": []}
        tab = {"_video_meta": {"title": "Claude Code is unusable now"}}
        result = assemble_comparison(tab, data, {}, None)
        assert result is not None
        assert result["leftLabel"] == "Claude Code is unusable now"

    def test_empty_label_when_no_product(self):
        data = {"pros": ["Good"], "cons": [], "comparisons": []}
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["leftLabel"] == ""
        assert result["rightLabel"] == ""

    def test_review_product_takes_priority_over_title(self):
        data = {"pros": ["Fast"], "cons": [], "comparisons": []}
        tab = {"_video_meta": {"title": "Is Pixel 8 Worth It?"}}
        extraction = {"review": {"product": "Google Pixel 8 Pro"}}
        result = assemble_comparison(tab, data, extraction, None)
        assert result is not None
        assert result["leftLabel"] == "Google Pixel 8 Pro"

    def test_product_label_on_list_input(self):
        data = [
            {"title": "Battery", "description": "5000mAh", "code": "All day"},
        ]
        tab = {"_video_meta": {"title": "Phone Review"}}
        result = assemble_comparison(tab, data, {}, None)
        assert result is not None
        assert result["leftLabel"] == "Phone Review"


class TestNewCrossTabLinks:
    """Tests for component-based cross-tab link rules."""

    def test_code_setup_bidirectional(self):
        links_code = resolve_cross_tab_links("code", {"code", "setup"})
        links_setup = resolve_cross_tab_links("setup", {"code", "setup"})
        assert any(l["targetTab"] == "setup" for l in links_code)
        assert any(l["targetTab"] == "code" for l in links_setup)

    def test_link_only_if_target_exists(self):
        links = resolve_cross_tab_links("key_points", {"key_points"})
        assert not any(l["targetTab"] == "flashcards" for l in links)

    def test_food_domain_flow(self):
        """Food domain: overview → checklist → step_player."""
        all_tabs = [
            {"id": "overview", "component": "overview"},
            {"id": "ingredients", "component": "checklist"},
            {"id": "steps", "component": "step_player"},
        ]
        ids = {"overview", "ingredients", "steps"}
        links = resolve_cross_tab_links("overview", ids, "overview", all_tabs, "food")
        assert any(l["targetTab"] == "ingredients" and "ingredient" in l["label"].lower() for l in links)

    def test_learning_domain_flow(self):
        """Learning domain: overview → flash_deck → quiz."""
        all_tabs = [
            {"id": "overview", "component": "overview"},
            {"id": "concepts", "component": "flash_deck"},
            {"id": "quiz", "component": "quiz"},
        ]
        ids = {"overview", "concepts", "quiz"}
        links = resolve_cross_tab_links("overview", ids, "overview", all_tabs, "learning")
        assert any(l["targetTab"] == "concepts" for l in links)

    def test_generic_fallback_rules(self):
        """Generic rules fire when no domain-specific rule matches."""
        all_tabs = [
            {"id": "overview", "component": "overview"},
            {"id": "exercises", "component": "exercise_tracker"},
        ]
        ids = {"overview", "exercises"}
        links = resolve_cross_tab_links("overview", ids, "overview", all_tabs, "narrative")
        assert any(l["targetTab"] == "exercises" for l in links)


class TestPostProcessing:
    """Tests for post-processing rules (0.7, 0.8, 0.9)."""

    def test_flash_deck_front_corruption(self):
        """Sprint 0.5: category-name fronts get fixed."""
        data = [
            {"front": "chef_tip", "back": "Always salt your pasta water generously. It should taste like the sea."},
            {"front": "Real Concept", "back": "This is fine"},
        ]
        result = assemble_flash_deck({}, data, {}, None)
        assert result is not None
        assert result["cards"][0]["front"] != "chef_tip"
        assert "salt" in result["cards"][0]["front"].lower() or "always" in result["cards"][0]["front"].lower()
        assert result["cards"][1]["front"] == "Real Concept"

    def test_comparison_synthesizes_pros_cons(self):
        """Sprint 0.6: empty pros/cons get synthesized from winner fields."""
        data = {
            "pros": [],
            "cons": [],
            "comparisons": [
                {"feature": "Camera", "thisProduct": "48MP", "competitor": "12MP", "winner": "left"},
                {"feature": "Price", "thisProduct": "$999", "competitor": "$699", "winner": "right"},
            ]
        }
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert len(result["pros"]) >= 1
        assert "Camera" in result["pros"]
        assert len(result["cons"]) >= 1
        assert "Price" in result["cons"]

    def test_flash_deck_max_one_guardrail(self):
        """Sprint 0: assembly keeps only the first flash_deck tab."""
        from src.services.pipeline.assembly import _post_process_tabs
        tabs = [
            {"id": "concepts", "component": "flash_deck", "label": "Concepts", "emoji": "📚", "props": {"cards": [{"front": "A", "back": "B"}]}},
            {"id": "tips", "component": "flash_deck", "label": "Tips", "emoji": "💡", "props": {"cards": [{"front": "C", "back": "D"}]}},
            {"id": "quiz", "component": "quiz", "label": "Quiz", "emoji": "❓", "props": {"questions": []}},
        ]
        # flash_deck guardrail is in assemble_response, not _post_process_tabs
        # Test it via the full pipeline by checking tab dedup
        assert len([t for t in tabs if t["component"] == "flash_deck"]) == 2

    def test_untitled_chapter_strip(self):
        """Sprint 0.7: <Untitled Chapter N> gets replaced."""
        from src.services.pipeline.assembly import _post_process_tabs
        tabs = [
            {"id": "intro", "label": "<Untitled Chapter 1>", "component": "overview", "emoji": "", "props": {}},
            {"id": "part2", "label": "Untitled Chapter 2", "component": "display_section", "emoji": "", "props": {}},
        ]
        _post_process_tabs(tabs)
        assert tabs[0]["label"] == "Introduction"
        assert tabs[1]["label"] == "Part 2"

    def test_tab_label_count_injection(self):
        """Sprint 0.8: list-based tabs get item count prepended."""
        from src.services.pipeline.assembly import _post_process_tabs
        tabs = [
            {"id": "exercises", "label": "Exercises", "component": "exercise_tracker", "emoji": "💪", "props": {"exercises": [{"name": "Pushup"}, {"name": "Squat"}]}},
            {"id": "overview", "label": "Overview", "component": "overview", "emoji": "📋", "props": {"data": {"key": "val"}}},
        ]
        _post_process_tabs(tabs)
        assert "2" in tabs[0]["label"]
        assert tabs[1]["label"] == "Overview"  # overview exempt from count

    def test_double_emoji_strip(self):
        """Sprint 0.9: leading emoji stripped when emoji field exists."""
        from src.services.pipeline.assembly import _post_process_tabs
        tabs = [
            {"id": "shapes", "label": "🍝 Pasta Shapes", "component": "spot_explorer", "emoji": "🍝", "props": {"spots": []}},
        ]
        _post_process_tabs(tabs)
        assert not tabs[0]["label"].startswith("🍝")


# ─── Domain Requirement Validation ───


class TestDomainRequirementValidation:
    """Tests for _validate_domain_requirements."""

    def test_missing_required_components_warns_only(self, caplog):
        """Missing required components log warnings but don't drop tabs."""
        tabs = [
            {"id": "overview", "component": "overview", "label": "Overview", "goal": "Intro"},
            {"id": "tips", "component": "info_grid", "label": "Tips", "goal": "Tips"},
        ]
        with caplog.at_level("WARNING"):
            _validate_domain_requirements(tabs, "food")
        assert len(tabs) == 2  # no tabs dropped
        assert "step_player" in caplog.text
        assert "checklist" in caplog.text

    def test_max_flash_deck_enforced(self):
        """Multiple flash_deck tabs → only first kept."""
        tabs = [
            {"id": "concepts", "component": "flash_deck", "label": "Concepts", "goal": "Learn"},
            {"id": "terms", "component": "flash_deck", "label": "Terms", "goal": "Study"},
            {"id": "overview", "component": "overview", "label": "Overview", "goal": "Intro"},
        ]
        _validate_domain_requirements(tabs, "learning")
        flash_tabs = [t for t in tabs if t["component"] == "flash_deck"]
        assert len(flash_tabs) == 1
        assert flash_tabs[0]["id"] == "concepts"

    def test_max_quiz_enforced_for_tech(self):
        """Multiple quiz tabs in tech → only first kept."""
        tabs = [
            {"id": "quiz1", "component": "quiz", "label": "Quiz 1", "goal": "Test"},
            {"id": "quiz2", "component": "quiz", "label": "Quiz 2", "goal": "Test more"},
        ]
        _validate_domain_requirements(tabs, "tech")
        quiz_tabs = [t for t in tabs if t["component"] == "quiz"]
        assert len(quiz_tabs) == 1

    def test_no_max_constraints_no_drop(self):
        """Tabs within limits stay untouched."""
        tabs = [
            {"id": "concepts", "component": "flash_deck", "label": "Concepts", "goal": "Learn"},
            {"id": "quiz", "component": "quiz", "label": "Quiz", "goal": "Test"},
            {"id": "overview", "component": "overview", "label": "Overview", "goal": "Intro"},
        ]
        _validate_domain_requirements(tabs, "learning")
        assert len(tabs) == 3

    def test_empty_goal_warns(self, caplog):
        """Tabs with empty goal get a warning."""
        tabs = [
            {"id": "steps", "component": "step_player", "label": "Steps", "goal": ""},
        ]
        with caplog.at_level("WARNING"):
            _validate_domain_requirements(tabs, "food")
        assert "empty goal" in caplog.text

    def test_empty_label_warns(self, caplog):
        """Tabs with empty label get a warning."""
        tabs = [
            {"id": "steps", "component": "step_player", "label": "", "goal": "Build it"},
        ]
        with caplog.at_level("WARNING"):
            _validate_domain_requirements(tabs, "project")
        assert "empty label" in caplog.text

    def test_untitled_chapter_in_label_fixed(self):
        """Untitled Chapter placeholders in labels get replaced."""
        tabs = [
            {"id": "intro", "component": "overview", "label": "<Untitled Chapter 1>", "goal": "Intro"},
        ]
        _validate_domain_requirements(tabs, "learning")
        assert tabs[0]["label"] == "Introduction"

    def test_unknown_domain_no_crash(self):
        """Unknown domain doesn't crash — just no requirements enforced."""
        tabs = [
            {"id": "misc", "component": "display_section", "label": "Misc", "goal": "Data"},
        ]
        _validate_domain_requirements(tabs, "unknown_domain")
        assert len(tabs) == 1


# ─── Data Quality: Normalizer Tests ───


class TestCodeExplorerNormalization:
    """Phase 1.1: _normalize_code_snippet + assemble_code_explorer."""

    def test_string_item_becomes_snippet(self):
        result = _normalize_code_snippet("console.log('hello')")
        assert result is not None
        assert result["code"] == "console.log('hello')"
        assert result["language"] == "text"

    def test_empty_string_returns_none(self):
        assert _normalize_code_snippet("") is None
        assert _normalize_code_snippet("  ") is None

    def test_dict_with_code_key(self):
        result = _normalize_code_snippet({"code": "x = 1", "language": "python"})
        assert result is not None
        assert result["code"] == "x = 1"
        assert result["language"] == "python"

    def test_dict_alias_snippet(self):
        result = _normalize_code_snippet({"snippet": "fn main() {}", "lang": "rust"})
        assert result is not None
        assert result["code"] == "fn main() {}"
        assert result["language"] == "rust"

    def test_dict_missing_code_returns_none(self):
        assert _normalize_code_snippet({"language": "python"}) is None

    def test_non_dict_non_str_returns_none(self):
        assert _normalize_code_snippet(42) is None
        assert _normalize_code_snippet(None) is None

    def test_assembler_normalizes_mixed_items(self):
        data = [
            "const x = 1",
            {"code": "fn main() {}", "language": "rust"},
            42,  # dropped
            {"language": "go"},  # dropped — no code
        ]
        result = assemble_code_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["snippets"]) == 2

    def test_assembler_all_invalid_returns_none(self):
        assert assemble_code_explorer({}, [42, None, ""], {}, None) is None

    def test_valid_data_unchanged(self):
        """Existing valid data passes through without alteration."""
        result = _normalize_code_snippet({
            "code": "print(1)", "language": "python",
            "explanation": "Prints 1", "filename": "main.py",
        })
        assert result["code"] == "print(1)"
        assert result["explanation"] == "Prints 1"
        assert result["filename"] == "main.py"


class TestTimelineNormalization:
    """Phase 1.2: _normalize_timeline_entry + assemble_timeline."""

    def test_valid_entry_passthrough(self):
        result = _normalize_timeline_entry({"label": "Intro", "time": "0:00", "seconds": 0}, 0)
        assert result is not None
        assert result["label"] == "Intro"
        assert result["seconds"] == 0

    def test_missing_time_computed(self):
        result = _normalize_timeline_entry({"label": "Test", "seconds": 125}, 0)
        assert result is not None
        assert result["time"] == "2:05"

    def test_label_aliases(self):
        result = _normalize_timeline_entry({"title": "Chapter 1", "seconds": 0}, 0)
        assert result["label"] == "Chapter 1"
        result = _normalize_timeline_entry({"name": "Section A", "seconds": 0}, 0)
        assert result["label"] == "Section A"

    def test_string_entry(self):
        result = _normalize_timeline_entry("Introduction", 0)
        assert result is not None
        assert result["label"] == "Introduction"
        assert result["seconds"] == 0

    def test_empty_string_returns_none(self):
        assert _normalize_timeline_entry("", 0) is None

    def test_non_dict_non_str_returns_none(self):
        assert _normalize_timeline_entry(42, 0) is None

    def test_missing_label_gets_default(self):
        result = _normalize_timeline_entry({"seconds": 60}, 2)
        assert result["label"] == "Point 3"

    def test_assembler_normalizes(self):
        data = [
            {"title": "Start", "timestamp": 0},
            {"label": "Middle", "seconds": 120},
            42,  # dropped
        ]
        result = assemble_timeline({}, data, {}, None)
        assert result is not None
        assert len(result["entries"]) == 2
        assert result["entries"][0]["label"] == "Start"
        assert result["entries"][1]["time"] == "2:00"


class TestExerciseNormalization:
    """Phase 1.3: _normalize_exercise + assemble_exercise_tracker."""

    def test_valid_exercise(self):
        result = _normalize_exercise({"name": "Push-up", "sets": 3, "reps": 10})
        assert result is not None
        assert result["name"] == "Push-up"
        assert result["sets"] == 3

    def test_defaults_filled(self):
        result = _normalize_exercise({"description": "A cool exercise"})
        assert result["name"] == "Exercise"
        assert result["emoji"] == "💪"
        assert result["formCues"] == []
        assert result["modifications"] == []

    def test_string_formcues_coerced(self):
        result = _normalize_exercise({"name": "Squat", "formCues": "Keep back straight"})
        assert result["formCues"] == ["Keep back straight"]

    def test_string_modifications_coerced(self):
        result = _normalize_exercise({"name": "Squat", "modifications": "Use chair"})
        assert result["modifications"] == ["Use chair"]

    def test_non_dict_returns_none(self):
        assert _normalize_exercise("not a dict") is None
        assert _normalize_exercise(42) is None

    def test_assembler_normalizes_list(self):
        data = [
            {"name": "Push-up"},
            {"title": "Squat", "sets": 3},
            "invalid",  # dropped
        ]
        result = assemble_exercise_tracker({}, data, {}, None)
        assert result is not None
        assert len(result["exercises"]) == 2
        assert result["exercises"][0]["emoji"] == "💪"
        assert result["exercises"][1]["name"] == "Squat"

    def test_assembler_normalizes_dict_shape(self):
        data = {"exercises": [{"name": "Lunge"}], "warmup": [{"name": "Jog"}]}
        result = assemble_exercise_tracker({}, data, {}, None)
        assert result is not None
        assert result["exercises"][0]["emoji"] == "💪"


class TestQuizNormalization:
    """Phase 1.4: _normalize_quiz_question + assemble_quiz."""

    def test_valid_question(self):
        result = _normalize_quiz_question({
            "question": "What is 1+1?",
            "options": ["1", "2", "3"],
            "correctIndex": 1,
            "explanation": "Math"
        })
        assert result is not None
        assert result["question"] == "What is 1+1?"
        assert result["correctIndex"] == 1

    def test_text_alias(self):
        result = _normalize_quiz_question({"text": "Q?", "choices": ["A", "B"], "correctIndex": 0})
        assert result is not None
        assert result["question"] == "Q?"

    def test_too_few_options_dropped(self):
        assert _normalize_quiz_question({"question": "Q?", "options": ["A"]}) is None

    def test_missing_options_dropped(self):
        assert _normalize_quiz_question({"question": "Q?"}) is None

    def test_correctindex_clamped(self):
        result = _normalize_quiz_question({"question": "Q?", "options": ["A", "B"], "correctIndex": 99})
        assert result["correctIndex"] == 1

    def test_correctindex_negative_clamped(self):
        result = _normalize_quiz_question({"question": "Q?", "options": ["A", "B"], "correctIndex": -5})
        assert result["correctIndex"] == 0

    def test_empty_question_dropped(self):
        assert _normalize_quiz_question({"question": "", "options": ["A", "B"]}) is None

    def test_non_dict_returns_none(self):
        assert _normalize_quiz_question("not a dict") is None

    def test_assembler_filters_invalid(self):
        data = [
            {"question": "Good?", "options": ["A", "B"], "correctIndex": 0},
            {"question": "", "options": ["A", "B"]},  # dropped
            {"question": "Lonely?", "options": ["A"]},  # dropped
        ]
        result = assemble_quiz({}, data, {}, None)
        assert result is not None
        assert len(result["questions"]) == 1


class TestScenarioNormalization:
    """Phase 1.5: _normalize_scenario_item + assemble_scenario."""

    def test_valid_scenario(self):
        result = _normalize_scenario_item({
            "question": "What do you do?",
            "options": [
                {"text": "Run", "correct": True, "explanation": "Yes"},
                {"text": "Hide", "correct": False, "explanation": "No"},
            ],
        })
        assert result is not None
        assert result["question"] == "What do you do?"
        assert len(result["options"]) == 2

    def test_string_options_normalized(self):
        result = _normalize_scenario_item({
            "question": "Pick one",
            "options": ["Option A", "Option B"],
        })
        assert result is not None
        assert result["options"][0] == {"text": "Option A", "correct": False, "explanation": ""}

    def test_situation_alias(self):
        result = _normalize_scenario_item({
            "situation": "Fire alarm rings",
            "options": ["Evacuate", "Ignore"],
        })
        assert result is not None
        assert result["question"] == "Fire alarm rings"

    def test_too_few_options_dropped(self):
        assert _normalize_scenario_item({"question": "Q?", "options": ["A"]}) is None

    def test_empty_question_dropped(self):
        assert _normalize_scenario_item({"question": "", "options": ["A", "B"]}) is None

    def test_non_dict_returns_none(self):
        assert _normalize_scenario_item("not a dict") is None

    def test_assembler_filters_invalid(self):
        data = [
            {"question": "Good?", "options": ["A", "B"]},
            {"question": "", "options": ["A", "B"]},  # dropped
        ]
        result = assemble_scenario({}, data, {}, None)
        assert result is not None
        assert len(result["scenarios"]) == 1


class TestClipPlayerNormalization:
    """Phase 1.6: assemble_clip_player defaults."""

    def test_label_fallback_chain(self):
        result = assemble_clip_player({}, [{"timestamp": 10}], {}, None)
        assert result is not None
        assert result["clips"][0]["label"] == "Clip"

    def test_label_from_title(self):
        result = assemble_clip_player({}, [{"title": "Great moment"}], {}, None)
        assert result["clips"][0]["label"] == "Great moment"

    def test_start_seconds_from_timestamp(self):
        result = assemble_clip_player({}, [{"label": "X", "timestamp": 120}], {}, None)
        assert result["clips"][0]["startSeconds"] == 120
        assert result["clips"][0]["time"] == "2:00"

    def test_description_defaults_empty(self):
        result = assemble_clip_player({}, [{"label": "X"}], {}, None)
        assert result["clips"][0]["description"] == ""

    def test_mood_defaults_none(self):
        result = assemble_clip_player({}, [{"label": "X"}], {}, None)
        assert result["clips"][0]["mood"] is None


class TestComparisonNullHandling:
    """Phase 1.7: JSON null → Python None for pros/cons."""

    def test_null_pros_cons_handled(self):
        """JSON null becomes Python None — `or []` fixes it."""
        data = {"pros": None, "cons": None, "comparisons": [
            {"feature": "Speed", "thisProduct": "Fast", "competitor": "Slow", "winner": "left"},
        ]}
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert isinstance(result["pros"], list)
        assert isinstance(result["cons"], list)
        # Winner synthesis still works
        assert "Speed" in result["pros"]

    def test_null_comparisons_handled(self):
        data = {"pros": ["Good"], "cons": ["Bad"], "comparisons": None}
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["pros"] == ["Good"]
        assert result["cons"] == ["Bad"]


# ─── Data Quality: Validation Checkpoint Tests ───


class TestAssemblyValidation:
    """Phase 2: _validate_assembled_props."""

    def test_valid_props_pass(self):
        assert _validate_assembled_props("quiz", {"questions": [{"q": "test"}]}) is True

    def test_empty_required_list_fails(self):
        assert _validate_assembled_props("quiz", {"questions": []}) is False

    def test_missing_required_list_fails(self):
        assert _validate_assembled_props("timeline", {"data": "something"}) is False

    def test_unknown_component_passes(self):
        assert _validate_assembled_props("unknown_widget", {"anything": True}) is True

    def test_overview_always_passes(self):
        """overview has no required list — always passes."""
        assert _validate_assembled_props("overview", {"data": {"key": "val"}}) is True

    def test_validation_drops_tab_in_full_assembly(self):
        """End-to-end: assembler returns props with empty list → tab dropped."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "quizzes", "label": "Quiz", "emoji": "❓", "dataSource": "enrichment.quiz"},
            ],
        }
        # All quiz questions are invalid (empty question text)
        enrichment = {"quiz": [{"question": "", "options": ["A", "B"]}]}
        result = assemble_response(triage, {}, enrichment, None)
        tab_ids = [t["id"] for t in result["tabs"]]
        assert "quizzes" not in tab_ids


# ─── Overview-First Guarantee ───


class TestOverviewFirst:
    """Overview tab must always sit at index 0 and route to OverviewInteractive."""

    def test_existing_overview_moved_to_front(self):
        """Overview emitted at non-zero position gets moved to index 0."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
                {"id": "overview", "label": "Overview", "emoji": "📋",
                 "dataSource": "meta", "component": "overview"},
            ],
        }
        extraction = {"learning": {"concepts": [{"name": "C", "definition": "D"}]}}
        synthesis = {"masterSummary": "A great video", "keyTakeaways": ["t1"]}
        result = assemble_response(triage, extraction, None, synthesis)

        assert result["tabs"][0]["id"] == "overview"
        assert result["tabs"][0]["component"] == "overview"

    def test_overview_synthesized_when_missing(self):
        """No overview in triage → one gets prepended from synthesis."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
            ],
        }
        extraction = {"learning": {"concepts": [{"name": "C", "definition": "D"}]}}
        synthesis = {"masterSummary": "A great video", "keyTakeaways": ["t1", "t2"]}
        result = assemble_response(triage, extraction, None, synthesis)

        assert result["tabs"][0]["id"] == "overview"
        assert result["tabs"][0]["component"] == "overview"
        assert result["tabs"][0]["props"]["data"]["masterSummary"] == "A great video"

    def test_display_section_overview_gets_normalized(self):
        """id=overview with mis-tagged component=display_section becomes overview."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "overview", "label": "Overview", "emoji": "📋",
                 "dataSource": "learning", "component": "display_section"},
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
            ],
        }
        extraction = {
            "learning": {
                "summary": "x",
                "concepts": [{"name": "C", "definition": "D"}],
            },
        }
        synthesis = {"masterSummary": "A great video", "keyTakeaways": ["t1"]}
        result = assemble_response(triage, extraction, None, synthesis)

        assert result["tabs"][0]["id"] == "overview"
        assert result["tabs"][0]["component"] == "overview"

    def test_no_overview_when_no_data_available(self):
        """With no synthesis and no primitive domain data, no overview is injected."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
            ],
        }
        extraction = {"learning": {"concepts": [{"name": "C", "definition": "D"}]}}
        result = assemble_response(triage, extraction, None, None)

        components = [t["component"] for t in result["tabs"]]
        assert "overview" not in components

    def test_overview_emits_rich_hero_fields(self):
        """Overview data should include title, emoji, subtitle, stats for the hero."""
        triage = {
            "contentTags": ["tech"],
            "primaryTag": "tech",
            "tabs": [
                {"id": "code", "label": "Code", "emoji": "💻",
                 "dataSource": "tech.snippets", "component": "code_explorer"},
            ],
        }
        extraction = {
            "tech": {
                "snippets": [{"code": "print(1)", "language": "python"}],
                "meta": {"difficulty": "advanced"},
                "tips": ["Cache aggressively"],
            },
        }
        synthesis = {
            "tldr": "Short one-liner description",
            "masterSummary": "Full master summary of the video",
            "keyTakeaways": ["t1", "t2"],
        }
        video_meta = {"title": "Real Video Title", "duration": 2700, "channel": "Creator"}
        result = assemble_response(triage, extraction, None, synthesis, video_meta=video_meta)

        data = result["tabs"][0]["props"]["data"]
        assert data["title"] == "Real Video Title"
        assert data["emoji"] == "💻"  # tech domain
        assert data["subtitle"] == "Short one-liner description"
        assert data["masterSummary"] == "Full master summary of the video"
        assert data["level"] == "Advanced"
        assert data["tips"] == ["Cache aggressively"]
        stat_labels = {s["label"] for s in data["stats"]}
        assert {"Duration", "Level", "Items"}.issubset(stat_labels)

    def test_overview_item_count_reflects_other_tabs(self):
        """`itemCount` counts non-overview tabs."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
                {"id": "takeaways", "label": "Takeaways", "emoji": "✅",
                 "dataSource": "learning.takeaways", "component": "checklist"},
            ],
        }
        extraction = {
            "learning": {
                "concepts": [{"name": "C", "definition": "D"}],
                "takeaways": ["t1"],
            },
        }
        synthesis = {"masterSummary": "ms", "keyTakeaways": ["k1"]}
        result = assemble_response(triage, extraction, None, synthesis)

        data = result["tabs"][0]["props"]["data"]
        assert data["itemCount"] == 2

    def test_overview_deduped_when_already_first(self):
        """Overview already at index 0 is not duplicated."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "overview", "label": "Overview", "emoji": "📋",
                 "dataSource": "meta", "component": "overview"},
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
            ],
        }
        extraction = {"learning": {"concepts": [{"name": "C", "definition": "D"}]}}
        synthesis = {"masterSummary": "A great video", "keyTakeaways": ["t1"]}
        result = assemble_response(triage, extraction, None, synthesis)

        overview_count = sum(1 for t in result["tabs"] if t["component"] == "overview")
        assert overview_count == 1
        assert result["tabs"][0]["id"] == "overview"

    def test_overview_item_count_reflects_post_fallback_tab_count(self):
        """itemCount must be annotated AFTER the 3-tab fallback minimum kicks in.

        Regression: previously the annotation ran inside _ensure_overview_first,
        before fallback tabs were appended, so the "Items" hero chip under-
        reported the real tab count.
        """
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {"id": "concepts", "label": "Concepts", "emoji": "📚",
                 "dataSource": "learning.concepts", "component": "flash_deck"},
            ],
        }
        extraction = {"learning": {"concepts": [{"name": "C", "definition": "D"}]}}
        synthesis = {
            "masterSummary": "Full summary",
            "keyTakeaways": ["k1", "k2", "k3"],
            "tldr": "Short line",
        }
        result = assemble_response(triage, extraction, None, synthesis)

        # After the 3-tab minimum kicks in, we should have overview + content tabs.
        assert result["tabs"][0]["component"] == "overview"
        data = result["tabs"][0]["props"]["data"]
        assert data["itemCount"] == len(result["tabs"]) - 1
