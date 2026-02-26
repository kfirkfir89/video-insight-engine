"""Concept extraction, normalization, deduplication, and prompt building.

Extracted from prompt_builders.py to separate concept processing concerns.
Contains:
- Alias normalization (normalize_aliases)
- Fuzzy dedup (normalize_for_dedup, names_are_similar, merge_chapter_concepts)
- Concept dict building (build_concept_dicts)
- Concept extraction prompt construction (build_concept_extraction_section,
  build_concept_prompt_parts, build_concepts_anchor, extract_concept_short_form)
"""

import logging
import re
import uuid
from typing import Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Alias Normalization
# ─────────────────────────────────────────────────────────────────────────────


def normalize_aliases(raw: Any) -> list[str]:
    """Normalize LLM-provided aliases to a clean list of strings."""
    if not isinstance(raw, list):
        return []
    return [a.strip() for a in raw if isinstance(a, str) and a.strip()][:5]


# ─────────────────────────────────────────────────────────────────────────────
# Concept Normalization & Dedup
# ─────────────────────────────────────────────────────────────────────────────


def normalize_for_dedup(name: str) -> str:
    """Normalize a concept name for fuzzy dedup comparison.

    Applies: lowercase, strip parentheticals, remove leading articles,
    normalize whitespace/hyphens.

    Args:
        name: Raw concept name from LLM.

    Returns:
        Normalized string for comparison.
    """
    s = name.lower().strip()
    # Strip parentheticals: "Search Engine Optimization (SEO)" -> "search engine optimization"
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s).strip()
    # Remove leading articles
    s = re.sub(r"^(the|a|an)\s+", "", s, flags=re.IGNORECASE)
    # Normalize hyphens to spaces
    s = s.replace("-", " ")
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _longest_common_substring_len(a: str, b: str) -> int:
    """Compute length of the longest common substring between two strings.

    Uses a space-optimized DP approach (O(min(n,m)) space).
    """
    if not a or not b:
        return 0
    # Ensure a is the shorter string for space efficiency
    if len(a) > len(b):
        a, b = b, a
    prev = [0] * (len(a) + 1)
    best = 0
    for ch_b in b:
        curr = [0] * (len(a) + 1)
        for j, ch_a in enumerate(a):
            if ch_b == ch_a:
                curr[j + 1] = prev[j] + 1
                if curr[j + 1] > best:
                    best = curr[j + 1]
        prev = curr
    return best


def _extract_paren_parts(name: str, *, precomputed_norm: str | None = None) -> list[str]:
    """Extract normalized parts from a name with parentheses.

    For "SEO (Search Engine Optimization)" returns ["seo", "search engine optimization"].
    For "Neuroplasticity" returns ["neuroplasticity"].

    Args:
        name: Raw concept name.
        precomputed_norm: If provided, skip normalizing the whole name (optimization).
    """
    m = re.match(r"^(.+?)\s*\((.+?)\)\s*$", name.strip(), re.IGNORECASE)
    if not m:
        return [precomputed_norm or normalize_for_dedup(name)]
    base = normalize_for_dedup(m.group(1))
    inside = normalize_for_dedup(m.group(2))
    parts = []
    if base:
        parts.append(base)
    if inside and inside != base:
        parts.append(inside)
    return parts


# ── Similarity predicates (each tests one strategy) ──


def _match_normalized(na: str, nb: str) -> bool:
    """Exact match after normalization."""
    return na == nb


def _match_substring(na: str, nb: str) -> bool:
    """One normalized name is a substring of the other."""
    return na in nb or nb in na


def _match_paren_parts(a: str, b: str, na: str, nb: str) -> bool:
    """Parenthetical expansion: compare parts inside/outside parens."""
    parts_a = _extract_paren_parts(a, precomputed_norm=na)
    parts_b = _extract_paren_parts(b, precomputed_norm=nb)
    for pa in parts_a:
        for pb in parts_b:
            if pa and pb and pa == pb:
                return True
    return False


def _match_space_stripped(na: str, nb: str) -> bool:
    """Space-stripped match: "machine learning" == "machinelearning"."""
    return na.replace(" ", "") == nb.replace(" ", "")


def _match_token_jaccard(na: str, nb: str) -> bool:
    """Token Jaccard similarity >= 0.6."""
    tokens_a = set(na.split())
    tokens_b = set(nb.split())
    if not tokens_a or not tokens_b:
        return False
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return union > 0 and intersection / union >= 0.6


def _match_lcs(na: str, nb: str) -> bool:
    """Longest common substring >= 60% of shorter name.

    Only applied when shorter name >= 10 chars to avoid false positives
    on short names with a shared prefix (e.g. "React Hooks" vs "React Query").
    """
    shorter_len = min(len(na), len(nb))
    if shorter_len < 10:
        return False
    lcs_len = _longest_common_substring_len(na, nb)
    return lcs_len >= max(6, int(shorter_len * 0.6))


