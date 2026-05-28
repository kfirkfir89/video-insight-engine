"""Cross-tab link resolution — connects related tabs via navigation links.

Two-part design:

1. **Rules** in this module decide WHICH source-component → target-component
   pairs are valid links (component-based with optional domain hint, plus a
   legacy ID-based fallback). The rules are PURELY STRUCTURAL — they carry
   no human-readable label text.

2. **Labels** come from the Plan LLM, in source language, attached to each
   source tab via ``outboundLinks: {target_tab_id: label}``. ``resolve_cross_tab_links``
   takes that dict and uses it for the CTA text. When the Plan omits an
   entry, we fall back to the target tab's own ``label`` field — which is
   itself an LLM-generated source-language string, so the walker can
   translate it normally.

The point of this split: no hardcoded English in pipeline output. The
translation walker collects every ``crossTabLinks[i].label`` and produces
correct English at the top level + correct source-language under
``sourceLanguage``. There used to be ~50 hardcoded English label strings
in this file; they're all gone now.
"""

from __future__ import annotations

# Component-based cross-tab rules: (source_component, target_component, domain_hint?)
# domain_hint is optional — when present, the rule only fires for that domain.
_COMPONENT_LINK_RULES: list[tuple[str, str, str | None]] = [
    # Food domain flow
    ("overview", "checklist", "food"),
    ("checklist", "step_player", "food"),
    ("step_player", "info_grid", "food"),
    # Project domain flow
    ("overview", "checklist", "project"),
    ("checklist", "step_player", "project"),
    ("step_player", "info_grid", "project"),
    # Travel domain flow
    ("overview", "spot_explorer", "travel"),
    ("spot_explorer", "budget", "travel"),
    ("budget", "checklist", "travel"),
    # Review domain flow
    ("overview", "comparison", "review"),
    ("comparison", "verdict", "review"),
    ("verdict", "info_grid", "review"),
    # Learning/Tech domain flow
    ("overview", "flash_deck", "learning"),
    ("flash_deck", "code_explorer", "tech"),
    ("code_explorer", "quiz", "tech"),
    ("overview", "flash_deck", "tech"),
    ("flash_deck", "quiz", "learning"),
    # Fitness domain flow
    ("overview", "exercise_tracker", "fitness"),
    ("exercise_tracker", "info_grid", "fitness"),
    # Music domain flow
    ("overview", "lyrics_player", "music"),
    ("lyrics_player", "moment_track", "music"),
    ("moment_track", "info_grid", "music"),
    # Generic (cross-domain) rules — fire when no domain-specific rule matched
    ("overview", "checklist", None),
    ("overview", "step_player", None),
    ("overview", "flash_deck", None),
    ("overview", "quiz", None),
    ("overview", "exercise_tracker", None),
    ("overview", "comparison", None),
    ("overview", "verdict", None),
    ("checklist", "step_player", None),
    ("flash_deck", "quiz", None),
    ("quiz", "flash_deck", None),
    ("code_explorer", "quiz", None),
]

# Legacy ID-based rules as secondary fallback. Also structural-only.
_LEGACY_LINK_RULES: list[tuple[str, str]] = [
    ("concepts", "quizzes"),
    ("flashcards", "quizzes"),
    ("ingredients", "steps"),
    ("steps", "ingredients"),
    ("materials", "steps"),
    ("steps", "materials"),
    ("code", "setup"),
    ("setup", "code"),
]


def _resolve_label(
    target_tab_id: str,
    outbound_links: dict[str, str] | None,
    all_tabs: list[dict] | None,
) -> str:
    """Pick the source-language label for a link.

    Order:
      1. Plan-provided ``outboundLinks[target_tab_id]`` (LLM-generated CTA
         in source language)
      2. The target tab's own ``label`` field (also source-language; the
         walker translates it normally)
      3. The target tab id itself (last-resort; shouldn't happen in practice
         because every tab is created with a label)
    """
    if outbound_links and target_tab_id in outbound_links:
        return outbound_links[target_tab_id]
    if all_tabs:
        for t in all_tabs:
            if t.get("id") == target_tab_id:
                fallback = t.get("label")
                if isinstance(fallback, str) and fallback.strip():
                    return fallback
    return target_tab_id


def resolve_cross_tab_links(
    tab_id: str,
    all_tab_ids: set[str],
    component: str | None = None,
    all_tabs: list[dict] | None = None,
    primary_tag: str | None = None,
    outbound_links: dict[str, str] | None = None,
) -> list[dict]:
    """Resolve cross-tab links for ``tab_id``.

    Args:
        tab_id: The source tab whose outbound links we're computing.
        all_tab_ids: Set of all tab IDs in the assembled output (de-dup target).
        component: Source tab's component name (drives component-based rules).
        all_tabs: Full list of assembled tab dicts (needed for label fallback).
        primary_tag: The video's primary domain (filters domain-hinted rules).
        outbound_links: Source tab's Plan-generated ``{target_id: label}`` map.

    Returns:
        ``[{"targetTab": "...", "label": "..."}, ...]`` — labels in source
        language, ready for the translation walker.
    """
    links: list[dict] = []
    seen_targets: set[str] = set()

    if component and all_tabs:
        comp_to_tabs: dict[str, list[str]] = {}
        for t in all_tabs:
            tc = t.get("component", "")
            tid = t.get("id", "")
            if tc and tid:
                comp_to_tabs.setdefault(tc, []).append(tid)

        for src_comp, tgt_comp, domain in _COMPONENT_LINK_RULES:
            if src_comp != component:
                continue
            if domain and domain != primary_tag:
                continue
            target_ids = comp_to_tabs.get(tgt_comp, [])
            for tid in target_ids:
                if tid != tab_id and tid in all_tab_ids and tid not in seen_targets:
                    links.append({
                        "targetTab": tid,
                        "label": _resolve_label(tid, outbound_links, all_tabs),
                    })
                    seen_targets.add(tid)

    for source, target in _LEGACY_LINK_RULES:
        if source == tab_id and target in all_tab_ids and target not in seen_targets:
            links.append({
                "targetTab": target,
                "label": _resolve_label(target, outbound_links, all_tabs),
            })
            seen_targets.add(target)

    return links
