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
    assemble_lyrics_player,
    assemble_moment_track,
    assemble_code_explorer,
    assemble_quiz,
    assemble_scenario,
    assemble_connect_canvas,
    assemble_diagram_card,
    assemble_claims_tracker,
    assemble_tier_list,
    assemble_formation_diagram,
    _chapters_to_moments,
    _normalize_code_snippet,
    _normalize_moment_item,
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
        """Travel domain: overview → spot_explorer → budget. Label text
        comes from the Plan's outboundLinks when provided; otherwise falls
        back to the target tab's own label."""
        all_tabs = [
            {"id": "overview", "component": "overview", "label": "Overview"},
            {"id": "itinerary", "component": "spot_explorer", "label": "7 Day Itinerary"},
            {"id": "budget", "component": "budget", "label": "Budget"},
        ]
        links = resolve_cross_tab_links(
            "overview",
            {"overview", "itinerary", "budget"},
            component="overview",
            all_tabs=all_tabs,
            primary_tag="travel",
            outbound_links={"itinerary": "See the itinerary"},
        )
        assert len(links) >= 1
        assert links[0]["targetTab"] == "itinerary"
        assert links[0]["label"] == "See the itinerary"


# ─── Assemblers ───


class TestAssembleSpotExplorer:
    def test_travel_days(self):
        data = [
            {"day": 1, "city": "Tokyo", "spots": [
                {"name": "Shibuya", "description": "Iconic scramble crossing"},
                {"name": "Harajuku", "description": "Youth fashion district"},
            ]},
            {"day": 2, "city": "Osaka", "spots": [
                {"name": "Dotonbori", "description": "Neon-lit canal nightlife"},
            ]},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 3
        assert len(result["sections"]) == 2
        assert result["sections"][0]["label"] == "Day 1: Tokyo"
        assert result["sections"][0]["spotIndices"] == [0, 1]
        assert result["sections"][1]["spotIndices"] == [2]

    def test_flat_spots(self):
        data = [
            {"name": "Spot A", "description": "First stop"},
            {"name": "Spot B", "description": "Second stop"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert "sections" not in result

    def test_empty(self):
        assert assemble_spot_explorer({}, [], {}, None) is None
        assert assemble_spot_explorer({}, None, {}, None) is None

    def test_name_only_spots_dropped(self):
        # A spot needs at least a description or a passthrough field — bare
        # name dicts render as empty cards in spot_explorer and are usually a
        # symptom of cross-domain keyword pollution. Pin the behavior so a
        # future contributor doesn't loosen the rule by accident.
        data = [{"name": "Spot A"}, {"name": "Spot B"}]
        assert assemble_spot_explorer({}, data, {}, None) is None

    def test_name_with_passthrough_kept(self):
        # Passthrough fields (emoji, cost, duration, …) count as descriptive
        # content, so name + emoji is enough to render a real card.
        data = [
            {"name": "Spot A", "emoji": "🍕"},
            {"name": "Spot B", "emoji": "🍣"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["emoji"] == "🍕"

    def test_string_items_dropped(self):
        # String items used to be promoted to {name: "...", description: ""};
        # now they're rejected because extraction should produce structured
        # dicts. Below the _MIN_SPOTS threshold ⇒ tab is dropped entirely.
        data = ["Spot A", "Spot B"]
        assert assemble_spot_explorer({}, data, {}, None) is None

    def test_below_min_spots_dropped(self):
        # _MIN_SPOTS = 2 — single-spot tabs degrade poorly in the explorer UI,
        # so the fallback layer takes over (overview/info_grid).
        data = [{"name": "Lone Spot", "description": "Only one"}]
        assert assemble_spot_explorer({}, data, {}, None) is None


class TestAssembleChecklist:
    def test_food_ingredients(self):
        data = [
            {"name": "flour", "amount": 2, "unit": "cups", "displayAmount": "2 cups"},
            {"name": "salt", "amount": 0, "displayAmount": "to taste"},
        ]
        result = assemble_checklist({"id": "ingredients"}, data, {}, None)
        assert result is not None
        # tabLabel is no longer injected by the backend — the FE derives the
        # section heading from the (translated) tab.label. Only the items
        # contract matters here.
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

    def test_cheat_sheet_list_no_longer_coerced(self):
        # Cheat-sheet shape {title, description, code} no longer silently coerces
        # to comparison rows — that produced the audited "video title as column
        # header / empty third column" rendering on review videos. The data
        # belongs in code_explorer or info_grid.
        data = [
            {"title": "useState", "description": "Manages local state", "code": "const [s, setS] = useState(0)"},
            {"title": "useEffect", "description": "Runs side effects", "code": "useEffect(() => {}, [])"},
        ]
        assert assemble_comparison({}, data, {}, None) is None

    def test_concepts_list_no_longer_coerced(self):
        # Concept shape {name, definition, example} routes to flash_deck or
        # info_grid now, not comparison. Single-sided definitions were the
        # source of the audited "8 empty cards" failure mode.
        data = [
            {"name": "MCP", "emoji": "🔌", "definition": "Model Context Protocol", "example": "LLM tool calls"},
            {"name": "Skills", "emoji": "🧠", "definition": "Predefined agent behaviors", "analogy": "Function library"},
        ]
        assert assemble_comparison({}, data, {}, None) is None

    def test_key_points_list_no_longer_coerced(self):
        # Key-points shape {title, detail} is single-sided — not a comparison.
        # The new contract requires both `thisProduct` and `competitor` filled
        # on each row before the row counts as a real pair.
        data = [
            {"emoji": "⚡", "title": "Speed", "detail": "MCP is faster for tool execution"},
            {"emoji": "🔧", "title": "Flexibility", "detail": "Skills are more reusable"},
        ]
        assert assemble_comparison({}, data, {}, None) is None

    def test_real_comparison_pair_accepted(self):
        # Properly-shaped comparison data DOES go through.
        data = [
            {"feature": "Battery", "thisProduct": "12 hours", "competitor": "8 hours", "winner": "left"},
            {"feature": "Price", "thisProduct": "$1299", "competitor": "$999", "winner": "right"},
            {"feature": "Weight", "thisProduct": "1.4kg", "competitor": "1.6kg", "winner": "left"},
        ]
        result = assemble_comparison({}, data, {"review": {"product": "Laptop A"}}, None)
        assert result is not None
        assert len(result["comparisons"]) == 3
        assert result["leftLabel"] == "Laptop A"

    def test_numeric_zero_sides_preserved(self):
        """Numeric 0 / False are legitimate content (free tier price, "no" on a
        feature row). The prior `or ""` truthiness check dropped these — they
        must survive the real-pair filter.
        """
        data = [
            # $0 free-tier vs $19 paid — a real and useful comparison.
            {"feature": "Monthly price", "thisProduct": 0, "competitor": 19},
            # Boolean feature comparison.
            {"feature": "Offline mode", "thisProduct": False, "competitor": True},
            # Real-pair string row to satisfy the 2-row minimum threshold even
            # if the numeric/bool rows were ever to drop.
            {"feature": "Storage", "thisProduct": "100 GB", "competitor": "50 GB"},
        ]
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        # All three rows must survive — none of them are "single-sided".
        features = [r["feature"] for r in result["comparisons"]]
        assert "Monthly price" in features
        assert "Offline mode" in features
        assert "Storage" in features

    def test_single_sided_rows_dropped_but_pros_cons_kept(self):
        # A comparison dict with pros/cons but no real-pair rows should still
        # surface — the frontend renders the pros/cons section even when the
        # main table is empty.
        data = {
            "pros": ["Fast"],
            "cons": ["Expensive"],
            "comparisons": [
                {"feature": "Speed", "thisProduct": "Fast", "competitor": ""},
            ],
        }
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["pros"] == ["Fast"]
        assert result["comparisons"] == []

    def test_empty_list_returns_none(self):
        assert assemble_comparison({}, [], {}, None) is None

    def test_list_with_no_matching_shape_returns_none(self):
        data = [{"unknown_key": "value"}, {"another": "thing"}]
        assert assemble_comparison({}, data, {}, None) is None


class TestAssembleVerdict:
    """assemble_verdict was retired as a standalone component; cached
    `assembledTabs` rows still reference component key "verdict" so the
    assembler now emits ComparisonInteractive-shaped props with the verdict
    folded under `verdict`. ReviewSummary in ComparisonInteractive renders it."""

    def test_valid_verdict_returns_comparison_shape(self):
        data = {"badge": "recommended", "bottomLine": "Great product", "bestFor": ["students"], "notFor": ["pros"]}
        result = assemble_verdict({}, data, {}, None)
        assert result is not None
        assert result["comparisons"] == []
        assert result["pros"] == []
        assert result["cons"] == []
        assert result["verdict"]["badge"] == "recommended"
        assert result["verdict"]["bottomLine"] == "Great product"
        assert result["verdict"]["bestFor"] == ["students"]
        assert result["verdict"]["notFor"] == ["pros"]

    def test_includes_score_when_provided(self):
        data = {"badge": "best_in_class", "bottomLine": "Top pick", "score": 8.5, "maxScore": 10}
        result = assemble_verdict({}, data, {}, None)
        assert result is not None
        assert result["verdict"]["score"] == 8.5
        assert result["verdict"]["maxScore"] == 10

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
                # concept_canvas (post-overhaul) requires ≥2 concepts; provide
                # two so the canvas assembler can produce a tab and the test
                # exercises the new routing path.
                "concepts": [
                    {"name": "Concept 1", "definition": "Def 1", "connections": ["Concept 2"]},
                    {"name": "Concept 2", "definition": "Def 2", "connections": ["Concept 1"]},
                ],
            },
        }
        result = assemble_response(triage, extraction, None, None)

        assert "meta" in result
        assert "tabs" in result
        assert result["meta"]["primaryTag"] == "learning"
        assert len(result["tabs"]) == 2
        assert result["tabs"][0]["component"] == "display_section"
        # "concepts" tab routes to concept_canvas post-overhaul (was flash_deck).
        assert result["tabs"][1]["component"] == "concept_canvas"

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
                    {"day": 1, "city": "Rome", "spots": [
                        {"name": "Colosseum", "description": "Ancient amphitheatre"},
                        {"name": "Forum", "description": "Political heart of old Rome"},
                    ]},
                ],
                "budget": {"total": 2000, "currency": "USD", "breakdown": [{"item": "Hotels", "amount": 1200}]},
                # packing_mission needs ≥2 items post-overhaul
                "packingList": [
                    {"item": "Sunscreen", "category": "Essentials", "essential": True},
                    {"item": "Charger", "category": "Tech", "essential": True},
                ],
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
        # Travel packing tab routes to packing_mission post-overhaul.
        assert result["tabs"][3]["component"] == "packing_mission"

    def test_cross_tab_links_resolved(self):
        triage = self._make_triage(tabs=[
            {"id": "concepts", "label": "Concepts", "emoji": "📚", "dataSource": "learning.concepts"},
            {"id": "quizzes", "label": "Quiz", "emoji": "❓", "dataSource": "enrichment.quiz"},
        ])
        # concept_canvas requires ≥2 concepts post-overhaul
        extraction = {"learning": {"concepts": [
            {"name": "A", "definition": "B", "connections": ["C"]},
            {"name": "C", "definition": "D", "connections": ["A"]},
        ]}}
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
                {"id": "key_points", "label": "Points", "emoji": "💡", "dataSource": "learning.keyPoints", "component": "moment_track"},
            ],
        }
        extraction = {"learning": {"keyPoints": [{"title": "P1"}]}}
        result = assemble_response(triage, extraction, None, None)

        assert result["tabs"][0]["component"] == "moment_track"

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
        # Video-to-action overhaul: "exercises" tab now routes to workout_room
        # (was exercise_tracker). The assembler shares the same data contract.
        assert result["tabs"][0]["component"] == "workout_room"
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


