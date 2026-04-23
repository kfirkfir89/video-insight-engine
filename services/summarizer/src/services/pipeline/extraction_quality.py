"""Extraction quality check and synthesis-fed retry prompt builder."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from src.utils.data_helpers import is_empty_data

logger = logging.getLogger(__name__)

# A quality score below this triggers an unconditional retry.
RETRY_SCORE_THRESHOLD = 0.6


@dataclass
class ExtractionQuality:
    """Result of extraction quality check."""
    score: float  # 0.0 to 1.0
    populated: int
    total: int
    empty_fields: list[str] = field(default_factory=list)


def _resolve_dot_path(data: dict, path: str) -> Any:
    """Resolve a dot-notation path against extraction data.

    Supports wildcard ``*`` as a terminal — returns the current object at that point
    (same semantics as assembly's ``resolve_data_source``).
    """
    parts = path.split(".")
    obj: Any = data
    for part in parts:
        if part == "*":
            return obj
        if isinstance(obj, dict) and part in obj:
            obj = obj[part]
        else:
            return None
    return obj


def check_extraction_quality(
    plan_tabs: list[dict],
    extraction_data: dict,
) -> ExtractionQuality:
    """Check how many plan tabs have populated extraction data.

    Skips tabs whose dataSource starts with meta, synthesis, or enrichment
    since those aren't extraction outputs.

    Args:
        plan_tabs: List of tab dicts from plan/triage, each with "dataSource".
        extraction_data: The extraction output dict.

    Returns:
        ExtractionQuality with score, counts, and list of empty field paths.
    """
    if not plan_tabs or not extraction_data:
        return ExtractionQuality(score=0.0, populated=0, total=0, empty_fields=[])

    skip_prefixes = ("meta", "synthesis", "enrichment")

    total = 0
    populated = 0
    empty_fields: list[str] = []

    for tab in plan_tabs:
        ds = tab.get("dataSource", "")
        if not ds:
            continue
        # Skip non-extraction sources
        if any(ds.startswith(prefix) for prefix in skip_prefixes):
            continue

        total += 1
        resolved = _resolve_dot_path(extraction_data, ds)

        if is_empty_data(resolved):
            empty_fields.append(ds)
        else:
            populated += 1

    score = populated / total if total > 0 else 1.0
    return ExtractionQuality(
        score=score,
        populated=populated,
        total=total,
        empty_fields=empty_fields,
    )


@dataclass
class RetryDecision:
    """Outcome of combining quality + count signals into a retry verdict."""
    should_retry: bool
    reason: str
    hard_miss_fields: list[str] = field(default_factory=list)


def decide_extraction_retry(
    quality: ExtractionQuality,
    count_warnings: dict[str, dict[str, Any]],
    score_threshold: float = RETRY_SCORE_THRESHOLD,
) -> RetryDecision:
    """Combine overall quality score with per-field count validation.

    Two independent retry triggers:

    1. Overall score below threshold — existing behavior.
    2. A "hard miss" on any manifest-planned field: the plan specified
       ``itemCount > 0`` but extraction returned zero items. This fires
       regardless of the overall score, since a high score on other
       fields should not mask a completely missed section (e.g., plan
       said ``tips: 6`` and extraction returned ``[]``).
    """
    hard_miss_fields = [
        field_name
        for field_name, warning in count_warnings.items()
        if warning.get("extracted", 0) == 0 and warning.get("manifest", 0) > 0
    ]

    low_score = quality.score < score_threshold and quality.total > 0

    if low_score:
        reason = f"low score ({quality.score:.2f})"
        if hard_miss_fields:
            reason = f"{reason}; hard miss on {', '.join(hard_miss_fields)}"
        return RetryDecision(
            should_retry=True,
            reason=reason,
            hard_miss_fields=hard_miss_fields,
        )
    if hard_miss_fields:
        return RetryDecision(
            should_retry=True,
            reason=f"hard miss on {', '.join(hard_miss_fields)}",
            hard_miss_fields=hard_miss_fields,
        )
    return RetryDecision(
        should_retry=False,
        reason="",
        hard_miss_fields=hard_miss_fields,
    )


def merge_retry_fields(
    empty_fields: list[str],
    hard_miss_fields: list[str],
    count_warnings: dict[str, dict[str, Any]],
) -> list[str]:
    """Combine quality-check empty_fields with annotated count-miss descriptions.

    Hard-miss fields get a "plan expected N, extraction returned 0" annotation.
    If a dot-path in ``empty_fields`` already ends with the hard-miss field
    name (e.g. ``"food.tips"`` + hard miss ``"tips"``), the annotation is
    applied in-place on the existing path entry to avoid listing the same
    schema field twice in the retry prompt.
    """
    descriptions = list(empty_fields)
    for field_name in hard_miss_fields:
        manifest_count = count_warnings.get(field_name, {}).get("manifest", 0)
        suffix = f" (plan expected {manifest_count}, extraction returned 0)"
        matched_in_place = False
        for i, existing in enumerate(descriptions):
            if existing == field_name or existing.endswith(f".{field_name}"):
                if suffix not in existing:
                    descriptions[i] = existing + suffix
                matched_in_place = True
                break
        if not matched_in_place:
            annotated = field_name + suffix
            if annotated not in descriptions:
                descriptions.append(annotated)
    return descriptions


def build_synthesis_fed_retry_prompt(
    empty_fields: list[str],
    synthesis_dict: dict,
) -> str:
    """Build an extra instruction for extraction retry using synthesis evidence.

    Args:
        empty_fields: List of dataSource paths that were empty.
        synthesis_dict: The synthesis output with tldr, keyTakeaways, masterSummary.

    Returns:
        Instruction text to append to extraction prompt.
    """
    parts: list[str] = []
    parts.append("\n\n--- RETRY INSTRUCTION ---")
    parts.append("The previous extraction attempt left these fields empty or incomplete:")

    for field_path in empty_fields:
        parts.append(f"  - {field_path}")

    parts.append("\n<synthesis_evidence>")

    tldr = str(synthesis_dict.get("tldr", ""))[:300]
    if tldr:
        parts.append(f"TLDR: {tldr}")

    takeaways = synthesis_dict.get("keyTakeaways", [])
    if takeaways:
        parts.append("Key Takeaways:")
        for t in takeaways[:8]:
            parts.append(f"  - {str(t)[:200]}")

    summary = str(synthesis_dict.get("masterSummary", ""))[:500]
    if summary:
        parts.append(f"Summary: {summary}")

    parts.append("</synthesis_evidence>")

    parts.append("\nINSTRUCTIONS:")
    parts.append("- Use the synthesis evidence above to populate the empty fields listed.")
    parts.append("- Map synthesis findings to the correct schema fields.")
    parts.append("- DO NOT fabricate data that isn't supported by the transcript.")
    parts.append("- DO NOT hallucinate items, names, or details not in the source material.")
    parts.append("- If a field genuinely has no data in the transcript, leave it empty.")
    parts.append("--- END RETRY INSTRUCTION ---\n")

    return "\n".join(parts)
