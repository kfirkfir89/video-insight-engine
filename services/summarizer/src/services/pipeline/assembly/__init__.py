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
    assemble_timeline,
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
    assemble_clip_player,
    assemble_lyrics_player,
    # Normalizers (used by tests)
    _normalize_code_snippet,
    _normalize_timeline_entry,
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
    _post_process_tabs,
    _validate_domain_requirements,
    _validate_assembled_props,
    _DOMAIN_REQUIREMENTS,
    _COMPONENT_REQUIRED_LISTS,
)
from .cross_tab import resolve_cross_tab_links

__all__ = [
    "ASSEMBLER_REGISTRY",
    "assemble_response",
    "infer_component",
    "resolve_data_source",
    "resolve_cross_tab_links",
    "find_nearest_frame",
    "inject_frame_thumbnails",
    "find_description_for_frame",
    "_post_process_tabs",
    "_validate_domain_requirements",
    "_validate_assembled_props",
    "_DOMAIN_REQUIREMENTS",
    "_COMPONENT_REQUIRED_LISTS",
    # Normalizers (used by tests)
    "_normalize_code_snippet",
    "_normalize_timeline_entry",
    "_normalize_exercise",
    "_normalize_quiz_question",
    "_normalize_scenario_item",
    # Individual assemblers (used by tests)
    "assemble_display_section",
    "assemble_spot_explorer",
    "assemble_timeline",
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
    "assemble_clip_player",
    "assemble_lyrics_player",
]
