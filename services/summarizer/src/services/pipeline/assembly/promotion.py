"""Post-extraction component promotion.

The planner (stage 3) runs *before* extraction (stage 4), so it can only pick
components from the title / chapter structure — it never sees the extracted
item counts, concept-connection graph, or frame coverage that the richer
components require. This module runs inside the assembler (stage 8), where
those facts ARE known, and upgrades a basic component to a richer sibling when
the data supports it.

Each rule re-shapes props by calling the *target* assembler (never a bare
rename) so a promoted tab is always render-valid; ``assemble_response``
re-validates the result immediately afterward.
"""

from __future__ import annotations

import logging
from typing import Any

from .assemblers_overhaul import assemble_concept_canvas
from .assemblers_primary import assemble_spot_explorer

logger = logging.getLogger(__name__)

# Promotion thresholds — each is a named constant with a dedicated unit test.
RADAR_AXIS_THRESHOLD = 4  # comparison  -> comparison_radar (scoreable rows)
CONCEPT_CONNECTION_MIN = 2  # flash_deck  -> concept_canvas (connected concepts)
STEP_FLOW_THRESHOLD = 8  # step_player -> step_flow_canvas (step count)
INFO_GRID_LONG_VALUE = 120  # info_grid   -> spot_explorer (value length, chars)
INFO_GRID_LONG_MIN = 2  # need this many long, card-worthy rows to promote

# Domains whose `concepts` extraction carries a connection graph worth rendering
# as a canvas rather than a flat flashcard deck.
_CONCEPT_DOMAINS: frozenset[str] = frozenset({"learning", "science"})


def _promote_comparison(props: dict) -> tuple[str, dict] | None:
    """comparison -> comparison_radar when there are enough scoreable axes.

    `comparison_radar` shares the comparison data contract, so the props are
    forwarded unchanged; the renderer chooses the radar visualization.
    """
    rows = props.get("comparisons")
    if isinstance(rows, list) and len(rows) >= RADAR_AXIS_THRESHOLD:
        return "comparison_radar", props
    return None


def _promote_step_player(props: dict) -> tuple[str, dict] | None:
    """step_player -> step_flow_canvas for long procedures.

    Same data contract as step_player; the canvas renderer lays the steps out
    as a connected flow once the list is long enough to benefit from it.
    """
    steps = props.get("steps")
    if isinstance(steps, list) and len(steps) >= STEP_FLOW_THRESHOLD:
        return "step_flow_canvas", props
    return None


def _resolve_concept_source(
    data: Any,
    extraction: dict | None,
    domain: str,
) -> list | None:
    """Find the concept list that backs a flash_deck tab.

    Prefers the tab's own resolved data when it already carries connections;
    otherwise falls back to the domain's `concepts` extraction block.
    """
    if isinstance(data, list) and any(isinstance(x, dict) and x.get("connections") for x in data):
        return data
    dom = extraction.get(domain) if isinstance(extraction, dict) else None
    if isinstance(dom, dict) and isinstance(dom.get("concepts"), list):
        return dom["concepts"]
    return None


def _promote_flash_deck(
    data: Any,
    extraction: dict | None,
    domain: str,
) -> tuple[str, dict] | None:
    """flash_deck -> concept_canvas when the concepts form a connection graph."""
    if domain not in _CONCEPT_DOMAINS:
        return None
    concepts_src = _resolve_concept_source(data, extraction, domain)
    if concepts_src is None:
        return None
    props = assemble_concept_canvas({}, concepts_src, extraction or {}, None)
    if props is None:
        return None
    connected = sum(
        1 for c in props.get("concepts", []) if isinstance(c, dict) and c.get("connections")
    )
    if connected >= CONCEPT_CONNECTION_MIN:
        return "concept_canvas", props
    return None


def _promote_info_grid(
    props: dict,
    extraction: dict | None,
) -> tuple[str, dict] | None:
    """info_grid -> spot_explorer when rows are description-heavy cards.

    A grid of short reference pairs stays a grid; a grid whose values are long
    descriptions is really a set of browsable cards, so we re-shape it through
    the spot_explorer assembler (key -> name, value -> description).
    """
    items = props.get("items")
    if not isinstance(items, list):
        return None
    long_items = [
        it
        for it in items
        if isinstance(it, dict) and len(str(it.get("value") or "")) > INFO_GRID_LONG_VALUE
    ]
    if len(long_items) < INFO_GRID_LONG_MIN:
        return None
    spot_input = [
        {
            "name": it.get("key", ""),
            "description": it.get("value", ""),
            **({"emoji": it["emoji"]} if it.get("emoji") else {}),
        }
        for it in items
        if isinstance(it, dict)
    ]
    new_props = assemble_spot_explorer({}, spot_input, extraction or {}, None)
    if new_props is None:
        return None
    return "spot_explorer", new_props


def promote_component(
    component: str,
    props: dict,
    data: Any,
    extraction: dict | None,
    domain: str,
) -> tuple[str, dict]:
    """Promote a component to a richer sibling when the data supports it.

    Returns ``(component, props)`` unchanged when no rule fires. A fired rule
    always returns re-shaped, render-valid props for the new component.
    """
    result: tuple[str, dict] | None = None
    if component == "comparison":
        result = _promote_comparison(props)
    elif component == "step_player":
        result = _promote_step_player(props)
    elif component == "flash_deck":
        result = _promote_flash_deck(data, extraction, domain)
    elif component == "info_grid":
        result = _promote_info_grid(props, extraction)

    if result is None:
        return component, props
    new_component, new_props = result
    logger.info("[assembly] promoted %s -> %s", component, new_component)
    return new_component, new_props
