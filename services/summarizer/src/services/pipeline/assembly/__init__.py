"""Assembly stage — reshapes extraction data into component-addressed props.

Split into:
- assemblers.py: Individual assembler functions + registry + inference
- cross_tab.py: Cross-tab link rules + resolution
- core.py: Orchestrator, data resolution, frame utils, validation, post-processing
"""

from .assemblers import (
    ASSEMBLER_REGISTRY,
    infer_component,
    assemble_display_section,
    assemble_spot_explorer,
    assemble_moment_track,
    assemble_code_explorer,
    assemble_comparison,
    assemble_info_grid,
    assemble_checklist,
    assemble_step_player,
    assemble_exercise_tracker,
    assemble_quiz,
    assemble_flash_deck,
    assemble_scenario,
    assemble_verdict,
    assemble_budget,
    assemble_overview,
    assemble_gallery,
    assemble_lyrics_player,
    # Video-to-action overhaul assemblers
    assemble_concept_canvas,
    assemble_connect_canvas,
    assemble_step_flow_canvas,
    assemble_comparison_radar,
    assemble_code_playground,
    assemble_quiz_arena,
    assemble_packing_mission,
    assemble_workout_room,
    assemble_lyrics_karaoke,
    assemble_video_filmstrip,
    # interactive-overhaul-v2 P5b — news signature component
    assemble_claims_tracker,
    # interactive-overhaul-v2 P5c/d — gaming + sport signature components
    assemble_tier_list,
    assemble_formation_diagram,
    # Secondary-tier assemblers (interactive-overhaul-v2 P2/P3A)
    assemble_diagram_card,
    _chapters_to_moments,
    # Normalizers (used by tests)
    _normalize_code_snippet,
    _normalize_moment_item,
    _normalize_exercise,
    _normalize_quiz_question,
    _normalize_scenario_item,
)
from .core import (
    assemble_response,
    resolve_data_source,
    find_nearest_frame,
    inject_frame_thumbnails,
    find_description_for_frame,
    build_fallback_candidates,
    _post_process_tabs,
    _validate_domain_requirements,
    _validate_assembled_props,
    _DOMAIN_REQUIREMENTS,
    _COMPONENT_REQUIRED_LISTS,
)
from .cross_tab import resolve_cross_tab_links
from .density import enforce_density
from .promotion import (
    CONCEPT_CONNECTION_MIN,
    INFO_GRID_LONG_MIN,
    INFO_GRID_LONG_VALUE,
    RADAR_AXIS_THRESHOLD,
    STEP_FLOW_THRESHOLD,
    promote_component,
)

__all__ = [
    "ASSEMBLER_REGISTRY",
    "assemble_response",
    "enforce_density",
    "promote_component",
    "RADAR_AXIS_THRESHOLD",
    "CONCEPT_CONNECTION_MIN",
    "STEP_FLOW_THRESHOLD",
    "INFO_GRID_LONG_VALUE",
    "INFO_GRID_LONG_MIN",
    "infer_component",
    "resolve_data_source",
    "resolve_cross_tab_links",
    "find_nearest_frame",
    "inject_frame_thumbnails",
    "find_description_for_frame",
    "build_fallback_candidates",
    "_post_process_tabs",
    "_validate_domain_requirements",
    "_validate_assembled_props",
    "_DOMAIN_REQUIREMENTS",
    "_COMPONENT_REQUIRED_LISTS",
    # Normalizers (used by tests)
    "_normalize_code_snippet",
    "_normalize_moment_item",
    "_normalize_exercise",
    "_normalize_quiz_question",
    "_normalize_scenario_item",
    "_chapters_to_moments",
    # Individual assemblers (used by tests)
    "assemble_display_section",
    "assemble_spot_explorer",
    "assemble_moment_track",
    "assemble_code_explorer",
    "assemble_comparison",
    "assemble_info_grid",
    "assemble_checklist",
    "assemble_step_player",
    "assemble_exercise_tracker",
    "assemble_quiz",
    "assemble_flash_deck",
    "assemble_scenario",
    "assemble_verdict",
    "assemble_budget",
    "assemble_overview",
    "assemble_gallery",
    "assemble_lyrics_player",
    # Video-to-action overhaul assemblers
    "assemble_concept_canvas",
    "assemble_connect_canvas",
    "assemble_step_flow_canvas",
    "assemble_comparison_radar",
    "assemble_code_playground",
    "assemble_quiz_arena",
    "assemble_packing_mission",
    "assemble_workout_room",
    "assemble_lyrics_karaoke",
    "assemble_video_filmstrip",
    # interactive-overhaul-v2 P5b — news signature component
    "assemble_claims_tracker",
    "assemble_tier_list",
    "assemble_formation_diagram",
    # Secondary-tier assemblers (interactive-overhaul-v2 P2/P3A)
    "assemble_diagram_card",
]