def names_are_similar(a: str, b: str) -> bool:
    """Check if two concept names refer to the same concept.

    Runs named predicates in order (cheapest first); any match returns True:
    1. Exact match after normalization
    2. Substring containment
    3. Parenthetical expansion
    4. Space-stripped match
    5. Token Jaccard >= 0.6
    6. LCS >= 60% of shorter name (min 10 chars)

    Args:
        a: First concept name.
        b: Second concept name.

    Returns:
        True if names are considered similar.
    """
    na = normalize_for_dedup(a)
    nb = normalize_for_dedup(b)

    if not na or not nb:
        return False

    # Short-circuit: trivial names (< 3 chars) rarely match meaningfully
    if len(na) < 3 or len(nb) < 3:
        return na == nb

    return (
        _match_normalized(na, nb)
        or _match_substring(na, nb)
        or _match_paren_parts(a, b, na, nb)
        or _match_space_stripped(na, nb)
        or _match_token_jaccard(na, nb)
        or _match_lcs(na, nb)
    )


def merge_chapter_concepts(
    chapters_concepts: list[tuple[int, list[dict]]],
) -> list[dict[str, Any]]:
    """Merge concepts from all chapters with fuzzy dedup.

    First-chapter-wins: if "Neuroplasticity" appears in chapter 2 and
    "Neural Plasticity" appears in chapter 5, only the chapter 2 version
    is kept.

    Adds `chapter_index` field to each concept.

    Args:
        chapters_concepts: List of (chapter_index, raw_concepts) tuples.

    Returns:
        Deduplicated list of concept dicts with id, name, definition,
        timestamp, chapter_index.
    """
    # Import here to avoid circular dependency — validate_timestamp lives
    # in prompt_builders (timestamp utilities section).
    from src.services.prompt_builders import validate_timestamp

    merged: list[dict[str, Any]] = []
    seen_names: list[str] = []  # Track raw names for fuzzy comparison
    seen_normalized: set[str] = set()  # O(1) fast path for exact-norm matches

    for chapter_idx, raw_concepts in chapters_concepts:
        for c in raw_concepts:
            if not isinstance(c, dict):
                continue

            name = c.get("name", "")
            if isinstance(name, str):
                name = name.strip()
            if not name:
                continue

            # O(1) fast path: exact normalized match (covers case-insensitive)
            norm = normalize_for_dedup(name)
            if norm in seen_normalized:
                continue

            # O(n) fallback: fuzzy similarity against all already-seen names
            is_duplicate = False
            for seen in seen_names:
                if names_are_similar(name, seen):
                    is_duplicate = True
                    break

            if is_duplicate:
                continue

            seen_names.append(name)
            seen_normalized.add(norm)

            # Normalize definition
            definition = c.get("definition")
            if isinstance(definition, str):
                definition = definition.strip() or None

            # Validate timestamp
            timestamp = validate_timestamp(c.get("timestamp"))

            merged.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "definition": definition,
                "timestamp": timestamp,
                "chapter_index": chapter_idx,
                "aliases": normalize_aliases(c.get("aliases", [])),
            })

    return merged


# ─────────────────────────────────────────────────────────────────────────────
# Concept Extraction Prompt Builders
# ─────────────────────────────────────────────────────────────────────────────


def build_concept_extraction_section(
    total_chapters: int,
    already_extracted: list[str] | None = None,
) -> str:
    """Build the concept extraction section for per-chapter prompts.

    Args:
        total_chapters: Total number of chapters in the video.
        already_extracted: Names of concepts already extracted from prior chapters.

    Returns:
        Prompt section string with concept extraction instructions.
    """
    # Scale concept count with chapter count (fewer chapters = more concepts each)
    if total_chapters <= 5:
        min_concepts, max_concepts = 3, 5
    elif total_chapters <= 12:
        min_concepts, max_concepts = 2, 4
    else:
        min_concepts, max_concepts = 2, 3

    section = (
        f"\nCONCEPT EXTRACTION:\n"
        f"Also extract {min_concepts}-{max_concepts} key concepts from THIS chapter.\n"
        f"For each concept, provide:\n"
        f'- "name": The concept name (2-6 words, no leading articles)\n'
        f'- "definition": The actual definition or explanation given in the video\n'
        f'- "timestamp": The M:SS or MM:SS timestamp where the concept is first mentioned in this chapter\n'
        f"\n"
        f"NAMING RULES:\n"
        f'- Use the full name first, abbreviation in parentheses: "Search Engine Optimization (SEO)" not "SEO"\n'
        f'- Do not start with articles: "Dependency Injection" not "The Dependency Injection"\n'
        f"- Ideal length: 2-6 words\n"
        f"\n"
        f"WHAT TO EXTRACT:\n"
        f"- Technical terms with their definitions\n"
        f"- Frameworks, tools, or methodologies mentioned\n"
        f"- Key principles or rules explained\n"
        f"- Patterns or anti-patterns described\n"
        f"\n"
        f"WHAT TO SKIP:\n"
        f"- Generic terms without specific meaning in context\n"
        f"- Concepts only mentioned in passing without explanation\n"
        f"- Common words that don't add value\n"
        f"\n"
        f"SELF-ANCHORING RULE (CRITICAL):\n"
        f"Before finalizing your concepts array, verify EACH concept name appears "
        f"verbatim in at least one content block above. If a concept name does NOT "
        f"appear in your content blocks, either:\n"
        f"  1. Rewrite the concept name to match a phrase that IS in your content, OR\n"
        f"  2. Remove the concept entirely.\n"
        f"Concepts whose names don't appear in the content will be invisible to users.\n"
        f'Example: If content says "prompt queuing" but concept is named '
        f'"Prompt Queuing System", rename to "Prompt Queuing".\n'
        f"\n"
        f"COMMON MISTAKES TO AVOID:\n"
        f"- 'throwaway envs' when content says 'throwaway environments' (use full words)\n"
        f"- 'escaping the interrupts' when content says 'escape interrupts' (match exact verb form)\n"
        f"- 'course correct' when content says 'course correction' (match exact noun/verb form)\n"
        f"- 'workflow triggers' when 'workflow' and 'triggers' appear in separate sentences (name must be a contiguous phrase)\n"
    )

    if already_extracted:
        names_list = ", ".join(already_extracted[:30])
        section += (
            f"\n"
            f"ALREADY EXTRACTED (do NOT re-extract these):\n"
            f"{names_list}\n"
        )

    return section


