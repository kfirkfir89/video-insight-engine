"""Cross-tab link resolution — connects related tabs via navigation links.

Component-based matching with domain hints, plus legacy ID-based fallback.
"""

from __future__ import annotations

# Component-based cross-tab link rules: (source_component, target_component, label, domain_hint?)
# domain_hint is optional — when present, the rule only fires for that domain.
_COMPONENT_LINK_RULES: list[tuple[str, str, str, str | None]] = [
    # Food domain flow
    ("overview", "checklist", "Check ingredients", "food"),
    ("checklist", "step_player", "Start cooking", "food"),
    ("step_player", "info_grid", "See pro tips", "food"),
    # Project domain flow
    ("overview", "checklist", "Gather materials", "project"),
    ("checklist", "step_player", "Start building", "project"),
    ("step_player", "info_grid", "Learn techniques", "project"),
    # Travel domain flow
    ("overview", "spot_explorer", "See the itinerary", "travel"),
    ("spot_explorer", "budget", "Check the budget", "travel"),
    ("budget", "checklist", "Pack your bag", "travel"),
    # Review domain flow
    ("overview", "comparison", "See the comparison", "review"),
    ("comparison", "verdict", "Read the verdict", "review"),
    ("verdict", "info_grid", "Explore features", "review"),
    # Learning/Tech domain flow
    ("overview", "flash_deck", "Learn the concepts", "learning"),
    ("flash_deck", "code_explorer", "Try the code", "tech"),
    ("code_explorer", "quiz", "Test yourself", "tech"),
    ("overview", "flash_deck", "Learn the concepts", "tech"),
    ("flash_deck", "quiz", "Test yourself", "learning"),
    # Fitness domain flow
    ("overview", "exercise_tracker", "Start warm-up", "fitness"),
    ("exercise_tracker", "info_grid", "Pro tips", "fitness"),
    # Music domain flow
    ("overview", "lyrics_player", "Follow along", "music"),
    ("lyrics_player", "moment_track", "Jump to highlights", "music"),
    ("moment_track", "info_grid", "Deep dive", "music"),
    # Generic (cross-domain) rules — fire when no domain-specific rule matched
    ("overview", "checklist", "See what you need", None),
    ("overview", "step_player", "Get started", None),
    ("overview", "flash_deck", "Study the concepts", None),
    ("overview", "quiz", "Test yourself", None),
    ("overview", "exercise_tracker", "Start the workout", None),
    ("overview", "comparison", "Compare options", None),
    ("overview", "verdict", "Jump to verdict", None),
    ("checklist", "step_player", "Next: follow the steps", None),
    ("flash_deck", "quiz", "Quiz yourself", None),
    ("quiz", "flash_deck", "Review with flashcards", None),
    ("code_explorer", "quiz", "Test your knowledge", None),
]

# Legacy ID-based rules as secondary fallback
_LEGACY_LINK_RULES: list[tuple[str, str, str]] = [
    ("concepts", "quizzes", "Test your knowledge"),
    ("flashcards", "quizzes", "Take the quiz"),
    ("ingredients", "steps", "Go to steps"),
    ("steps", "ingredients", "Check ingredients"),
    ("materials", "steps", "Start building"),
    ("steps", "materials", "Check materials"),
    ("steps", "ingredients", "Check ingredients"),
    ("code", "setup", "Environment setup"),
    ("setup", "code", "See the code"),
]


def resolve_cross_tab_links(
    tab_id: str,
    all_tab_ids: set[str],
    component: str | None = None,
    all_tabs: list[dict] | None = None,
    primary_tag: str | None = None,
) -> list[dict]:
    """Resolve cross-tab links using component-based matching with domain hints.

    First tries component-based rules (domain-specific, then generic),
    then falls back to legacy ID-based rules.
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

        for src_comp, tgt_comp, label, domain in _COMPONENT_LINK_RULES:
            if src_comp != component:
                continue
            if domain and domain != primary_tag:
                continue
            target_ids = comp_to_tabs.get(tgt_comp, [])
            for tid in target_ids:
                if tid != tab_id and tid in all_tab_ids and tid not in seen_targets:
                    links.append({"targetTab": tid, "label": label})
                    seen_targets.add(tid)

    for source, target, label in _LEGACY_LINK_RULES:
        if source == tab_id and target in all_tab_ids and target not in seen_targets:
            links.append({"targetTab": target, "label": label})
            seen_targets.add(target)

    return links
