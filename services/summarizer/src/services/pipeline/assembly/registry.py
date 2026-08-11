"""Assembler registry + component inference.

Maps component names to their assembler functions and tab ids to their
default components.
"""

from __future__ import annotations

from typing import Callable

from .assemblers_primary import (
    assemble_checklist,
    assemble_comparison,
    assemble_info_grid,
    assemble_moment_track,
    assemble_spot_explorer,
    assemble_step_player,
)
from .assemblers_learning import (
    assemble_budget,
    assemble_display_section,
    assemble_flash_deck,
    assemble_overview,
)
from .assemblers_overhaul import (
    assemble_code_playground,
    assemble_comparison_radar,
    assemble_concept_canvas,
    assemble_connect_canvas,
    assemble_lyrics_karaoke,
    assemble_packing_mission,
    assemble_quiz_arena,
    assemble_step_flow_canvas,
    assemble_video_filmstrip,
    assemble_workout_room,
)
from .assemblers_secondary import (
    assemble_claims_tracker,
    assemble_diagram_card,
    assemble_formation_diagram,
    assemble_frame_strip,
    assemble_quick_quiz,
    assemble_stat_banner,
    assemble_summary_header,
    assemble_tier_list,
    assemble_tip_callout,
)

# ─────────────────────────────────────────────────────
# Assembler Registry & Component Inference
# ─────────────────────────────────────────────────────

ASSEMBLER_REGISTRY: dict[str, Callable] = {
    # The full set of components the planner is allowed to emit. Kept tight —
    # legacy names removed; cached `assembledTabs` rows that reference retired
    # keys fall through to display_section by design. The pipeline produces
    # new-name output only; we don't translate behind the scenes.
    "spot_explorer": assemble_spot_explorer,
    "moment_track": assemble_moment_track,
    "comparison": assemble_comparison,
    "info_grid": assemble_info_grid,
    "checklist": assemble_checklist,
    "step_player": assemble_step_player,
    "flash_deck": assemble_flash_deck,
    "budget": assemble_budget,
    "overview": assemble_overview,
    "display_section": assemble_display_section,
    "concept_canvas": assemble_concept_canvas,
    "connect_canvas": assemble_connect_canvas,
    "step_flow_canvas": assemble_step_flow_canvas,
    "comparison_radar": assemble_comparison_radar,
    "code_playground": assemble_code_playground,
    "quiz_arena": assemble_quiz_arena,
    "packing_mission": assemble_packing_mission,
    "workout_room": assemble_workout_room,
    "lyrics_karaoke": assemble_lyrics_karaoke,
    "video_filmstrip": assemble_video_filmstrip,
    # interactive-overhaul-v2 P5b — news signature component
    "claims_tracker": assemble_claims_tracker,
    # interactive-overhaul-v2 P5c/d — gaming + sport signature components
    "tier_list": assemble_tier_list,
    "formation_diagram": assemble_formation_diagram,
    # Secondary-tier (attachment-only) — interactive-overhaul-v2 P2
    "stat_banner": assemble_stat_banner,
    "tip_callout": assemble_tip_callout,
    "summary_header": assemble_summary_header,
    "diagram_card": assemble_diagram_card,
    "frame_strip": assemble_frame_strip,
    "quick_quiz": assemble_quick_quiz,
}

_TAB_ID_TO_COMPONENT: dict[str, str] = {
    "itinerary": "spot_explorer",
    "spots": "spot_explorer",
    "key_moments": "moment_track",
    "timestamps": "moment_track",
    "highlights": "moment_track",
    "code": "code_playground",
    "code_snippets": "code_playground",
    "snippets": "code_playground",
    "cheat_sheet": "code_playground",
    "setup": "code_playground",
    "patterns": "code_playground",
    "pros_cons": "comparison",
    "specs": "info_grid",
    "credits": "info_grid",
    "ingredients": "checklist",
    "packing": "packing_mission",
    "packing_list": "packing_mission",
    "materials": "checklist",
    "tools": "checklist",
    "steps": "step_player",
    "exercises": "workout_room",
    "workout": "workout_room",
    "workout_tracker": "workout_room",
    "timer": "workout_room",
    "quiz": "quiz_arena",
    "quizzes": "quiz_arena",
    "flashcards": "flash_deck",
    "concepts": "concept_canvas",
    "scenario": "quiz_arena",
    "scenarios": "quiz_arena",
    "gallery": "video_filmstrip",
    "filmstrip": "video_filmstrip",
    "lyrics": "lyrics_karaoke",
    "structure": "lyrics_karaoke",
    "verdict": "comparison",  # verdict folds into ComparisonInteractive's ReviewSummary
    "budget": "budget",
    "overview": "overview",
    # podcast / news (interactive-overhaul-v2 P5)
    "segments": "moment_track",
    "guests": "spot_explorer",
    "quotes": "flash_deck",
    "topics": "info_grid",
    "entities": "spot_explorer",
    "claims": "claims_tracker",
    "context": "info_grid",
    # gaming / sport (interactive-overhaul-v2 P5c/d)
    # ("highlights" already maps to moment_track above)
    "loadout": "checklist",
    "walkthrough": "step_flow_canvas",
    "tier_list": "tier_list",
    "rankings": "tier_list",
    "match_events": "moment_track",
    "formation": "formation_diagram",
    "stats": "comparison",
}


def infer_component(tab_id: str) -> str:
    """Infer component from tab ID when triage doesn't specify one."""
    return _TAB_ID_TO_COMPONENT.get(tab_id, "display_section")
