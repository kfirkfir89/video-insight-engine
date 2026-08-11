"""Tests for assembly/core.py registries (project-score-9 6.1 dead-code sweep)."""

from src.services.pipeline.assembly.registry import ASSEMBLER_REGISTRY
from src.services.pipeline.assembly.core import _COMPONENT_REQUIRED_LISTS

# Retired v1 component names. ASSEMBLER_REGISTRY already dropped them (cached
# rows referencing them fall through to display_section by design), so no
# core.py registry may keep them alive.
_LEGACY_COMPONENT_NAMES = {
    "code_explorer",
    "exercise_tracker",
    "quiz",
    "scenario",
    "lyrics_player",
    "gallery",
}


class TestComponentRequiredLists:
    """_COMPONENT_REQUIRED_LISTS holds only live (v2 registry) components."""

    def test_no_legacy_component_names(self):
        leftover = _LEGACY_COMPONENT_NAMES & set(_COMPONENT_REQUIRED_LISTS)
        assert not leftover, f"legacy components still registered: {sorted(leftover)}"

    def test_all_keys_have_live_assemblers(self):
        """Every required-list key must map to a component the assembler can
        actually produce — anything else is unreachable dead config."""
        unknown = set(_COMPONENT_REQUIRED_LISTS) - set(ASSEMBLER_REGISTRY)
        assert not unknown, f"required-lists keys without assemblers: {sorted(unknown)}"