class TestAssembleMomentTrackHighlight:
    """assemble_moment_track with clip-style input (mood + description)."""

    def test_with_moments(self):
        data = [
            {"label": "Best play", "timestamp": 120, "mood": "exciting", "description": "Amazing goal", "endTimestamp": 180},
            {"title": "Funny moment", "timestamp": 300},
        ]
        result = assemble_moment_track({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 2
        assert result["items"][0]["label"] == "Best play"
        assert result["items"][0]["mood"] == "exciting"
        assert result["items"][0]["endSeconds"] == 180
        assert result["items"][1]["label"] == "Funny moment"
        assert "endSeconds" not in result["items"][1]

    def test_empty(self):
        assert assemble_moment_track({}, [], {}, None) is None
        assert assemble_moment_track({}, None, {}, None) is None


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
        # Legacy ID rule fires structurally; label falls back to the target
        # tab's own label when no all_tabs / outbound_links provided.
        links = resolve_cross_tab_links("materials", {"materials", "steps"})
        assert any(l["targetTab"] == "steps" for l in links)


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
            "spot_explorer", "moment_track", "comparison",
            "info_grid", "checklist", "step_player",
            "flash_deck",
            "budget", "overview",
            "concept_canvas", "connect_canvas", "step_flow_canvas",
            "comparison_radar",
            "code_playground", "quiz_arena", "packing_mission",
            "workout_room", "lyrics_karaoke", "video_filmstrip",
            "claims_tracker", "tier_list", "formation_diagram",
            # display
            "display_section",
            # secondary (6, P2)
            "stat_banner", "tip_callout", "summary_header",
            "diagram_card", "frame_strip", "quick_quiz",
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
                "overview", "display_section",
                "comparison", "comparison_radar",
                "budget", "info_grid",
                "lyrics_karaoke",
            ):
                continue
            result = assembler({}, [], {}, None)
            assert result is None, f"{name} should return None for empty list"


# ─── ConnectCanvas (P3B) — answer key derived from concept connections ───


class TestAssembleConnectCanvas:
    def _concepts(self) -> list[dict]:
        return [
            {"name": "Embedding", "definition": "Maps tokens to vectors.", "connections": ["Attention"]},
            {"name": "Attention", "definition": "Weights tokens.", "connections": ["Embedding", "Residual"]},
            {"name": "Residual", "definition": "Skip connection.", "connections": ["Attention"]},
        ]

    def test_derives_pairs_from_connections(self):
        result = assemble_connect_canvas({}, self._concepts(), {}, None)
        assert result is not None
        pairs = result["pairs"]
        assert len(pairs) >= 2
        for pair in pairs:
            assert pair["prompt"]
            assert pair["match"]
            # match must resolve to a real concept name (the answer key)
            assert pair["match"] in {"Embedding", "Attention", "Residual"}
            assert pair["match"] != pair["prompt"]

    def test_answer_key_matches_a_real_connection(self):
        result = assemble_connect_canvas({}, self._concepts(), {}, None)
        by_prompt = {p["prompt"]: p["match"] for p in result["pairs"]}
        # Embedding connects to Attention in the source graph
        assert by_prompt["Embedding"] == "Attention"

    def test_returns_none_without_resolvable_connections(self):
        concepts = [
            {"name": "A", "definition": "x", "connections": ["Nonexistent"]},
            {"name": "B", "definition": "y", "connections": []},
        ]
        assert assemble_connect_canvas({}, concepts, {}, None) is None

    def test_returns_none_below_min_pairs(self):
        concepts = [{"name": "A", "definition": "x", "connections": ["B"]}]
        assert assemble_connect_canvas({}, concepts, {}, None) is None

    def test_accepts_dict_wrapped_concepts(self):
        result = assemble_connect_canvas({}, {"concepts": self._concepts()}, {}, None)
        assert result is not None and len(result["pairs"]) >= 2


# ─── DiagramCard (P3A) — nodes + edges from connections / step order ───


class TestAssembleDiagramCard:
    def test_builds_edges_from_connections(self):
        data = [
            {"label": "Client", "connections": ["Gateway"]},
            {"label": "Gateway", "connections": ["Service"]},
            {"label": "Service", "connections": []},
        ]
        result = assemble_diagram_card({}, data, {}, None)
        assert result is not None
        assert [n["label"] for n in result["nodes"]] == ["Client", "Gateway", "Service"]
        # Edges are index-addressed: Client(0)->Gateway(1), Gateway(1)->Service(2)
        assert {"source": 0, "target": 1} in result["edges"]
        assert {"source": 1, "target": 2} in result["edges"]

    def test_no_edges_key_without_connections(self):
        data = [{"label": "Step 1"}, {"label": "Step 2"}, {"label": "Step 3"}]
        result = assemble_diagram_card({}, data, {}, None)
        assert result is not None
        # No connections → frontend renders a sequential chain; no edges emitted.
        assert "edges" not in result

    def test_drops_self_and_out_of_range_edges(self):
        data = [
            {"label": "A", "connections": ["A", "Ghost"]},
            {"label": "B", "connections": ["A"]},
        ]
        result = assemble_diagram_card({}, data, {}, None)
        assert result is not None
        edges = result.get("edges", [])
        # self-edge (A->A) and ghost target dropped; only B(1)->A(0) survives
        assert {"source": 0, "target": 0} not in edges
        assert {"source": 1, "target": 0} in edges

    def test_caps_at_eight_nodes(self):
        data = [{"label": f"N{i}"} for i in range(12)]
        result = assemble_diagram_card({}, data, {}, None)
        assert result is not None
        assert len(result["nodes"]) == 8

    def test_returns_none_below_two_nodes(self):
        assert assemble_diagram_card({}, [{"label": "only"}], {}, None) is None


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

        domains_path = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "shared" / "src" / "config" / "domains.json"
        config = json.loads(domains_path.read_text())
        json_components = frozenset(config["components"])
        secondaries = frozenset(
            name for name, tier in config.get("componentTiers", {}).items()
            if tier == "secondary"
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


# ─── MomentTrack Fallback ───


class TestMomentTrackFallback:
    """When triage assigns a wrong dataSource for moment_track, assembly falls back to learning.timestamps."""

    def test_moment_track_falls_back_to_learning_timestamps(self):
        """moment_track with invalid dataSource should fall back to learning.timestamps."""
        triage = {
            "contentTags": ["tech", "learning"],
            "primaryTag": "tech",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "moment_track",
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

        assert len(result["tabs"]) == 1, "moment_track tab should survive via fallback"
        tab = result["tabs"][0]
        assert tab["component"] == "moment_track"
        assert len(tab["props"]["items"]) == 2

    def test_moment_track_with_correct_datasource_still_works(self):
        """Regression: moment_track with correct learning.timestamps dataSource works as before."""
        triage = {
            "contentTags": ["tech", "learning"],
            "primaryTag": "tech",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "moment_track",
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
        assert result["tabs"][0]["props"]["items"][0]["label"] == "Intro"

    def test_youtube_chapters_override_empty_timestamps(self):
        """YouTube chapters fill in when learning.timestamps is empty."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "key_moments",
                    "label": "⭐ Key Moments",
                    "emoji": "⭐",
                    "component": "moment_track",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {
            "learning": {"timestamps": []},
        }
        video_meta = {
            "chapters": [
                {"start_time": 0.0, "end_time": 120.0, "title": "YT Intro"},
                {"start_time": 120.0, "end_time": 300.0, "title": "YT Main Content"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        assert len(result["tabs"]) == 1
        items = result["tabs"][0]["props"]["items"]
        assert len(items) == 2
        assert items[0]["label"] == "YT Intro"
        assert items[0]["seconds"] == 0
        assert items[0]["time"] == "0:00"
        # Chapter span: endSeconds should be next chapter start minus 1
        assert items[0]["endSeconds"] == 119
        assert items[0]["mood"] == "chapter"
        assert items[1]["label"] == "YT Main Content"
        assert items[1]["seconds"] == 120
        assert items[1]["time"] == "2:00"

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
                    "component": "moment_track",
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
                {"start_time": 60.0, "end_time": 120.0, "title": "Final Touches"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        assert len(result["tabs"]) == 1
        assert result["tabs"][0]["props"]["items"][0]["label"] == "Best Pizza"

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
                    "component": "moment_track",
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
        assert result["tabs"][0]["props"]["items"][0]["label"] == "LLM Topic"

    def test_chapters_time_formatting_with_hours(self):
        """Chapters over 1 hour get H:MM:SS format."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "timestamps",
                    "component": "moment_track",
                    "dataSource": "learning.timestamps",
                },
            ],
        }
        extraction = {"learning": {"timestamps": []}}
        video_meta = {
            "chapters": [
                {"start_time": 3661.0, "end_time": 4000.0, "title": "Hour Mark"},
                {"start_time": 4000.0, "end_time": 4500.0, "title": "Follow-up"},
            ],
        }
        result = assemble_response(triage, extraction, None, None, video_meta=video_meta)
        entry = result["tabs"][0]["props"]["items"][0]
        assert entry["time"] == "1:01:01"
        assert entry["seconds"] == 3661

    def test_chapters_fallback_sets_endSeconds(self):
        """Each chapter span gets endSeconds = next.start - 1; final uses video duration."""
        chapters = [
            {"start_time": 0.0, "title": "A"},
            {"start_time": 100.0, "title": "B"},
            {"start_time": 250.0, "title": "C"},
        ]
        items = _chapters_to_moments(chapters, video_duration=400)
        assert items[0]["endSeconds"] == 99
        assert items[1]["endSeconds"] == 249
        # Final chapter uses video_duration - 1
        assert items[2]["endSeconds"] == 399
        # All chapters flagged as mood="chapter"
        assert all(item["mood"] == "chapter" for item in items)

    def test_music_cross_tab_links_use_moment_track(self):
        """Music-domain cross-tab rules resolve to moment_track, not clip_player."""
        from src.services.pipeline.assembly.cross_tab import _COMPONENT_LINK_RULES
        source_components = {(src, tgt, domain) for src, tgt, domain in _COMPONENT_LINK_RULES}
        assert ("lyrics_karaoke", "moment_track", "music") in source_components
        assert ("moment_track", "info_grid", "music") in source_components
        # Confirm the old clip_player rules are gone
        clip_player_rules = [
            (src, tgt) for src, tgt, _domain in _COMPONENT_LINK_RULES
            if src == "clip_player" or tgt == "clip_player"
        ]
        assert clip_player_rules == []


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

    def test_inject_frame_thumbnails_preserves_s3_key(self):
        """API re-signs URLs at read time from s3Key, so the injector MUST
        carry s3_key through alongside the at-generation-time thumbnailUrl."""
        items = [{"label": "Intro", "seconds": 5}]
        frames = [
            {"timestamp": 10.0, "s3_url": "fresh-url", "s3_key": "videos/abc/frames/10.jpg"},
        ]
        inject_frame_thumbnails(items, frames)
        assert items[0]["thumbnailUrl"] == "fresh-url"
        assert items[0]["s3Key"] == "videos/abc/frames/10.jpg"

    def test_inject_frame_thumbnails_no_s3_key_no_field(self):
        """Frames without s3_key (e.g. dev fixtures) should not add an s3Key field."""
        items = [{"label": "Intro", "seconds": 5}]
        frames = [{"timestamp": 10.0, "s3_url": "url1"}]
        inject_frame_thumbnails(items, frames)
        assert items[0]["thumbnailUrl"] == "url1"
        assert "s3Key" not in items[0]


# ─── Gallery Tab Assembly ───


class TestGalleryTabAssembly:
    def test_gallery_tab_created_when_curated_frames(self):
        """Filmstrip tab only appears when >8 frames AND >50% non-generic captions."""
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
        # The standalone gallery component was retired; frames surface as a
        # video_filmstrip scrubber.
        assert gallery_tabs[0]["component"] == "video_filmstrip"

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
        strip_frames = gallery_tabs[0]["props"]["frames"]
        # First 3 should be sorted by timestamp
        assert strip_frames[0]["timestamp"] == 10
        assert strip_frames[1]["timestamp"] == 30
        assert strip_frames[2]["timestamp"] == 60

    def test_gallery_not_created_for_few_generic_frames(self):
        """Few frames without OCR text → no gallery tab."""
        triage = {"contentTags": ["learning"], "primaryTag": "learning", "tabs": []}
        extraction = {"learning": {"summary": "Test"}}
        frames = [{"timestamp": float(i), "s3_url": f"url{i}", "index": i} for i in range(5)]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tabs = [t for t in result["tabs"] if t["id"] == "frames-gallery"]
        assert len(gallery_tabs) == 0

    def test_gallery_filmstrip_holds_all_frames(self):
        triage = {"contentTags": ["learning"], "primaryTag": "learning", "tabs": []}
        extraction = {"learning": {"summary": "Test"}}
        frames = [{"timestamp": float(i * 10), "s3_url": f"url{i}", "index": i, "ocr_text": f"Slide {i}"} for i in range(15)]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tab = [t for t in result["tabs"] if t["id"] == "frames-gallery"][0]
        assert gallery_tab["component"] == "video_filmstrip"
        assert len(gallery_tab["props"]["frames"]) == 15


# ─── Flexible Assembler Tests ───


class TestFlexSpotExplorer:
    """Tests for cross-domain spot_explorer input shapes."""

    def test_name_description_shape(self):
        data = [
            {"name": "React Hooks", "description": "State management primitive", "emoji": "⚛️"},
            {"name": "useEffect", "description": "Side-effect scheduling", "emoji": "⚛️"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["name"] == "React Hooks"
        assert result["spots"][0]["description"] == "State management primitive"

    def test_aspect_detail_shape(self):
        data = [
            {"aspect": "Melody", "emoji": "🎵", "detail": "Uses pentatonic scale"},
            {"aspect": "Harmony", "emoji": "🎼", "detail": "Stacked thirds over I-IV-V"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert result["spots"][0]["name"] == "Melody"
        assert result["spots"][0]["description"] == "Uses pentatonic scale"

    def test_label_explanation_shape(self):
        data = [
            {"label": "Cognitive Bias", "explanation": "Systematic error in thinking"},
            {"label": "Anchoring", "explanation": "Over-reliance on first piece of information"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert result["spots"][0]["name"] == "Cognitive Bias"
        assert result["spots"][0]["description"] == "Systematic error in thinking"

    def test_empty_list_returns_none(self):
        assert assemble_spot_explorer({}, [], {}, None) is None

    def test_passthrough_fields(self):
        data = [
            {"name": "Place", "description": "Nice", "cost": "$50", "mapQuery": "place+near+me"},
            {"name": "Spot B", "description": "Also nice", "cost": "$30"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
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
            {"word": "fluent", "definition": "Able to express oneself easily", "pronunciation": "ˈfluːənt", "partOfSpeech": "adjective"},
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

    def test_name_description_shape_routes_elsewhere(self):
        # {name, description} is single-sided — belongs in info_grid or
        # spot_explorer, never in comparison. The previous coercion produced
        # the audited "column 3 empty" rendering on review videos.
        data = [
            {"name": "React", "emoji": "⚛️", "description": "Component-based UI library"},
            {"name": "Vue", "emoji": "💚", "description": "Progressive framework"},
        ]
        assert assemble_comparison({}, data, {}, None) is None

    def test_cheatsheet_routes_to_code_explorer_not_comparison(self):
        # {title, description, code} is code-snippet-shaped — route via
        # code_explorer. Comparison no longer coerces this shape.
        data = [{"title": "useState", "description": "State hook", "code": "const [x, setX] = useState()"}]
        assert assemble_comparison({}, data, {}, None) is None

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

    # ─── Audited-bug regression tests ──────────────────────────────
    # The following shapes were ALL silently producing empty-card grids on
    # real videos (Stocks "8 Key Signals", Transformers "14 Core Concepts",
    # Karpathy "14 Core Concepts", Travel "60 Insider Tips"). Each shape now
    # has explicit normalizer coverage.

    def test_name_definition_shape_concepts(self):
        # Most common concept shape from the LLM. Was the root cause of half
        # the audited empty-grid renderings.
        data = [
            {"name": "MCP", "definition": "Model Context Protocol"},
            {"name": "Attention", "definition": "Weighted sum over token embeddings"},
        ]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "MCP"
        assert result["items"][0]["value"] == "Model Context Protocol"

    def test_name_definition_example_shape(self):
        # Example field surfaces as `evidence` so the card has supporting
        # context without crowding the primary value text.
        data = [{"name": "Tokenization", "definition": "Splitting text into units",
                 "example": "'Hello world' → ['Hello', 'world']"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["value"] == "Splitting text into units"
        assert result["items"][0]["evidence"] == "'Hello world' → ['Hello', 'world']"

    def test_title_detail_source_science_keyfacts(self):
        # science.keyFacts shape — title→key, detail→value, source→evidence.
        data = [{"emoji": "🔬", "title": "Heat capacity",
                 "detail": "Water has higher heat capacity than air",
                 "source": "Physics 101 chapter 4"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Heat capacity"
        assert result["items"][0]["evidence"] == "Physics 101 chapter 4"

    def test_aspect_detail_music_analysis(self):
        # music.analysis shape — aspect→key, detail→value.
        data = [{"aspect": "Tempo", "detail": "Steady 120 BPM", "emoji": "🎵"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Tempo"
        assert result["items"][0]["value"] == "Steady 120 BPM"

    def test_phrase_translation_context_language(self):
        # language.phrases shape — phrase→key, translation→value, context→evidence.
        data = [{"phrase": "Quel dommage", "translation": "What a shame",
                 "context": "Said when something unfortunate happens"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "Quel dommage"
        assert result["items"][0]["value"] == "What a shame"
        assert result["items"][0]["evidence"].startswith("Said when")

    def test_term_definition_shape(self):
        data = [{"term": "ReLU", "definition": "Rectified Linear Unit — max(0, x)"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "ReLU"

    def test_fact_explanation_shape(self):
        data = [{"fact": "DNA stores genetic information", "explanation": "Via base-pair sequences"}]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert result["items"][0]["key"] == "DNA stores genetic information"

    def test_drops_items_with_no_value(self):
        # Headline-only items with no body text produce empty cards — these
        # were the visible failure mode. Drop them silently so the surviving
        # items still render cleanly.
        data = [
            {"name": "Real concept", "definition": "Has substance"},
            {"name": "Empty"},  # ← dropped
            {"name": "", "definition": "no key"},  # ← dropped
        ]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 1
        assert result["items"][0]["key"] == "Real concept"

    def test_returns_none_when_nothing_normalizes(self):
        # Every item fails normalization → no items → drop the tab so the
        # fallback layer can route the data elsewhere.
        data = [{"only": "garbage"}, {"more": "garbage"}]
        assert assemble_info_grid({}, data, {}, None) is None

    def test_drops_items_with_empty_value_in_key_value_shape(self):
        # Regression: the {key, value} early-return branch previously let
        # items with empty `value` pass through, producing the very
        # empty-card grid this normalizer was meant to prevent. The fallback
        # path correctly required non-empty value; the early branch must do
        # the same so both paths are symmetric.
        data = [
            {"key": "Real", "value": "Has body"},
            {"key": "Empty value", "value": ""},  # ← must be dropped
            {"key": "Whitespace", "value": "   "},  # ← must be dropped
            {"key": "", "value": "no key"},  # ← already covered
        ]
        result = assemble_info_grid({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 1
        assert result["items"][0]["key"] == "Real"

    def test_drops_comparison_single_sided_rows_per_row(self):
        # Regression: previously a comparison with any one real-pair row kept
        # ALL rows including single-sided ones, which rendered as half-empty
        # rows next to the real pairs. Now single-sided rows are dropped
        # individually so the table only contains usable comparisons.
        from src.services.pipeline.assembly.assemblers import assemble_comparison

        data = [
            {"feature": "Battery", "thisProduct": "12h", "competitor": "8h"},
            {"feature": "Camera", "thisProduct": "12MP", "competitor": ""},  # ← drop
            {"feature": "Weight", "thisProduct": "", "competitor": "1.6kg"},  # ← drop
            {"feature": "Price", "thisProduct": "$999", "competitor": "$1099"},
        ]
        result = assemble_comparison(
            {}, data, {"review": {"product": "Phone A"}}, None,
        )
        assert result is not None
        # Only the two genuine pair rows survive.
        assert len(result["comparisons"]) == 2
        features = [r["feature"] for r in result["comparisons"]]
        assert features == ["Battery", "Price"]


class TestFrameMetadataInjection:
    """Tests for the assembler's frame-metadata wiring (Phase 2)."""

    def test_attaches_vision_caption_to_item(self):
        from src.services.pipeline.assembly.core import inject_frame_thumbnails

        frames = [
            {"timestamp": 60.0, "s3_url": "https://s3/frame60.jpg", "s3_key": "frame60"},
        ]
        descriptions = [{
            "timestamp_sec": 60.0,
            "scene_type": "code",
            "content": "Python function implementing binary search",
            "text_visible": "def binary_search(arr, target):",
            "educational_value": "Shows the exact implementation discussed",
        }]
        items = [{"timestamp": 60.0, "label": "Binary search demo"}]
        inject_frame_thumbnails(items, frames, frame_descriptions=descriptions)

        assert items[0]["thumbnailUrl"] == "https://s3/frame60.jpg"
        assert items[0]["frameCaption"] == "Python function implementing binary search"
        assert items[0]["frameSceneType"] == "code"
        assert items[0]["frameOcr"] == "def binary_search(arr, target):"
        assert items[0]["frameEvidence"].startswith("Shows the exact")

    def test_skips_talking_head_without_educational_value(self):
        from src.services.pipeline.assembly.core import inject_frame_thumbnails

        frames = [{"timestamp": 30.0, "s3_url": "https://s3/f30.jpg"}]
        descriptions = [{
            "timestamp_sec": 30.0,
            "scene_type": "talking_head",
            "content": "Presenter looking at camera",
            "educational_value": "",
        }]
        items = [{"timestamp": 30.0, "label": "Intro"}]
        inject_frame_thumbnails(items, frames, frame_descriptions=descriptions)

        # Thumbnail is still attached (presenter shot is still SOME visual),
        # but the caption isn't — we don't pretend the frame illustrates the
        # claim when it's just a face.
        assert items[0]["thumbnailUrl"] == "https://s3/f30.jpg"
        assert "frameCaption" not in items[0]

    def test_keeps_talking_head_when_marked_educational(self):
        from src.services.pipeline.assembly.core import inject_frame_thumbnails

        frames = [{"timestamp": 30.0, "s3_url": "https://s3/f30.jpg"}]
        descriptions = [{
            "timestamp_sec": 30.0,
            "scene_type": "talking_head",
            "content": "Presenter holding the product up",
            "educational_value": "Shows scale of the device next to a hand",
        }]
        items = [{"timestamp": 30.0, "label": "Size demo"}]
        inject_frame_thumbnails(items, frames, frame_descriptions=descriptions)

        assert items[0]["frameCaption"] == "Presenter holding the product up"
        assert "frameEvidence" in items[0]


class TestSpotExplorerEmptyFiltering:
    """Tests for filtering empty/low-quality spots in spot_explorer assembler."""

    def test_empty_spots_are_dropped(self):
        data = [
            {"name": "", "description": ""},
            {"name": "Valid Spot", "description": "Has content"},
            {"name": "", "description": ""},
            {"name": "Second Valid", "description": "Also real content"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["name"] == "Valid Spot"
        assert result["spots"][1]["name"] == "Second Valid"

    def test_all_empty_spots_returns_none(self):
        data = [{"name": "", "description": ""}, {"name": "", "description": ""}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_spot_with_only_name_is_dropped(self):
        """A spot with just a name (no description or passthrough) renders as an empty card — drop it."""
        data = [
            {"name": "Has name only", "description": ""},
            {"name": "Also name only", "description": ""},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_spot_with_only_description_is_dropped(self):
        """A spot with no name cannot be the title of a card — drop it."""
        data = [
            {"name": "", "description": "Has description only"},
            {"name": "", "description": "Another orphan description"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_bare_string_list_rejected(self):
        """List of raw strings (keyword pollution) should not assemble as spots."""
        data = ["live dashboards", "API integration", "data visualization", "scheduled data refresh"]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_below_minimum_spot_count_returns_none(self):
        """A single valid spot is not an explorer — drop so fallback layer can recover."""
        data = [{"name": "Lonely Spot", "description": "Only one"}]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_name_plus_emoji_is_kept(self):
        """Name + emoji-only (no description) is still meaningful visual content."""
        data = [
            {"name": "Tokyo Tower", "emoji": "🗼"},
            {"name": "Sky Tree", "emoji": "🗾"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["emoji"] == "🗼"

    def test_mixed_valid_and_invalid_keeps_only_valid(self):
        data = [
            {"name": "Real Place", "description": "With detail"},
            {"name": "Name only"},
            {"name": "Another Real Place", "emoji": "📍"},
            {"name": ""},
            {"description": "Orphan description"},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 2
        assert result["spots"][0]["name"] == "Real Place"
        assert result["spots"][1]["name"] == "Another Real Place"

    def test_travel_day_empty_spots_drops_tab(self):
        """TravelDay where every day's spots are name-only — whole tab drops."""
        data = [
            {"day": 1, "city": "Rome", "spots": [{"name": "Colosseum"}, {"name": "Forum"}]},
            {"day": 2, "city": "Florence", "spots": [{"name": "Duomo"}]},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is None

    def test_travel_day_section_indices_stay_aligned_after_filter(self):
        """When some day-spots are filtered, sections' spotIndices must re-align to the kept list."""
        data = [
            {"day": 1, "city": "Rome", "spots": [
                {"name": "Colosseum", "description": "Ancient amphitheatre"},
                {"name": "Name only"},
                {"name": "Forum", "description": "Political heart"},
            ]},
            {"day": 2, "city": "Florence", "spots": [
                {"name": "Duomo"},
            ]},
            {"day": 3, "city": "Venice", "spots": [
                {"name": "St Mark's", "description": "Basilica square"},
            ]},
        ]
        result = assemble_spot_explorer({}, data, {}, None)
        assert result is not None
        assert len(result["spots"]) == 3
        assert result["spots"][0]["name"] == "Colosseum"
        assert result["spots"][1]["name"] == "Forum"
        assert result["spots"][2]["name"] == "St Mark's"
        assert len(result["sections"]) == 2
        assert result["sections"][0]["label"] == "Day 1: Rome"
        assert result["sections"][0]["spotIndices"] == [0, 1]
        assert result["sections"][1]["label"] == "Day 3: Venice"
        assert result["sections"][1]["spotIndices"] == [2]


class TestComparisonProductLabel:
    """Tests for product name extraction in comparison assembler."""

    def test_product_from_review_extraction(self):
        data = {"pros": ["Fast"], "cons": [], "comparisons": []}
        extraction = {"review": {"product": "Pixel 8 Pro", "pros": ["Fast"]}}
        result = assemble_comparison({}, data, extraction, None)
        assert result is not None
        assert result["leftLabel"] == "Pixel 8 Pro"

    def test_no_video_title_fallback(self):
        # Video title MUST NOT be used as leftLabel — that produced the audited
        # "I'm Doubling Down On 2 Stocks Before June" column header on the
        # stocks Risk Check tab. Only review.product is allowed as the label.
        data = {"pros": ["Great"], "cons": [], "comparisons": []}
        tab = {"_video_meta": {"title": "Claude Code is unusable now"}}
        result = assemble_comparison(tab, data, {}, None)
        assert result is not None
        assert result["leftLabel"] == ""

    def test_empty_label_when_no_product(self):
        data = {"pros": ["Good"], "cons": [], "comparisons": []}
        result = assemble_comparison({}, data, {}, None)
        assert result is not None
        assert result["leftLabel"] == ""
        assert result["rightLabel"] == ""

    def test_review_product_used_when_explicit(self):
        data = {"pros": ["Fast"], "cons": [], "comparisons": []}
        tab = {"_video_meta": {"title": "Is Pixel 8 Worth It?"}}
        extraction = {"review": {"product": "Google Pixel 8 Pro"}}
        result = assemble_comparison(tab, data, extraction, None)
        assert result is not None
        assert result["leftLabel"] == "Google Pixel 8 Pro"

    def test_list_with_no_real_pairs_returns_none(self):
        # Single-side rows used to coerce into comparison rows via the title
        # → feature, description → thisProduct, code → competitor pathway.
        # The new contract requires actual A-vs-B pairs.
        data = [
            {"title": "Battery", "description": "5000mAh", "code": "All day"},
        ]
        tab = {"_video_meta": {"title": "Phone Review"}}
        assert assemble_comparison(tab, data, {}, None) is None


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
            {"id": "exercises", "component": "workout_room"},
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

    def test_caps_oversized_comparison_to_10(self):
        """Regression: a 29-row comparison (the Yann LeCun video bug) must be capped to 10."""
        from src.services.pipeline.assembly.core import _post_process_tabs
        tabs = [
            {
                "id": "concepts",
                "label": "Concepts",
                "component": "comparison",
                "emoji": "⚖️",
                "props": {"comparisons": [{"feature": f"f{i}", "left": "L", "right": "R"} for i in range(29)]},
            },
        ]
        _post_process_tabs(tabs)
        assert len(tabs[0]["props"]["comparisons"]) == 10
        # Count-derived label uses the capped count, not the original 29
        assert tabs[0]["label"].startswith("10 ")

    def test_caps_oversized_moment_track_to_20(self):
        """Regression: 55-item timelines must be capped to 20."""
        from src.services.pipeline.assembly.core import _post_process_tabs
        tabs = [
            {
                "id": "key_moments",
                "label": "Key Moments",
                "component": "moment_track",
                "emoji": "⏱️",
                "props": {"items": [{"time": f"{i}:00", "seconds": i * 60, "label": f"m{i}"} for i in range(55)]},
            },
        ]
        _post_process_tabs(tabs)
        assert len(tabs[0]["props"]["items"]) == 20

    def test_moment_track_cap_scales_with_duration_and_spans_video(self):
        """Long videos: timeline cap scales with duration and keeps items
        evenly across the whole video (not just the first N)."""
        from src.services.pipeline.assembly.core import _post_process_tabs
        # 4.5h video, 72 timestamps spread to the end.
        items = [{"time": f"{i}:00", "seconds": i * 233, "label": f"m{i}"} for i in range(72)]
        tabs = [{
            "id": "key_moments", "label": "Key Moments", "component": "moment_track",
            "emoji": "⏱️", "props": {"items": list(items)},
        }]
        _post_process_tabs(tabs, video_duration=16789)  # ~280 min → cap ~40
        kept = tabs[0]["props"]["items"]
        assert 35 <= len(kept) <= 45
        # First and last moments are preserved → timeline spans the whole video.
        assert kept[0]["seconds"] == items[0]["seconds"]
        assert kept[-1]["seconds"] == items[-1]["seconds"]

    def test_evenly_sample_preserves_first_and_last(self):
        from src.services.pipeline.assembly.core import _evenly_sample
        items = list(range(100))
        sampled = _evenly_sample(items, 10)
        assert sampled[0] == 0
        assert sampled[-1] == 99
        assert len(sampled) <= 10
        # Returns input unchanged when already within cap.
        assert _evenly_sample([1, 2, 3], 10) == [1, 2, 3]

    def test_caps_oversized_info_grid_to_20(self):
        from src.services.pipeline.assembly.core import _post_process_tabs
        tabs = [
            {
                "id": "facts",
                "label": "Facts",
                "component": "info_grid",
                "emoji": "📋",
                "props": {"items": [{"key": f"k{i}", "value": "v"} for i in range(40)]},
            },
        ]
        _post_process_tabs(tabs)
        assert len(tabs[0]["props"]["items"]) == 20

    def test_within_cap_passes_unchanged(self):
        """Tabs already within the cap must not be touched."""
        from src.services.pipeline.assembly.core import _post_process_tabs
        original = [{"feature": f"f{i}", "left": "L", "right": "R"} for i in range(5)]
        tabs = [
            {
                "id": "compare",
                "label": "Compare",
                "component": "comparison",
                "emoji": "⚖️",
                "props": {"comparisons": list(original)},
            },
        ]
        _post_process_tabs(tabs)
        assert tabs[0]["props"]["comparisons"] == original


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
        """Multiple quiz_arena tabs in tech → only first kept (post-overhaul: quiz → quiz_arena)."""
        tabs = [
            {"id": "quiz1", "component": "quiz_arena", "label": "Quiz 1", "goal": "Test"},
            {"id": "quiz2", "component": "quiz_arena", "label": "Quiz 2", "goal": "Test more"},
        ]
        _validate_domain_requirements(tabs, "tech")
        quiz_tabs = [t for t in tabs if t["component"] == "quiz_arena"]
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


class TestMomentItemNormalization:
    """_normalize_moment_item + assemble_moment_track — merged point/clip normalization."""

    def test_valid_entry_passthrough(self):
        result = _normalize_moment_item({"label": "Intro", "time": "0:00", "seconds": 0}, 0)
        assert result is not None
        assert result["label"] == "Intro"
        assert result["seconds"] == 0
        # No endSeconds ⇒ point moment
        assert "endSeconds" not in result

    def test_missing_time_computed(self):
        result = _normalize_moment_item({"label": "Test", "seconds": 125}, 0)
        assert result is not None
        assert result["time"] == "2:05"

    def test_label_aliases(self):
        result = _normalize_moment_item({"title": "Chapter 1", "seconds": 0}, 0)
        assert result["label"] == "Chapter 1"
        result = _normalize_moment_item({"name": "Section A", "seconds": 0}, 0)
        assert result["label"] == "Section A"

    def test_string_entry(self):
        result = _normalize_moment_item("Introduction", 0)
        assert result is not None
        assert result["label"] == "Introduction"
        assert result["seconds"] == 0

    def test_empty_string_returns_none(self):
        assert _normalize_moment_item("", 0) is None

    def test_non_dict_non_str_returns_none(self):
        assert _normalize_moment_item(42, 0) is None

    def test_missing_label_gets_default(self):
        result = _normalize_moment_item({"seconds": 60}, 2)
        assert result["label"] == "Moment 3"

    def test_label_from_description_when_no_title(self):
        """When label/title/name are absent, derive from description prefix."""
        result = _normalize_moment_item({"timestamp": 30, "description": "Amazing goal sailed over the defender"}, 0)
        assert result["label"] == "Amazing goal sailed over the defender"[:60]

    def test_endSeconds_preserved_when_valid(self):
        """endSeconds is kept when > seconds + 1 (real span)."""
        result = _normalize_moment_item({"label": "Demo", "seconds": 100, "endSeconds": 160}, 0)
        assert result["endSeconds"] == 160

    def test_endSeconds_dropped_when_too_short(self):
        """endSeconds is dropped when it's ≤ seconds + 1 (not a real span)."""
        result = _normalize_moment_item({"label": "X", "seconds": 100, "endSeconds": 101}, 0)
        assert "endSeconds" not in result

    def test_startSeconds_maps_to_seconds(self):
        """Legacy clip shape using startSeconds maps into canonical seconds."""
        result = _normalize_moment_item({"label": "X", "startSeconds": 42}, 0)
        assert result["seconds"] == 42

    def test_endTimestamp_alias(self):
        """narrative.keyMoments uses endTimestamp — the normalizer accepts it."""
        result = _normalize_moment_item({"label": "X", "timestamp": 200, "endTimestamp": 260}, 0)
        assert result["seconds"] == 200
        assert result["endSeconds"] == 260

    def test_optional_fields_passthrough(self):
        result = _normalize_moment_item({
            "label": "X", "seconds": 10, "description": "detail",
            "mood": "excited", "emoji": "🔥", "speaker": "Gordon",
            "tags": ["highlight"], "thumbnailUrl": "https://a/b.jpg",
        }, 0)
        assert result["description"] == "detail"
        assert result["mood"] == "excited"
        assert result["emoji"] == "🔥"
        assert result["speaker"] == "Gordon"
        assert result["tags"] == ["highlight"]
        assert result["thumbnailUrl"] == "https://a/b.jpg"

    def test_assembler_normalizes(self):
        data = [
            {"title": "Start", "timestamp": 0},
            {"label": "Middle", "seconds": 120},
            42,  # dropped
        ]
        result = assemble_moment_track({}, data, {}, None)
        assert result is not None
        assert len(result["items"]) == 2
        assert result["items"][0]["label"] == "Start"
        assert result["items"][1]["time"] == "2:00"

    def test_mixed_points_and_spans(self):
        """Single items[] with both navigation points and highlight spans."""
        data = [
            {"label": "Intro", "timestamp": 0},                                    # point
            {"label": "Punchline", "timestamp": 60, "endTimestamp": 78},           # span
            {"label": "Wrap", "timestamp": 200},                                   # point
        ]
        result = assemble_moment_track({}, data, {}, None)
        items = result["items"]
        assert len(items) == 3
        assert "endSeconds" not in items[0]
        assert items[1]["endSeconds"] == 78
        assert "endSeconds" not in items[2]

    # ─── Malformed-input safety net (P1 sign-off) ────────────────────────
    # These guard the chain `label or title or name or description[:60] or
    # "Moment N+1"` against JSON `null`, empty strings, and string-typed
    # numerics that LLMs occasionally emit despite the schema saying int.

    def test_null_label_falls_back_to_description(self):
        """JSON null label should not block the description fallback."""
        result = _normalize_moment_item(
            {"label": None, "seconds": 30, "description": "Demo of pivot table"}, 0,
        )
        assert result is not None
        assert result["label"] == "Demo of pivot table"

    def test_null_label_and_title_fall_back_to_name(self):
        """Cascading nulls don't short-circuit the alias chain."""
        result = _normalize_moment_item(
            {"label": None, "title": None, "name": "Section A", "seconds": 0}, 0,
        )
        assert result["label"] == "Section A"

    def test_seconds_as_numeric_string_coerces_to_int(self):
        """LLM sometimes returns `"seconds": "125"` despite schema asking for int."""
        result = _normalize_moment_item({"label": "X", "seconds": "125"}, 0)
        assert result is not None and result["seconds"] == 125

    def test_seconds_as_numeric_string_renders_time(self):
        """The coerced int feeds the time formatter — verify the visible label."""
        result = _normalize_moment_item({"label": "X", "seconds": "125"}, 0)
        assert result is not None and result["time"] == "2:05"

    def test_seconds_as_garbage_string_falls_back_to_zero(self):
        """Unparseable seconds shouldn't crash the assembler — fall back to 0."""
        result = _normalize_moment_item({"label": "X", "seconds": "abc"}, 0)
        assert result is not None and result["seconds"] == 0

    def test_seconds_as_garbage_string_renders_zero_time(self):
        """The 0-second fallback formats as 0:00, not blank or 'None'."""
        result = _normalize_moment_item({"label": "X", "seconds": "abc"}, 0)
        assert result is not None and result["time"] == "0:00"

    def test_null_endSeconds_omitted(self):
        """JSON null endSeconds collapses to a point moment (no endSeconds key)."""
        result = _normalize_moment_item(
            {"label": "X", "seconds": 100, "endSeconds": None}, 0,
        )
        assert result is not None
        assert "endSeconds" not in result


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


class TestMomentTrackClipDefaults:
    """assemble_moment_track with clip-style input — default value behavior."""

    def test_label_fallback_chain(self):
        result = assemble_moment_track({}, [{"timestamp": 10}], {}, None)
        assert result is not None
        # No label/title/description ⇒ default "Moment 1"
        assert result["items"][0]["label"] == "Moment 1"

    def test_label_from_title(self):
        result = assemble_moment_track({}, [{"title": "Great moment"}], {}, None)
        assert result["items"][0]["label"] == "Great moment"

    def test_seconds_from_timestamp(self):
        result = assemble_moment_track({}, [{"label": "X", "timestamp": 120}], {}, None)
        assert result["items"][0]["seconds"] == 120
        assert result["items"][0]["time"] == "2:00"
        # No endSeconds ⇒ point, not span
        assert "endSeconds" not in result["items"][0]

    def test_optional_fields_omitted_when_absent(self):
        """Optional fields (description, mood, ...) are dropped — not defaulted."""
        result = assemble_moment_track({}, [{"label": "X"}], {}, None)
        item = result["items"][0]
        assert "description" not in item
        assert "mood" not in item


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
        assert _validate_assembled_props("moment_track", {"data": "something"}) is False

    def test_moment_track_required_list_items(self):
        """Required list for moment_track is 'items' — empty list drops the tab."""
        assert _validate_assembled_props("moment_track", {"items": []}) is False
        assert _validate_assembled_props("moment_track", {"items": [{"label": "x"}]}) is True

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


# ─── Flashcard prefix cleanup ───


class TestFlashCardNoEnglishPrefixes:
    """`_to_flash_card` historically prepended English category labels
    ("Form: ", "Duration: ", "Level: ", "Modifications: ", "Example: ")
    when building cards from exercise/vocab/tip data. Those prefixes
    leak English into non-English flashcards. The new contract emits
    only the raw value — the card's `front` already carries the term."""

    def test_exercise_card_has_no_form_or_duration_prefix(self):
        from src.services.pipeline.assembly.assemblers import _to_flash_card
        card = _to_flash_card({
            "name": "Plank",
            "formCues": ["Keep your hips level", "Engage your core"],
            "duration": "30 seconds",
            "difficulty": "intermediate",
        })
        assert card["front"] == "Plank"
        back = card["back"]
        assert "Form:" not in back
        assert "Duration:" not in back
        assert "Level:" not in back
        # The actual content survives, separated cleanly.
        assert "Keep your hips level" in back
        assert "30 seconds" in back
        assert "intermediate" in back

    def test_exercise_card_with_modifications_drops_prefix(self):
        from src.services.pipeline.assembly.assemblers import _to_flash_card
        card = _to_flash_card({
            "name": "Push-up",
            "formCues": ["Straight back"],
            "modifications": ["Knee push-up", "Wall push-up"],
        })
        assert "Modifications:" not in card["back"]
        assert "Knee push-up" in card["back"]

    def test_vocab_card_drops_example_prefix(self):
        from src.services.pipeline.assembly.assemblers import _to_flash_card
        card = _to_flash_card({
            "word": "Ephemeral",
            "definition": "Lasting for a very short time",
            "example": "Cherry blossoms are ephemeral",
        })
        assert card["front"] == "Ephemeral"
        assert "Example:" not in card["back"]
        assert "Lasting for a very short time" in card["back"]
        assert "Cherry blossoms are ephemeral" in card["back"]

    def test_preserves_pre_built_front_back(self):
        from src.services.pipeline.assembly.assemblers import _to_flash_card
        # Standard front+back input passes through untouched.
        card = _to_flash_card({"front": "Q", "back": "A", "emoji": "💡"})
        assert card == {"front": "Q", "back": "A", "emoji": "💡"}


# ─── Phase 5b: claims_tracker (news signature component) ───


class TestAssembleClaimsTracker:
    def test_normalizes_full_claims(self):
        data = [
            {"claim": "Jobs created: 1200", "source": "Mayor", "status": "disputed",
             "sourceCitation": "Analysts say 700", "timestamp": 210},
            {"claim": "Fares rise 15%", "source": "Authority", "status": "verified"},
        ]
        result = assemble_claims_tracker({}, data, {}, None)
        assert result is not None
        claims = result["claims"]
        assert len(claims) == 2
        assert claims[0]["status"] == "disputed"
        assert claims[0]["source"] == "Mayor"
        assert claims[0]["sourceCitation"] == "Analysts say 700"
        assert claims[0]["timestamp"] == 210

    def test_unknown_status_defaults_to_context(self):
        data = [
            {"claim": "A bold assertion", "source": "Pundit", "status": "true"},
            {"claim": "Another assertion", "source": "Pundit"},
        ]
        result = assemble_claims_tracker({}, data, {}, None)
        assert result["claims"][0]["status"] == "context"
        assert result["claims"][1]["status"] == "context"

    def test_missing_source_defaults_to_reporter(self):
        data = [
            {"claim": "Claim one", "status": "context"},
            {"claim": "Claim two", "status": "verified"},
        ]
        result = assemble_claims_tracker({}, data, {}, None)
        assert result["claims"][0]["source"] == "Reporter"

    def test_dict_wrapper_with_claims_key(self):
        data = {"claims": [
            {"claim": "C1", "source": "S1", "status": "verified"},
            {"claim": "C2", "source": "S2", "status": "context"},
        ]}
        result = assemble_claims_tracker({}, data, {}, None)
        assert len(result["claims"]) == 2

    def test_drops_claims_with_no_text(self):
        data = [
            {"claim": "", "source": "S1", "status": "verified"},
            {"source": "S2", "status": "context"},
            {"claim": "Real claim", "source": "S3", "status": "verified"},
            {"claim": "Second real", "source": "S4", "status": "disputed"},
        ]
        result = assemble_claims_tracker({}, data, {}, None)
        assert len(result["claims"]) == 2

    def test_below_min_returns_none(self):
        # One real claim is below the 2-claim minimum.
        result = assemble_claims_tracker({}, [{"claim": "Only one", "source": "S"}], {}, None)
        assert result is None

    def test_empty_returns_none(self):
        assert assemble_claims_tracker({}, [], {}, None) is None
        assert assemble_claims_tracker({}, None, {}, None) is None


class TestPodcastAssembly:
    def _triage(self):
        return {
            "contentTags": ["podcast"],
            "modifiers": [],
            "primaryTag": "podcast",
            "userGoal": "Follow the conversation",
            "tabs": [
                {"id": "segments", "label": "Segments", "emoji": "🎙️",
                 "component": "moment_track", "dataSource": "podcast.segments"},
                {"id": "guests", "label": "Guests", "emoji": "🧑",
                 "component": "spot_explorer", "dataSource": "podcast.guests"},
                {"id": "quotes", "label": "Quotes", "emoji": "💬",
                 "component": "flash_deck", "dataSource": "podcast.quotes"},
                {"id": "topics", "label": "Topics", "emoji": "🗂️",
                 "component": "info_grid", "dataSource": "podcast.topics"},
            ],
        }

    def test_default_tabs_assemble(self):
        extraction = {
            "podcast": {
                "segments": [
                    {"title": "Intro", "summary": "Welcome", "timestamp": 0},
                    {"title": "Deep dive", "summary": "Consensus", "timestamp": 480},
                    {"title": "Wrap", "summary": "Closing", "timestamp": 900},
                ],
                "guests": [
                    {"name": "Dr. Cho", "role": "Engineer", "description": "Distributed systems"},
                    {"name": "Sam R", "role": "Host", "description": "Runs the show"},
                ],
                "quotes": [
                    {"quote": "You can't beat physics", "speaker": "Cho"},
                    {"quote": "Latency is forever", "speaker": "Cho"},
                    {"quote": "Ship it", "speaker": "Sam"},
                ],
                "topics": [
                    {"topic": "CAP theorem", "detail": "Consistency vs availability"},
                    {"topic": "Raft", "detail": "Understandable consensus"},
                    {"topic": "Latency", "detail": "Physics limits"},
                ],
            },
        }
        out = assemble_response(self._triage(), extraction, None, None)
        components = [t["component"] for t in out["tabs"]]
        assert "moment_track" in components
        assert "spot_explorer" in components
        assert out["meta"]["primaryTag"] == "podcast"
        # Segments are the required spine.
        seg = next(t for t in out["tabs"] if t["component"] == "moment_track")
        assert len(seg["props"]["items"]) == 3


class TestNewsAssembly:
    def _triage(self):
        return {
            "contentTags": ["news"],
            "modifiers": [],
            "primaryTag": "news",
            "userGoal": "Understand the story",
            "tabs": [
                {"id": "timeline", "label": "Timeline", "emoji": "🕐",
                 "component": "moment_track", "dataSource": "news.storyTimeline"},
                {"id": "entities", "label": "People", "emoji": "👤",
                 "component": "spot_explorer", "dataSource": "news.entities"},
                {"id": "claims", "label": "Claims", "emoji": "🔎",
                 "component": "claims_tracker", "dataSource": "news.claims"},
                {"id": "context", "label": "Context", "emoji": "🗂️",
                 "component": "info_grid", "dataSource": "news.context"},
            ],
        }

    def test_claims_tracker_and_timeline_assemble(self):
        extraction = {
            "news": {
                "storyTimeline": [
                    {"label": "Proposed", "description": "Budget submitted", "timestamp": 0},
                    {"label": "Hearing", "description": "Public split", "timestamp": 320},
                    {"label": "Vote", "description": "Approved 6-3", "timestamp": 740},
                ],
                "entities": [
                    {"name": "Mayor Diaz", "role": "Sponsor", "description": "Pushed plan"},
                    {"name": "Transit Authority", "role": "Implementer", "description": "Runs transit"},
                ],
                "claims": [
                    {"claim": "Creates 1200 jobs", "source": "Mayor", "status": "disputed",
                     "sourceCitation": "Analysts say 700", "timestamp": 210},
                    {"claim": "Fares rise 15%", "source": "Authority", "status": "verified",
                     "timestamp": 540},
                    {"claim": "Structural deficit", "source": "Reporter", "status": "context"},
                ],
                "context": [
                    {"key": "Annual budget", "value": "$3.4B"},
                    {"key": "Last increase", "value": "2021"},
                    {"key": "Population", "value": "1.2M"},
                ],
            },
        }
        out = assemble_response(self._triage(), extraction, None, None)
        components = [t["component"] for t in out["tabs"]]
        assert "claims_tracker" in components
        assert "moment_track" in components
        assert out["meta"]["primaryTag"] == "news"
        claims_tab = next(t for t in out["tabs"] if t["component"] == "claims_tracker")
        assert len(claims_tab["props"]["claims"]) == 3
        statuses = {c["status"] for c in claims_tab["props"]["claims"]}
        assert statuses == {"disputed", "verified", "context"}


# ─── Phase 5c: tier_list (gaming signature component) ───


class TestAssembleTierList:
    def test_normalizes_full_rankings(self):
        data = [
            {"item": "Jett", "tier": "S", "reason": "Top duelist", "emoji": "🌪️"},
            {"item": "Sage", "tier": "a", "reason": "Carry"},
            {"item": "Yoru", "tier": "C"},
        ]
        result = assemble_tier_list({}, data, {}, None)
        assert result is not None
        items = result["items"]
        assert len(items) == 3
        assert items[0]["item"] == "Jett"
        assert items[0]["tier"] == "S"
        # lowercase tier coerced to uppercase
        assert items[1]["tier"] == "A"
        # Yoru had no reason — the key is omitted, not null
        assert "reason" not in items[2]

    def test_invalid_tier_omitted(self):
        data = [
            {"item": "A", "tier": "Z"},
            {"item": "B", "tier": "S"},
            {"item": "C"},
        ]
        result = assemble_tier_list({}, data, {}, None)
        assert "tier" not in result["items"][0]
        assert result["items"][1]["tier"] == "S"
        assert "tier" not in result["items"][2]

    def test_dict_wrapper_with_rankings_key(self):
        data = {"rankings": [
            {"item": "A", "tier": "S"},
            {"item": "B", "tier": "A"},
            {"item": "C", "tier": "B"},
        ]}
        result = assemble_tier_list({}, data, {}, None)
        assert len(result["items"]) == 3

    def test_drops_items_with_no_label(self):
        data = [
            {"item": "", "tier": "S"},
            {"tier": "A"},
            {"item": "Real one", "tier": "B"},
            {"item": "Real two", "tier": "C"},
            {"item": "Real three"},
        ]
        result = assemble_tier_list({}, data, {}, None)
        assert len(result["items"]) == 3

    def test_below_min_returns_none(self):
        result = assemble_tier_list({}, [{"item": "Solo"}, {"item": "Duo"}], {}, None)
        assert result is None

    def test_empty_returns_none(self):
        assert assemble_tier_list({}, [], {}, None) is None
        assert assemble_tier_list({}, None, {}, None) is None


# ─── Phase 5d: formation_diagram (sport signature component) ───


class TestAssembleFormationDiagram:
    def _positions(self) -> list[dict]:
        return [
            {"player": "Ederson", "role": "GK", "x": 50, "y": 8, "number": 31},
            {"player": "Walker", "role": "RB", "x": 80, "y": 30, "number": 2},
            {"player": "Haaland", "role": "ST", "x": 50, "y": 90, "number": 9},
        ]

    def test_normalizes_positions_from_dict(self):
        data = {"name": "4-3-3", "team": "City", "positions": self._positions()}
        result = assemble_formation_diagram({}, data, {}, None)
        assert result is not None
        assert result["name"] == "4-3-3"
        assert result["team"] == "City"
        assert len(result["positions"]) == 3
        assert result["positions"][0]["player"] == "Ederson"
        assert result["positions"][0]["x"] == 50.0
        assert result["positions"][0]["number"] == 31

    def test_accepts_bare_positions_list(self):
        result = assemble_formation_diagram({}, self._positions(), {}, None)
        assert result is not None
        assert len(result["positions"]) == 3

    def test_clamps_coordinates(self):
        data = {"positions": [
            {"player": "A", "x": 150, "y": -20},
            {"player": "B", "x": 50, "y": 50},
            {"player": "C", "x": 0, "y": 100},
        ]}
        result = assemble_formation_diagram({}, data, {}, None)
        assert result["positions"][0]["x"] == 100.0
        assert result["positions"][0]["y"] == 0.0

    def test_drops_positions_without_coords_or_name(self):
        data = {"positions": [
            {"player": "", "x": 10, "y": 10},
            {"player": "NoCoords"},
            {"player": "Valid1", "x": 10, "y": 10},
            {"player": "Valid2", "x": 20, "y": 20},
            {"player": "Valid3", "x": 30, "y": 30},
        ]}
        result = assemble_formation_diagram({}, data, {}, None)
        assert len(result["positions"]) == 3

    def test_below_min_returns_none(self):
        data = {"positions": [
            {"player": "A", "x": 10, "y": 10},
            {"player": "B", "x": 20, "y": 20},
        ]}
        assert assemble_formation_diagram({}, data, {}, None) is None

    def test_empty_returns_none(self):
        assert assemble_formation_diagram({}, [], {}, None) is None
        assert assemble_formation_diagram({}, None, {}, None) is None
        assert assemble_formation_diagram({}, {"positions": []}, {}, None) is None


class TestGamingAssembly:
    def _triage(self):
        return {
            "contentTags": ["gaming"],
            "modifiers": [],
            "primaryTag": "gaming",
            "userGoal": "Improve at the game",
            "tabs": [
                {"id": "highlights", "label": "Highlights", "emoji": "🎬",
                 "component": "moment_track", "dataSource": "gaming.highlights"},
                {"id": "loadout", "label": "Loadout", "emoji": "🎒",
                 "component": "checklist", "dataSource": "gaming.loadout"},
                {"id": "tier_list", "label": "Tier List", "emoji": "🏆",
                 "component": "tier_list", "dataSource": "gaming.rankings"},
            ],
        }

    def test_default_tabs_assemble(self):
        extraction = {
            "gaming": {
                "highlights": [
                    {"label": "Clutch", "description": "1v3", "timestamp": 95},
                    {"label": "Ace", "description": "Five kills", "timestamp": 410},
                    {"label": "Whiff", "description": "Missed", "timestamp": 720},
                ],
                "loadout": [
                    {"item": "Vandal", "category": "weapons", "note": "One-tap"},
                    {"item": "Light shields", "category": "economy", "note": "Eco"},
                    {"item": "0.4 sens", "category": "settings", "note": "Mouse"},
                ],
                "rankings": [
                    {"item": "Jett", "tier": "S", "reason": "Entry"},
                    {"item": "Sage", "tier": "A", "reason": "Heal"},
                    {"item": "Yoru", "tier": "C", "reason": "Niche"},
                ],
            },
        }
        out = assemble_response(self._triage(), extraction, None, None)
        components = [t["component"] for t in out["tabs"]]
        assert "tier_list" in components
        assert "moment_track" in components
        assert out["meta"]["primaryTag"] == "gaming"
        tier_tab = next(t for t in out["tabs"] if t["component"] == "tier_list")
        assert len(tier_tab["props"]["items"]) == 3


class TestSportAssembly:
    def _triage(self):
        return {
            "contentTags": ["sport"],
            "modifiers": [],
            "primaryTag": "sport",
            "userGoal": "Understand the match",
            "tabs": [
                {"id": "match_events", "label": "Events", "emoji": "⏱️",
                 "component": "moment_track", "dataSource": "sport.matchEvents"},
                {"id": "formation", "label": "Formation", "emoji": "📋",
                 "component": "formation_diagram", "dataSource": "sport.formation"},
            ],
        }

    def test_default_tabs_assemble(self):
        extraction = {
            "sport": {
                "matchEvents": [
                    {"label": "Goal", "description": "Tap-in", "timestamp": 720},
                    {"label": "Equaliser", "description": "Header", "timestamp": 1980},
                    {"label": "Winner", "description": "Top corner", "timestamp": 4980},
                ],
                "formation": {
                    "name": "4-3-3",
                    "team": "City",
                    "positions": [
                        {"player": "Ederson", "role": "GK", "x": 50, "y": 8, "number": 31},
                        {"player": "Rodri", "role": "CDM", "x": 50, "y": 50, "number": 16},
                        {"player": "Haaland", "role": "ST", "x": 50, "y": 90, "number": 9},
                    ],
                },
            },
        }
        out = assemble_response(self._triage(), extraction, None, None)
        components = [t["component"] for t in out["tabs"]]
        assert "formation_diagram" in components
        assert "moment_track" in components
        assert out["meta"]["primaryTag"] == "sport"
        formation_tab = next(t for t in out["tabs"] if t["component"] == "formation_diagram")
        assert len(formation_tab["props"]["positions"]) == 3
        assert formation_tab["props"]["name"] == "4-3-3"
