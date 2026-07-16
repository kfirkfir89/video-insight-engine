"""Assembler caps + domain requirements single-sourcing (project-score-9 4.5d).

``_TAB_ITEM_CAPS`` and ``_DOMAIN_REQUIREMENTS`` used to be hardcoded in
``assembly/core.py``, outside domains.json — the only assembly knobs not in
config. They are now loaded from domains.json (``assemblerItemCaps`` /
``domainRequirements``), same pattern as the planner components/densityGates.

NOTE on deliberate divergence: ``densityGates`` (advisory LLM-steering text
shown to the planner) and ``assemblerItemCaps`` (hard enforcement backstop)
are BOTH in domains.json but intentionally independent — e.g. step_player is
steered to 10 items but capped at 25. Editing one does not touch the other.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.services.pipeline.assembly import core
from src.shared_config.domain_config import (
    assembler_item_caps,
    domain_requirements,
    valid_components,
    valid_content_tags,
)

_DOMAINS_JSON = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "packages"
    / "shared"
    / "src"
    / "config"
    / "domains.json"
)


def _raw_config() -> dict:
    return json.loads(_DOMAINS_JSON.read_text())


class TestSingleSource:
    def test_tab_item_caps_come_from_domains_json(self):
        assert core._TAB_ITEM_CAPS == _raw_config()["assemblerItemCaps"]

    def test_domain_requirements_come_from_domains_json(self):
        assert core._DOMAIN_REQUIREMENTS == _raw_config()["domainRequirements"]

    def test_accessors_match_raw_json(self):
        assert assembler_item_caps() == _raw_config()["assemblerItemCaps"]
        assert domain_requirements() == _raw_config()["domainRequirements"]


class TestConfigIntegrity:
    def test_cap_values_are_positive_ints(self):
        for component, cap in assembler_item_caps().items():
            assert isinstance(cap, int) and cap > 0, f"{component}: {cap!r}"

    def test_requirement_tags_are_valid_domains(self):
        unknown = set(domain_requirements()) - valid_content_tags()
        assert not unknown, f"domainRequirements has unknown tags: {sorted(unknown)}"

    def test_every_domain_has_a_requirements_entry(self):
        """Every domain gets an explicit entry (even if `required` is empty)
        so adding a domain forces a deliberate requirements decision."""
        missing = valid_content_tags() - set(domain_requirements())
        assert not missing, f"domains missing from domainRequirements: {sorted(missing)}"

    def test_required_components_are_known(self):
        known = valid_components()
        for tag, reqs in domain_requirements().items():
            for component in reqs.get("required", []):
                assert component in known, f"{tag} requires unknown component {component!r}"
            for component in reqs.get("max", {}):
                assert component in known, f"{tag} caps unknown component {component!r}"

    def test_capped_components_are_known(self):
        unknown = set(assembler_item_caps()) - valid_components()
        assert not unknown, f"assemblerItemCaps has unknown components: {sorted(unknown)}"

    def test_every_capped_component_has_a_count_key(self):
        """A cap without a ``_COUNT_KEYS`` entry silently never enforces —
        _cap_tab_items can't find the list prop to truncate."""
        missing = set(assembler_item_caps()) - set(core._COUNT_KEYS)
        assert not missing, f"capped components missing a _COUNT_KEYS entry: {sorted(missing)}"

    def test_count_keys_carry_no_dead_component_names(self):
        """_COUNT_KEYS stays code-side (it names assembler prop keys), but its
        entries must be real registry components — the v1-legacy names (quiz,
        scenario, exercise_tracker, code_explorer, gallery, lyrics_player)
        were dead weight."""
        unknown = set(core._COUNT_KEYS) - valid_components()
        assert not unknown, f"_COUNT_KEYS has dead component names: {sorted(unknown)}"

    def test_advisory_density_gates_still_independent(self):
        """The audit-era divergence is deliberate: step_player densityGate max
        is 10 (planner steering) while the assembler cap is 25 (enforcement).
        This pins that both exist independently in config."""
        cfg = _raw_config()
        assert cfg["densityGates"]["step_player"]["max"] != str(
            cfg["assemblerItemCaps"]["step_player"]
        )


class TestBehaviorUnchanged:
    """The move to config must not change the audited enforcement values."""

    def test_known_cap_spot_checks(self):
        caps = assembler_item_caps()
        assert caps["comparison"] == 10
        assert caps["step_player"] == 25
        assert caps["checklist"] == 30
        assert caps["moment_track"] == 20

    def test_known_requirement_spot_checks(self):
        reqs = domain_requirements()
        assert reqs["review"]["required"] == ["comparison"]
        assert reqs["tech"]["max"] == {"flash_deck": 1, "quiz_arena": 1}
        assert reqs["music"]["required"] == []
