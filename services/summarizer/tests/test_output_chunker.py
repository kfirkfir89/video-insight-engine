"""Tests for output_chunker — per-component chunking of assembled tabs."""

from __future__ import annotations

from src.services.pipeline.assembly.assemblers import ASSEMBLER_REGISTRY
from src.services.vector.output_chunker import (
    _COMPONENT_HANDLERS,
    OutputChunk,
    chunk_assembled_tabs,
)


def _tab(component: str, props: dict, tab_id: str | None = None) -> dict:
    return {
        "id": tab_id or f"{component}_tab",
        "label": component.replace("_", " ").title(),
        "emoji": "",
        "component": component,
        "props": props,
    }


def _by_path(chunks: list[OutputChunk], path: str) -> OutputChunk | None:
    return next((c for c in chunks if c.prop_path == path), None)


# ────────────────────────────────────────────────────────────
# Per-component tests (one for each of the 18 supported types)
# ────────────────────────────────────────────────────────────


class TestOverview:
    def test_should_emit_master_summary_takeaways_and_tldr(self):
        tab = _tab(
            "overview",
            {
                "masterSummary": "This video walks through React fundamentals across an hour.",
                "tldr": "Hooks make state and effects composable across components.",
                "keyTakeaways": [
                    "Use hooks to manage local state cleanly inside components.",
                    "Effects run after render; cleanup runs before unmount.",
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        paths = [c.prop_path for c in chunks]
        assert "masterSummary" in paths
        assert "tldr" in paths
        assert "keyTakeaways[0]" in paths
        assert "keyTakeaways[1]" in paths


class TestSpotExplorer:
    def test_should_emit_one_chunk_per_spot_with_name_description_tips(self):
        tab = _tab(
            "spot_explorer",
            {
                "spots": [
                    {
                        "name": "Park Güell",
                        "description": "A famous Gaudí park overlooking Barcelona's skyline.",
                        "tips": ["Buy tickets in advance", "Visit at sunset"],
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        c = _by_path(chunks, "spots[0]")
        assert c is not None
        assert "Park Güell" in c.text
        assert "Gaudí" in c.text
        assert "Tips:" in c.text


class TestTimeline:
    def test_should_emit_at_timestamp_label_format(self):
        tab = _tab(
            "timeline",
            {
                "entries": [
                    {"timestamp": "1:23", "label": "The presenter introduces the API briefly."},
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert chunks[0].text.startswith("At 1:23: ")
        assert chunks[0].prop_path == "entries[0]"


class TestMomentTrack:
    def test_should_emit_label_plus_description_prose_only(self):
        tab = _tab(
            "moment_track",
            {
                "items": [
                    {
                        "label": "Hands-on demo of the rebase workflow",
                        "description": "Walks through resolving a conflict during an interactive rebase.",
                        "seconds": 312,
                        "endSeconds": 405,
                        "time": "5:12",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        c = chunks[0]
        assert c.prop_path == "items[0]"
        assert "Hands-on demo" in c.text
        assert "rebase" in c.text
        # Numeric seconds / clock strings must not be embedded.
        assert "312" not in c.text
        assert "405" not in c.text
        assert "5:12" not in c.text

    def test_should_emit_only_label_when_description_absent(self):
        tab = _tab(
            "moment_track",
            {"items": [{"label": "Tour of the application's settings panel"}]},
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert chunks[0].text == "Tour of the application's settings panel"

    def test_should_emit_only_description_when_label_absent(self):
        tab = _tab(
            "moment_track",
            {"items": [{"description": "Walks through resolving a conflict during an interactive rebase."}]},
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert chunks[0].text == "Walks through resolving a conflict during an interactive rebase."

    def test_should_skip_items_with_neither_label_nor_description(self):
        tab = _tab(
            "moment_track",
            {"items": [{"seconds": 10}, {"label": "", "description": ""}]},
        )
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []

    def test_should_drop_when_combined_text_under_minimum_words(self):
        tab = _tab(
            "moment_track",
            {"items": [{"label": "Intro", "description": "Short."}]},  # 2 words
        )
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []


class TestCodeExplorer:
    def test_should_emit_only_explanation_text_not_code(self):
        tab = _tab(
            "code_explorer",
            {
                "snippets": [
                    {
                        "code": "const x = 1;",
                        "language": "javascript",
                        "explanation": "Declares an immutable binding for the integer one.",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert "const x = 1" not in chunks[0].text
        assert "immutable binding" in chunks[0].text


class TestComparison:
    def test_should_emit_pros_cons_and_row_strings(self):
        tab = _tab(
            "comparison",
            {
                "pros": ["Better battery life across full workdays."],
                "cons": ["Heavier than the prior generation by a noticeable margin."],
                "comparisons": [
                    {
                        "feature": "Battery life",
                        "thisProduct": "18 hours",
                        "competitor": "12 hours",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        paths = {c.prop_path for c in chunks}
        assert "pros[0]" in paths
        assert "cons[0]" in paths
        assert "comparisons[0]" in paths
        row = _by_path(chunks, "comparisons[0]")
        assert row is not None
        assert "Battery life" in row.text


class TestInfoGrid:
    def test_should_emit_key_value_strings(self):
        tab = _tab(
            "info_grid",
            {
                "items": [
                    {"key": "Resting heart rate", "value": "60 bpm steady on average"},
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert chunks[0].text.startswith("Resting heart rate:")


class TestChecklist:
    def test_should_concat_label_and_note_when_both_present(self):
        tab = _tab(
            "checklist",
            {
                "items": [
                    {"label": "Bring sunscreen", "note": "Reapply every two hours during hikes."},
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert chunks[0].text.startswith("Bring sunscreen.")
        assert "Reapply" in chunks[0].text


class TestStepPlayer:
    def test_should_emit_instruction_with_optional_tips(self):
        tab = _tab(
            "step_player",
            {
                "steps": [
                    {
                        "instruction": "Slowly whisk the eggs into the dry mixture.",
                        "tips": ["Use a balloon whisk for best aeration"],
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert "whisk the eggs" in chunks[0].text
        assert "Tips:" in chunks[0].text


class TestExerciseTracker:
    def test_should_emit_name_and_form_cues(self):
        tab = _tab(
            "exercise_tracker",
            {
                "exercises": [
                    {
                        "name": "Romanian Deadlift",
                        "sets": 3,
                        "reps": 10,
                        "formCues": ["Hinge at hips", "Keep neutral spine"],
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert "Romanian Deadlift" in chunks[0].text
        assert "Hinge at hips" in chunks[0].text
        # Sets/reps numbers should NOT be embedded.
        assert "3" not in chunks[0].text
        assert "10" not in chunks[0].text


class TestQuiz:
    def test_should_emit_question_correct_answer_and_explanation(self):
        tab = _tab(
            "quiz",
            {
                "questions": [
                    {
                        "question": "Which hook manages local component state in React?",
                        "options": ["useEffect", "useState", "useMemo", "useRef"],
                        "correctIndex": 1,
                        "explanation": "useState returns a state value and a setter pair.",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        text = chunks[0].text
        assert "Q:" in text
        assert "useState" in text
        assert "setter pair" in text
        # The wrong options should not appear in the chunk.
        assert "useEffect" not in text
        assert "useMemo" not in text


class TestFlashDeck:
    def test_should_concat_front_and_back_with_dash(self):
        tab = _tab(
            "flash_deck",
            {
                "cards": [
                    {
                        "front": "What does TCP stand for?",
                        "back": "Transmission Control Protocol — reliable, ordered byte streams.",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert "—" in chunks[0].text
        assert "Transmission Control" in chunks[0].text


class TestScenario:
    def test_should_emit_question_and_correct_explanation(self):
        tab = _tab(
            "scenario",
            {
                "scenarios": [
                    {
                        "question": "A user reports the app is suddenly slow. What is the first thing to check?",
                        "options": [
                            {"text": "Restart everything immediately", "correct": False},
                            {
                                "text": "Check production metrics for traffic spikes",
                                "explanation": "Metrics show whether load is the cause before changing code.",
                                "correct": True,
                            },
                        ],
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert "Check production metrics" in chunks[0].text
        assert "Metrics show" in chunks[0].text


class TestVerdict:
    def test_should_emit_bottom_line_and_audience_lists(self):
        tab = _tab(
            "verdict",
            {
                "bottomLine": "A solid pick for everyday photographers on a tight budget.",
                "bestFor": ["Beginners learning manual exposure controls slowly"],
                "notFor": ["Professionals who shoot in low light frequently in winter"],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        paths = {c.prop_path for c in chunks}
        assert "bottomLine" in paths
        assert "bestFor[0]" in paths
        assert "notFor[0]" in paths


class TestBudget:
    def test_should_emit_only_saving_tips_not_amounts(self):
        tab = _tab(
            "budget",
            {
                "total": 1500,
                "currency": "USD",
                "savingTips": [
                    "Book accommodation midweek for materially lower nightly rates.",
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert "midweek" in chunks[0].text
        assert "1500" not in chunks[0].text


class TestGallery:
    def test_should_emit_caption_when_present(self):
        tab = _tab(
            "gallery",
            {
                "images": [
                    {"url": "https://example/1.jpg", "caption": "Sunset over the canyon at golden hour today."},
                    {"url": "https://example/2.jpg"},  # no caption
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert chunks[0].prop_path == "images[0].caption"
        assert "https" not in chunks[0].text


class TestClipPlayer:
    def test_should_emit_label_and_description(self):
        tab = _tab(
            "clip_player",
            {
                "clips": [
                    {
                        "label": "The opening segment",
                        "description": "Speaker introduces the topic and outlines the agenda.",
                        "startSeconds": 0,
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert "opening segment" in chunks[0].text
        assert "agenda" in chunks[0].text


class TestLyricsPlayer:
    def test_should_emit_only_section_analysis(self):
        tab = _tab(
            "lyrics_player",
            {
                "sections": [
                    {
                        "lyrics": "raw lyrics here that should not be embedded",
                        "analysis": "This bridge marks the emotional turning point of the song.",
                    },
                ],
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert "emotional turning point" in chunks[0].text
        assert "raw lyrics" not in chunks[0].text


class TestDisplaySection:
    def test_should_extract_only_whitelisted_keys(self):
        tab = _tab(
            "display_section",
            {
                "data": {
                    "id": "abc",
                    "url": "https://example",
                    "buttonLabel": "Click me",
                    "summary": "A concise explanation that crosses the six-word threshold safely.",
                    "tip": "Drink plenty of water during a long workout session.",
                },
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert "concise explanation" in chunks[0].text
        assert "Drink plenty of water" in chunks[0].text
        assert "abc" not in chunks[0].text
        assert "https" not in chunks[0].text
        assert "Click me" not in chunks[0].text

    def test_should_recurse_into_nested_objects(self):
        tab = _tab(
            "display_section",
            {
                "data": {
                    "outer": {
                        "id": "skip",
                        "description": "Nested description should still surface when long enough.",
                    },
                },
            },
        )
        chunks = chunk_assembled_tabs([tab])
        assert len(chunks) == 1
        assert "Nested description should still surface" in chunks[0].text

    def test_should_drop_when_only_short_whitelisted_values_present(self):
        tab = _tab(
            "display_section",
            {"data": {"text": "too short"}},  # 2 words
        )
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []

    def test_should_skip_data_with_no_whitelisted_keys(self):
        tab = _tab(
            "display_section",
            {"data": {"id": "abc", "url": "https://x", "amount": 42}},
        )
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []


# ────────────────────────────────────────────────────────────
# Cross-cutting rules
# ────────────────────────────────────────────────────────────


class TestMinimumWordCount:
    def test_should_drop_chunks_under_six_words(self):
        tab = _tab(
            "overview",
            {
                "masterSummary": "Too short.",  # 2 words
                "keyTakeaways": ["Five words is exactly five words"],  # 6 words → keep
            },
        )
        chunks = chunk_assembled_tabs([tab])
        # The 2-word master summary should be dropped.
        paths = [c.prop_path for c in chunks]
        assert "masterSummary" not in paths
        assert "keyTakeaways[0]" in paths


class TestUnknownComponent:
    def test_should_emit_zero_chunks_for_unknown_component(self):
        tab = _tab("nonexistent_component_xyz", {"items": [{"text": "Whatever lives here is irrelevant entirely."}]})
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []

    def test_should_emit_zero_chunks_when_component_missing(self):
        tab = {"id": "x", "label": "X", "props": {}}  # no component key
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []


class TestMultipleTabs:
    def test_should_aggregate_chunks_across_tabs(self):
        tabs = [
            _tab("overview", {"masterSummary": "An introductory walkthrough across all the topics covered today."}),
            _tab("checklist", {"items": [{"label": "Verify that the connection string is properly configured here"}]}),
        ]
        chunks = chunk_assembled_tabs(tabs)
        components = {c.tab_component for c in chunks}
        assert components == {"overview", "checklist"}


class TestMalformedInput:
    def test_should_skip_non_dict_tab(self):
        chunks = chunk_assembled_tabs(["not a dict", None])  # type: ignore[list-item]
        assert chunks == []

    def test_should_skip_tab_with_missing_id(self):
        tab = {"component": "overview", "props": {"masterSummary": "Long enough sentence to pass the threshold."}}
        chunks = chunk_assembled_tabs([tab])
        assert chunks == []


class TestRegistryCoverage:
    """Locks in the invariant that every assembler-emitted component has a
    chunker handler. The entire reason this task existed was that
    ``moment_track`` shipped in ASSEMBLER_REGISTRY without a matching chunker
    entry — this test makes that exact regression class fail at CI time
    instead of waiting for the next manual audit.
    """

    def test_every_assembler_component_has_a_chunker_handler(self):
        missing = set(ASSEMBLER_REGISTRY) - set(_COMPONENT_HANDLERS)
        assert missing == set(), (
            f"ASSEMBLER_REGISTRY components without chunker handlers: {missing}. "
            "Add a _h_{component} handler in "
            "services/summarizer/src/services/vector/output_chunker.py and "
            "update reports/chunker-coverage.md."
        )
