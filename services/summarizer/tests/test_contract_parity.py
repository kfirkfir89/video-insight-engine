"""Contract-parity tests (interactive-overhaul-v2 1F) — the CI safety net.

A component name must stay in sync across the whole chain: domains.json
`components`, the planner's valid-name list, `_TAB_ID_TO_COMPONENT`, the
domains' `defaultTabs`, and the assembler registry. A drift anywhere silently
collapses the tab to `display_section`. This test fails the build on any drift,
so every later phase only has to keep this green.

The frontend half of the chain (assembler names ↔ COMPONENT_REGISTRY renderers)
is enforced by the web test `composable-output-parity.test.tsx`.
"""

from __future__ import annotations

import re
from pathlib import Path

from src.services.pipeline.assembly.assemblers import (
    ASSEMBLER_REGISTRY,
    _TAB_ID_TO_COMPONENT,
)
from src.shared_config.domain_config import (
    get_config,
    primary_components,
    secondary_components,
    valid_components,
)

# display_section is the documented last-resort renderer; it is intentionally
# assemblable but is NOT a planner-selectable component.
_FALLBACK_ONLY = frozenset({"display_section"})

_PLAN_PROMPT = Path(__file__).parent.parent / "src" / "prompts" / "plan.txt"


def _plan_valid_component_names() -> list[str]:
    """Parse the backtick-wrapped names from plan.txt's VALID-names line."""
    text = _PLAN_PROMPT.read_text(encoding="utf-8")
    match = re.search(r"VALID component names.*?:\*\*(.+)", text)
    assert match, "plan.txt must declare a 'VALID component names' line"
    return re.findall(r"`([a-z_]+)`", match.group(1))


class TestContractParity:
    def test_every_valid_component_has_an_assembler(self):
        missing = set(valid_components()) - set(ASSEMBLER_REGISTRY)
        assert not missing, f"domains.json components with no assembler: {sorted(missing)}"

    def test_no_orphan_assemblers(self):
        """Every assembler maps to a known component: a primary (domains.json
        `components`), a secondary (componentTiers), or the display fallback."""
        known = set(valid_components()) | set(secondary_components()) | _FALLBACK_ONLY
        orphans = set(ASSEMBLER_REGISTRY) - known
        assert not orphans, f"assemblers for unknown components: {sorted(orphans)}"

    def test_every_secondary_component_has_an_assembler(self):
        missing = set(secondary_components()) - set(ASSEMBLER_REGISTRY)
        assert not missing, f"secondary components with no assembler: {sorted(missing)}"

    def test_tab_id_inference_targets_are_assemblable(self):
        missing = set(_TAB_ID_TO_COMPONENT.values()) - set(ASSEMBLER_REGISTRY)
        assert not missing, f"_TAB_ID_TO_COMPONENT targets with no assembler: {sorted(missing)}"

    def test_default_tab_components_are_assemblable(self):
        default_components: set[str] = set()
        for domain in get_config()["domains"].values():
            for tab in domain.get("defaultTabs", []):
                if isinstance(tab, dict) and tab.get("component"):
                    default_components.add(tab["component"])
        missing = default_components - set(ASSEMBLER_REGISTRY)
        assert not missing, f"defaultTabs components with no assembler: {sorted(missing)}"

    def test_plan_valid_names_are_assemblable(self):
        names = _plan_valid_component_names()
        missing = set(names) - set(ASSEMBLER_REGISTRY)
        assert not missing, f"plan.txt valid names with no assembler: {sorted(missing)}"

    def test_plan_valid_names_match_domains_config(self):
        """The planner's selectable set must equal domains.json `components`."""
        plan_names = set(_plan_valid_component_names())
        config_names = set(valid_components())
        assert plan_names == config_names, (
            f"plan.txt only: {sorted(plan_names - config_names)}; "
            f"config only: {sorted(config_names - plan_names)}"
        )

    # ── Tier model (interactive-overhaul-v2 P2) ───────────────────────────

    def test_primary_tier_equals_components_array(self):
        """The `primary`-tier set in componentTiers must equal the canonical
        `components` array — the planner-selectable surface stays single-sourced."""
        assert primary_components() == valid_components(), (
            f"primary-only: {sorted(primary_components() - valid_components())}; "
            f"components-only: {sorted(valid_components() - primary_components())}"
        )

    def test_primary_tier_equals_plan_valid_names(self):
        """Primary tier must equal the planner's VALID names exactly."""
        assert set(_plan_valid_component_names()) == primary_components()

    def test_secondaries_are_not_planner_selectable(self):
        """Secondary (attachment-only) components must NEVER appear in plan.txt's
        VALID names — the assembler attaches them, the planner can't pick them."""
        plan_names = set(_plan_valid_component_names())
        leaked = set(secondary_components()) & plan_names
        assert not leaked, f"secondary components leaked into plan.txt: {sorted(leaked)}"

    def test_tiers_cover_every_assembler(self):
        """Every assembler key is tiered as primary, secondary, or display."""
        tiers = get_config().get("componentTiers", {})
        untiered = set(ASSEMBLER_REGISTRY) - set(tiers)
        assert not untiered, f"assemblers with no tier in componentTiers: {sorted(untiered)}"
