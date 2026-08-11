"""Assembly orchestration tests — data resolution, cross-tab links, assemble_response, frame utilities."""

from src.services.pipeline.assembly import (
    assemble_response,
    find_nearest_frame,
    inject_frame_thumbnails,
    resolve_cross_tab_links,
    resolve_data_source,
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
        assert any(
            l["targetTab"] == "ingredients" and "ingredient" in l["label"].lower() for l in links
        )

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


# ─── Full Assembly ───


class TestAssembleResponse:
    def _make_triage(self, **overrides):
        base = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Learn something",
            "tabs": [
                {
                    "id": "key_points",
                    "label": "Key Points",
                    "emoji": "💡",
                    "dataSource": "learning.keyPoints",
                },
                {
                    "id": "concepts",
                    "label": "Concepts",
                    "emoji": "📚",
                    "dataSource": "learning.concepts",
                },
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
                {
                    "id": "itinerary",
                    "label": "Itinerary",
                    "emoji": "📅",
                    "dataSource": "travel.itinerary",
                },
                {"id": "budget", "label": "Budget", "emoji": "💰", "dataSource": "travel.budget"},
                {
                    "id": "packing",
                    "label": "Packing",
                    "emoji": "🎒",
                    "dataSource": "travel.packingList",
                },
            ],
        }
        extraction = {
            "travel": {
                "itinerary": [
                    {
                        "day": 1,
                        "city": "Rome",
                        "spots": [
                            {"name": "Colosseum", "description": "Ancient amphitheatre"},
                            {"name": "Forum", "description": "Political heart of old Rome"},
                        ],
                    },
                ],
                "budget": {
                    "total": 2000,
                    "currency": "USD",
                    "breakdown": [{"item": "Hotels", "amount": 1200}],
                },
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
        triage = self._make_triage(
            tabs=[
                {
                    "id": "concepts",
                    "label": "Concepts",
                    "emoji": "📚",
                    "dataSource": "learning.concepts",
                },
                {"id": "quizzes", "label": "Quiz", "emoji": "❓", "dataSource": "enrichment.quiz"},
            ]
        )
        # concept_canvas requires ≥2 concepts post-overhaul
        extraction = {
            "learning": {
                "concepts": [
                    {"name": "A", "definition": "B", "connections": ["C"]},
                    {"name": "C", "definition": "D", "connections": ["A"]},
                ]
            }
        }
        enrichment = {
            "quiz": [
                {"question": "Q1", "options": ["a", "b"], "correctIndex": 0, "explanation": "E"}
            ]
        }
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
                {
                    "id": "key_points",
                    "label": "Points",
                    "emoji": "💡",
                    "dataSource": "learning.keyPoints",
                    "component": "moment_track",
                },
            ],
        }
        extraction = {"learning": {"keyPoints": [{"title": "P1"}]}}
        result = assemble_response(triage, extraction, None, None)

        assert result["tabs"][0]["component"] == "moment_track"

    def test_synthesis_merged_into_meta(self):
        triage = self._make_triage()
        extraction = {
            "learning": {
                "keyPoints": [{"title": "P1"}],
                "concepts": [{"name": "C", "definition": "D"}],
            }
        }
        synthesis = {
            "tldr": "Summary",
            "keyTakeaways": ["T1"],
            "masterSummary": "Full",
            "seoDescription": "Desc",
        }
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
                {
                    "id": "exercises",
                    "label": "Exercises",
                    "emoji": "💪",
                    "dataSource": "fitness.exercises",
                },
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


class TestFrameMetadataInjection:
    """Tests for the assembler's frame-metadata wiring (Phase 2)."""

    def test_attaches_vision_caption_to_item(self):
        from src.services.pipeline.assembly.core import inject_frame_thumbnails

        frames = [
            {"timestamp": 60.0, "s3_url": "https://s3/frame60.jpg", "s3_key": "frame60"},
        ]
        descriptions = [
            {
                "timestamp_sec": 60.0,
                "scene_type": "code",
                "content": "Python function implementing binary search",
                "text_visible": "def binary_search(arr, target):",
                "educational_value": "Shows the exact implementation discussed",
            }
        ]
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
        descriptions = [
            {
                "timestamp_sec": 30.0,
                "scene_type": "talking_head",
                "content": "Presenter looking at camera",
                "educational_value": "",
            }
        ]
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
        descriptions = [
            {
                "timestamp_sec": 30.0,
                "scene_type": "talking_head",
                "content": "Presenter holding the product up",
                "educational_value": "Shows scale of the device next to a hand",
            }
        ]
        items = [{"timestamp": 30.0, "label": "Size demo"}]
        inject_frame_thumbnails(items, frames, frame_descriptions=descriptions)

        assert items[0]["frameCaption"] == "Presenter holding the product up"
        assert "frameEvidence" in items[0]
