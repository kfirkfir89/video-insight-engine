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
    density_gates,
    get_config,
    primary_components,
    render_density_gate_table,
    render_valid_component_names,
    secondary_components,
    valid_components,
)

# display_section is the documented last-resort renderer; it is intentionally
# assemblable but is NOT a planner-selectable component.
_FALLBACK_ONLY = frozenset({"display_section"})

_PLAN_PROMPT = Path(__file__).parent.parent / "src" / "prompts" / "plan.txt"


_TOOLKIT_PROMPT = Path(__file__).parent.parent / "src" / "prompts" / "component_toolkit.txt"


def _plan_valid_component_names() -> list[str]:
    """Parse the backtick names from the GENERATED valid-components block.

    The planner's selectable surface is now single-sourced from domains.json and
    injected into plan.txt's ``{valid_components}`` placeholder at runtime, so we
    assert against the rendered block rather than hardcoded prompt text."""
    return re.findall(r"`([a-z_]+)`", render_valid_component_names())


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

    # ── Single-source placeholders (config → generated prompt) ────────────

    def test_plan_txt_uses_valid_components_placeholder(self):
        """plan.txt must inject the component list via {valid_components}, not a
        hardcoded backtick list — so domains.json is the single source."""
        text = _PLAN_PROMPT.read_text(encoding="utf-8")
        assert "{valid_components}" in text, "plan.txt must declare {valid_components}"
        # The hardcoded list must be gone (guard against drift-back). The rendered
        # block has many backtick names on the VALID line; the raw file shouldn't.
        valid_line = next(
            (ln for ln in text.splitlines() if "VALID component names" in ln), ""
        )
        assert valid_line.count("`") == 0, f"plan.txt still hardcodes the list: {valid_line!r}"

    def test_toolkit_uses_density_gates_placeholder(self):
        """component_toolkit.txt must inject the density table via {density_gates}."""
        text = _TOOLKIT_PROMPT.read_text(encoding="utf-8")
        assert "{density_gates}" in text, "component_toolkit.txt must declare {density_gates}"

    def test_density_gates_keys_are_valid_components(self):
        """Every density-table row names a real component (no typos/orphans in
        the table the planner sees)."""
        known = set(valid_components()) | set(secondary_components())
        unknown = set(density_gates()) - known
        assert not unknown, f"densityGates rows for unknown components: {sorted(unknown)}"

    def test_render_density_table_has_a_row_per_gate(self):
        """The generated markdown table renders one row per densityGates entry."""
        table = render_density_gate_table()
        for name in density_gates():
            assert f"| {name} |" in table, f"density table missing a row for {name}"
