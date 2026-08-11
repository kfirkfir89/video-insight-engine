"""Assembly fallback-layer tests — moment-track fallback, gallery tab assembly, in-domain sibling fallback."""

from src.services.pipeline.assembly import (
    _validate_domain_requirements,
    assemble_response,
    _chapters_to_moments,
)


# ─── resolve_data_source ───


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
            (src, tgt)
            for src, tgt, _domain in _COMPONENT_LINK_RULES
            if src == "clip_player" or tgt == "clip_player"
        ]
        assert clip_player_rules == []


# ─── Gallery Tab Assembly ───


class TestGalleryTabAssembly:
    def test_gallery_tab_created_when_curated_frames(self):
        """Filmstrip tab only appears when >8 frames AND >50% non-generic captions."""
        triage = {
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "tabs": [
                {
                    "id": "overview",
                    "label": "Overview",
                    "component": "overview",
                    "dataSource": "learning",
                }
            ],
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
            "tabs": [
                {
                    "id": "overview",
                    "label": "Overview",
                    "component": "overview",
                    "dataSource": "learning",
                }
            ],
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
            {
                "timestamp": float(i * 10 + 100),
                "s3_url": f"url{i + 3}",
                "index": i + 3,
                "ocr_text": f"Slide {i + 3}",
            }
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
        frames = [
            {"timestamp": float(i * 10), "s3_url": f"url{i}", "index": i, "ocr_text": f"Slide {i}"}
            for i in range(15)
        ]
        result = assemble_response(triage, extraction, None, None, frames=frames)
        gallery_tab = [t for t in result["tabs"] if t["id"] == "frames-gallery"][0]
        assert gallery_tab["component"] == "video_filmstrip"
        assert len(gallery_tab["props"]["frames"]) == 15


# ─── in-domain sibling fallback + required-component backfill ───


def _snip(code: str) -> dict:
    return {"filename": f"{code}.py", "language": "python", "code": code, "explanation": "demo"}


class TestInDomainSiblingFallback:
    """Planner bets a tab on a field extraction left empty — assembly should
    recover from a populated sibling field of the same domain/component rather
    than silently dropping the tab (and losing the domain-required component)."""

    @staticmethod
    def _tech_triage(tabs):
        return {
            "contentTags": ["tech"],
            "modifiers": [],
            "primaryTag": "tech",
            "userGoal": "Learn the code",
            "tabs": tabs,
        }

    def test_empty_field_remaps_to_populated_sibling(self):
        triage = self._tech_triage(
            [
                {
                    "id": "old_vs_new",
                    "label": "Old vs New",
                    "emoji": "🧩",
                    "dataSource": "tech.patterns",
                    "component": "code_playground",
                    "goal": "Compare the approaches",
                },
            ]
        )
        extraction = {"tech": {"snippets": [_snip("a = 1"), _snip("b = 2")], "patterns": []}}
        result = assemble_response(triage, extraction, None, None)

        tab = next((t for t in result["tabs"] if t["id"] == "old_vs_new"), None)
        assert tab is not None, "tab should survive via sibling fallback, not be dropped"
        assert tab["component"] == "code_playground"
        assert len(tab["props"]["snippets"]) == 2  # came from tech.snippets

    def test_missing_required_component_backfilled(self):
        # No tab targets tech.snippets, and the planned tab's field is empty →
        # code_playground would be missing; backfill should restore it.
        triage = self._tech_triage(
            [
                {
                    "id": "key_claims",
                    "label": "Key Claims",
                    "emoji": "📌",
                    "dataSource": "tech.topics",
                    "component": "info_grid",
                    "goal": "The claims",
                },
            ]
        )
        extraction = {"tech": {"snippets": [_snip("x = 1"), _snip("y = 2")], "topics": []}}
        result = assemble_response(triage, extraction, None, None)

        components = [t["component"] for t in result["tabs"]]
        assert "code_playground" in components, "required tech component should be backfilled"

    def test_validate_domain_requirements_backfills_in_place(self):
        tabs = [
            {
                "id": "overview",
                "label": "Overview",
                "emoji": "📄",
                "component": "overview",
                "props": {"summary": "hi"},
                "goal": "g",
            }
        ]
        extraction = {"tech": {"snippets": [_snip("z = 3")]}}
        _validate_domain_requirements(tabs, "tech", extraction=extraction)

        assert any(t["component"] == "code_playground" for t in tabs)

    def test_no_data_anywhere_drops_gracefully(self, caplog):
        triage = self._tech_triage(
            [
                {
                    "id": "old_vs_new",
                    "label": "Old vs New",
                    "emoji": "🧩",
                    "dataSource": "tech.patterns",
                    "component": "code_playground",
                    "goal": "g",
                },
            ]
        )
        extraction = {"tech": {"snippets": [], "patterns": []}}
        synthesis = {"masterSummary": "A talk", "keyTakeaways": ["t1", "t2", "t3"]}
        video_meta = {
            "chapters": [
                {"title": "Intro", "start_time": 0, "end_time": 60},
                {"title": "Main", "start_time": 60, "end_time": 300},
            ]
        }
        with caplog.at_level("WARNING"):
            result = assemble_response(triage, extraction, None, synthesis, video_meta=video_meta)

        assert not any(t["component"] == "code_playground" for t in result["tabs"])
        assert "requires 'code_playground'" in caplog.text
        assert len(result["tabs"]) >= 3  # min-3 guarantee still holds

    def test_in_domain_resolves_before_cross_domain_in_multidomain(self):
        triage = self._tech_triage(
            [
                {
                    "id": "patterns_tab",
                    "label": "Patterns",
                    "emoji": "🧩",
                    "dataSource": "tech.patterns",
                    "component": "code_playground",
                    "goal": "g",
                },
            ]
        )
        extraction = {
            "learning": {"keyPoints": [{"title": "P1", "detail": "d"}]},
            "tech": {"snippets": [_snip("only_tech = True")], "patterns": []},
        }
        result = assemble_response(triage, extraction, None, None)

        tab = next(t for t in result["tabs"] if t["id"] == "patterns_tab")
        assert tab["props"]["snippets"][0]["code"] == "only_tech = True"

    def test_populated_primary_is_not_remapped(self):
        # Regression guard: when the planned field has data, no sibling swap.
        triage = self._tech_triage(
            [
                {
                    "id": "patterns_tab",
                    "label": "Patterns",
                    "emoji": "🧩",
                    "dataSource": "tech.patterns",
                    "component": "code_playground",
                    "goal": "g",
                },
            ]
        )
        extraction = {
            "tech": {
                "patterns": [_snip("PLANNED_1"), _snip("PLANNED_2")],
                "snippets": [_snip("SIBLING_1"), _snip("SIBLING_2")],
            }
        }
        result = assemble_response(triage, extraction, None, None)

        tab = next(t for t in result["tabs"] if t["id"] == "patterns_tab")
        codes = {s["code"] for s in tab["props"]["snippets"]}
        assert codes == {"PLANNED_1", "PLANNED_2"}