def build_concept_prompt_parts(
    extract_concepts: bool,
    total_chapters: int | None,
    already_extracted_names: list[str] | None,
) -> tuple[str, str, int]:
    """Build concept extraction prompt parts and max_tokens.

    Returns:
        (concept_extraction_section, concepts_field, max_tokens) tuple.
    """
    if extract_concepts and total_chapters is not None:
        section = build_concept_extraction_section(total_chapters, already_extracted_names)
        field = (
            ',\n  "concepts": [\n'
            '    {"name": "Concept Name", "definition": "Actual definition", '
            '"timestamp": "M:SS", "aliases": ["optional short form"]}\n'
            '  ]'
        )
        return section, field, 3000
    return "", "", 2500


def build_concept_dicts(raw_concepts: list[dict]) -> list[dict[str, Any]]:
    """Build normalized, deduplicated concept dicts with UUIDs from raw LLM output.

    Normalization:
    - Strip whitespace from names and definitions
    - Reject whitespace-only or empty names
    - Validate timestamps (only M:SS / MM:SS / H:MM:SS accepted)
    - Deduplicate by case-insensitive name (first occurrence wins)

    Args:
        raw_concepts: Raw concept dicts from LLM (must have "name" key).

    Returns:
        List of concept dicts with id, name, definition, timestamp.
    """
    # Import here to avoid circular dependency — validate_timestamp lives
    # in prompt_builders (timestamp utilities section).
    from src.services.prompt_builders import validate_timestamp

    seen_names: set[str] = set()
    result: list[dict[str, Any]] = []

    for c in raw_concepts:
        if not isinstance(c, dict):
            continue

        name = c.get("name", "")
        if isinstance(name, str):
            name = name.strip()
        if not name:
            continue

        # Case-insensitive dedup -- first occurrence wins
        name_lower = name.lower()
        if name_lower in seen_names:
            continue
        seen_names.add(name_lower)

        # Normalize definition
        definition = c.get("definition")
        if isinstance(definition, str):
            definition = definition.strip() or None

        # Validate timestamp
        timestamp = validate_timestamp(c.get("timestamp"))

        result.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "definition": definition,
            "timestamp": timestamp,
            "aliases": normalize_aliases(c.get("aliases", [])),
        })

    return result


def extract_concept_short_form(name: str) -> str | None:
    """Extract a short form from a concept name with parentheses.

    Handles both patterns:
    - "Search Engine Optimization (SEO)" -> "SEO"
    - "EMDR (Eye Movement Desensitization)" -> "Eye Movement Desensitization"
    (reversed: base is short, parens is long)

    Returns:
        Short form string, or None if no parenthetical found.
    """
    match = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", name)
    if not match:
        return None
    base = match.group(1).strip()
    parens = match.group(2).strip()
    # If parens is short (abbreviation), return it
    if len(parens) <= 6:
        return parens
    # If base is short (abbreviation), return parens content as the alternative form
    if len(base) <= 6:
        return base
    return None


def build_concepts_anchor(concept_names: list[str] | None) -> str:
    """Build the CONCEPT ANCHORING prompt section for chapter summaries.

    Lists each concept with acceptable short forms so the LLM knows
    it can use "DPO" instead of "Duration, Path, and Outcome (DPO)".

    Args:
        concept_names: List of concept names to anchor, or None.

    Returns:
        Formatted anchor section, or empty string if no concepts.
    """
    if not concept_names:
        return ""

    lines: list[str] = []
    for name in concept_names:
        short = extract_concept_short_form(name)
        if short:
            lines.append(f"- {name} (also: {short})")
        else:
            lines.append(f"- {name}")

    return (
        "\nCONCEPT ANCHORING:\n"
        "These key concepts appear in this video's glossary. When your content discusses "
        "these topics, use the concept name (or its short form) at least once so readers "
        "can discover definitions via inline highlights. Only include concepts relevant "
        "to THIS chapter:\n"
        + "\n".join(lines)
        + "\n"
    )
