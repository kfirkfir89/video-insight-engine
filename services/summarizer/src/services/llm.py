"""LLM service for video summarization.

Uses LiteLLM via LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
"""

import asyncio
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, Literal

from src.config import settings
from src.services.llm_provider import LLMProvider
from src.utils.content_extractor import (
    extract_summary_from_content,
    extract_bullets_from_content,
)

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
PERSONAS_DIR = PROMPTS_DIR / "personas"
EXAMPLES_DIR = PROMPTS_DIR / "examples"

# Valid persona names - whitelist to prevent path traversal attacks
VALID_PERSONAS: frozenset[str] = frozenset([
    'code', 'recipe', 'interview', 'review', 'standard',
    'fitness', 'travel', 'education'
])

# ── Per-Chapter View Constants ──

# Valid view values matching VideoCategory type
VALID_VIEWS: frozenset[str] = frozenset([
    'cooking', 'coding', 'reviews', 'travel', 'fitness',
    'education', 'podcast', 'diy', 'gaming', 'standard',
])

# Signature blocks used for soft correction of LLM view
VIEW_SIGNATURE_BLOCKS: dict[str, set[str]] = {
    'cooking': {'ingredient', 'step', 'nutrition'},
    'coding': {'code', 'terminal', 'file_tree'},
    'reviews': {'pro_con', 'rating', 'verdict'},
    'travel': {'location', 'itinerary'},
    'fitness': {'exercise', 'workout_timer'},
    'education': {'quiz', 'formula'},
    'podcast': {'guest'},              # Single signature — relies on LLM (transcript removed)
    'diy': {'tool_list', 'step'},       # 'step' overlaps with cooking — handled by 2+ threshold
    'gaming': set(),                     # No unique signature blocks — relies on LLM
    'standard': set(),
}

# Category to preferred V2.1 block types mapping
# Used for logging metrics and future prompt injection
CATEGORY_BLOCKS: dict[str, list[str]] = {
    'code': ['code', 'terminal', 'file_tree', 'definition', 'quiz'],
    'recipe': ['ingredient', 'step', 'nutrition', 'tool_list'],
    'review': ['pro_con', 'rating', 'verdict', 'cost'],
    'fitness': ['exercise', 'workout_timer'],
    'travel': ['location', 'itinerary', 'cost'],
    'education': ['quiz', 'formula', 'timeline', 'definition'],
    'interview': ['guest', 'quote', 'timestamp'],
    'standard': [],
}

# Streaming event types
StreamEventType = Literal["token", "complete"]
StreamEvent = tuple[StreamEventType, str | dict | list]


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def load_persona(name: str) -> str:
    """Load persona guidelines from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        Persona guidelines text. Falls back to 'standard' if invalid or not found.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning(f"Invalid persona name '{name}', falling back to 'standard'")
        name = 'standard'

    path = PERSONAS_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (PERSONAS_DIR / "standard.txt").read_text()


def load_examples(name: str) -> str:
    """Load persona-specific JSON examples from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        JSON examples text. Falls back to 'standard' if invalid or not found.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning(f"Invalid persona name '{name}', falling back to 'standard'")
        name = 'standard'

    path = EXAMPLES_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (EXAMPLES_DIR / "standard.txt").read_text()


def load_persona_system() -> str:
    """Load the unified persona system prompt (Author + Domain Experts).

    Returns:
        Persona system text. Falls back to empty string if file missing.

    Note:
        Not cached — reads from disk each call so changes in
        volume-mounted prompt files are picked up immediately.
    """
    path = PROMPTS_DIR / "persona_system.txt"
    if path.exists():
        return path.read_text()
    logger.warning("persona_system.txt not found, using empty persona context")
    return ""


_TIMESTAMP_RE = re.compile(r"^\d{1,2}:\d{2}(?::\d{2})?$")


def _validate_timestamp(ts: Any) -> str | None:
    """Validate a timestamp string against expected formats.

    Valid formats: M:SS, MM:SS, H:MM:SS, HH:MM:SS.

    Args:
        ts: Raw timestamp value from LLM output.

    Returns:
        The timestamp string if valid, None otherwise.
    """
    if not isinstance(ts, str):
        return None
    ts = ts.strip()
    if _TIMESTAMP_RE.match(ts):
        return ts
    return None


def _normalize_aliases(raw: Any) -> list[str]:
    """Normalize LLM-provided aliases to a clean list of strings."""
    if not isinstance(raw, list):
        return []
    return [a.strip() for a in raw if isinstance(a, str) and a.strip()][:5]


def _normalize_for_dedup(name: str) -> str:
    """Normalize a concept name for fuzzy dedup comparison.

    Applies: lowercase, strip parentheticals, remove leading articles,
    normalize whitespace/hyphens.

    Args:
        name: Raw concept name from LLM.

    Returns:
        Normalized string for comparison.
    """
    s = name.lower().strip()
    # Strip parentheticals: "Search Engine Optimization (SEO)" → "search engine optimization"
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
        return [precomputed_norm or _normalize_for_dedup(name)]
    base = _normalize_for_dedup(m.group(1))
    inside = _normalize_for_dedup(m.group(2))
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


def _names_are_similar(a: str, b: str) -> bool:
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
    na = _normalize_for_dedup(a)
    nb = _normalize_for_dedup(b)

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
            norm = _normalize_for_dedup(name)
            if norm in seen_normalized:
                continue

            # O(n) fallback: fuzzy similarity against all already-seen names
            is_duplicate = False
            for seen in seen_names:
                if _names_are_similar(name, seen):
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
            timestamp = _validate_timestamp(c.get("timestamp"))

            merged.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "definition": definition,
                "timestamp": timestamp,
                "chapter_index": chapter_idx,
                "aliases": _normalize_aliases(c.get("aliases", [])),
            })

    return merged


def _build_concept_extraction_section(
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


def _build_concept_prompt_parts(
    extract_concepts: bool,
    total_chapters: int | None,
    already_extracted_names: list[str] | None,
) -> tuple[str, str, int]:
    """Build concept extraction prompt parts and max_tokens.

    Returns:
        (concept_extraction_section, concepts_field, max_tokens) tuple.
    """
    if extract_concepts and total_chapters is not None:
        section = _build_concept_extraction_section(total_chapters, already_extracted_names)
        field = (
            ',\n  "concepts": [\n'
            '    {"name": "Concept Name", "definition": "Actual definition", '
            '"timestamp": "M:SS", "aliases": ["optional short form"]}\n'
            '  ]'
        )
        return section, field, 2000
    return "", "", 1500


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

        # Case-insensitive dedup — first occurrence wins
        name_lower = name.lower()
        if name_lower in seen_names:
            continue
        seen_names.add(name_lower)

        # Normalize definition
        definition = c.get("definition")
        if isinstance(definition, str):
            definition = definition.strip() or None

        # Validate timestamp
        timestamp = _validate_timestamp(c.get("timestamp"))

        result.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "definition": definition,
            "timestamp": timestamp,
            "aliases": _normalize_aliases(c.get("aliases", [])),
        })

    return result


def _extract_concept_short_form(name: str) -> str | None:
    """Extract a short form from a concept name with parentheses.

    Handles both patterns:
    - "Search Engine Optimization (SEO)" → "SEO"
    - "EMDR (Eye Movement Desensitization)" → "Eye Movement Desensitization"
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


def _build_concepts_anchor(concept_names: list[str] | None) -> str:
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
        short = _extract_concept_short_form(name)
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


def _infer_view_from_blocks(content: list[dict]) -> str | None:
    """Infer view from content blocks using signature block matching.

    Only overrides LLM view when 2+ distinct signature blocks match
    a single view. Returns None to defer to LLM when no strong match.

    Args:
        content: List of content block dictionaries

    Returns:
        View name if strong match found, None otherwise.
    """
    if not content:
        return None

    block_types = {b.get("type") for b in content if isinstance(b, dict) and b.get("type")}

    # Count matching signature blocks per view
    matches: dict[str, int] = {}
    for view, sig_blocks in VIEW_SIGNATURE_BLOCKS.items():
        if not sig_blocks:
            continue
        count = len(block_types & sig_blocks)
        if count >= 2:
            matches[view] = count

    if not matches:
        return None

    # If exactly one view has 2+ matches, return it
    if len(matches) == 1:
        return next(iter(matches))

    # Tie between views — defer to LLM
    return None


def _resolve_view(content: list[dict], llm_view_raw: str, title: str) -> str:
    """Resolve final per-chapter view from LLM output + block inference.

    Uses the LLM-provided view as primary signal, with soft correction
    when 2+ signature blocks point to a different view.

    Args:
        content: List of content block dictionaries
        llm_view_raw: Raw view string from LLM response
        title: Chapter title for logging context

    Returns:
        Resolved view string (always a valid view value).
    """
    llm_view = llm_view_raw if llm_view_raw in VALID_VIEWS else "standard"
    inferred = _infer_view_from_blocks(content)
    if inferred and inferred != llm_view:
        logger.warning(
            "View mismatch for '%s': LLM=%s, inferred=%s. Using inferred.",
            title, llm_view, inferred,
        )
        return inferred
    return llm_view


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to MM:SS format."""
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def _sanitize_llm_input(text: str, max_length: int = 10000) -> str:
    """Sanitize user input before including in LLM prompts.

    Prevents prompt injection by:
    - Truncating to max_length to prevent resource exhaustion
    - Stripping leading/trailing whitespace

    Note: We intentionally don't strip special characters as they may be
    legitimate in titles, descriptions, etc. The LLM prompt templates
    are designed to handle user content safely by placing it in clearly
    delimited sections.

    Args:
        text: User-provided text to sanitize
        max_length: Maximum allowed length (default 10000 chars)

    Returns:
        Sanitized text, truncated if necessary
    """
    if not text:
        return ""
    text = text.strip()
    if len(text) > max_length:
        logger.warning(f"Input truncated from {len(text)} to {max_length} chars")
        return text[:max_length]
    return text


def _parse_json_response(text: str, fallback: dict | None = None) -> dict:
    """Parse JSON from LLM response text."""
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except json.JSONDecodeError:
        pass
    return fallback or {}


def inject_block_ids(blocks: list[dict]) -> list[dict]:
    """Inject unique blockId (UUID) into each content block.

    This provides stable identifiers for memorization and RAG features.

    Args:
        blocks: List of content block dictionaries

    Returns:
        Same blocks with blockId added to each
    """
    for block in blocks:
        if isinstance(block, dict) and "blockId" not in block:
            block["blockId"] = str(uuid.uuid4())
    return blocks


def _log_block_metrics(
    content: list[dict],
    chapter_title: str,
    persona: str,
    view: str = 'standard',
) -> None:
    """Log block generation metrics for analysis.

    Tracks:
    - Block type diversity
    - Paragraph ratio (lower is better for information density)
    - Category-appropriate block usage

    Args:
        content: List of content blocks
        chapter_title: Title for logging context
        persona: Content persona used
        view: Per-chapter view value
    """
    if not content:
        return

    block_types = [b.get("type") for b in content if isinstance(b, dict) and b.get("type")]
    unique_types = set(block_types)
    total_blocks = len(block_types)

    # Count paragraphs
    paragraph_count = sum(1 for t in block_types if t == "paragraph")
    paragraph_ratio = paragraph_count / total_blocks if total_blocks > 0 else 0

    # Check category-appropriate block usage
    category_blocks = CATEGORY_BLOCKS.get(persona, [])
    category_block_count = sum(1 for t in block_types if t in category_blocks)
    category_match_ratio = category_block_count / total_blocks if total_blocks > 0 else 0

    # Log metrics
    logger.info(
        "chapter_summary_blocks",
        extra={
            "chapter_title": chapter_title[:50],
            "persona": persona,
            "view": view,
            "total_blocks": total_blocks,
            "unique_block_types": len(unique_types),
            "block_types": list(block_types),
            "paragraph_ratio": round(paragraph_ratio, 2),
            "category_match_ratio": round(category_match_ratio, 2),
        },
    )


class LLMService:
    """Service for LLM-based video processing.

    Uses LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
    All API calls are native async via LiteLLM's acompletion().
    """

    def __init__(self, provider: LLMProvider):
        """Initialize LLM service.

        Args:
            provider: LLMProvider instance for making LLM calls
        """
        self._provider = provider

    @property
    def provider(self) -> LLMProvider:
        """Get the underlying LLM provider.

        Use this for operations that need direct provider access,
        such as fast model calls for classification.
        """
        return self._provider

    @property
    def fast_model(self) -> str:
        """Get the configured fast model from the provider."""
        return self._provider.fast_model

    async def _call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        """Make an async LLM call.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response

        Returns:
            Generated text content

        Raises:
            TimeoutError: If LLM call exceeds configured timeout
        """
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete(prompt, max_tokens=max_tokens)

    async def stream_llm(
        self, prompt: str, max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Stream LLM response tokens.

        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens in response

        Yields:
            String tokens as they are generated
        """
        try:
            async for token in self._provider.stream(prompt, max_tokens=max_tokens):
                yield token
        except asyncio.CancelledError:
            # Task was cancelled - clean exit
            pass
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            raise

    async def detect_chapters(self, transcript: str, segments: list[dict], duration: int | None = None) -> list[dict]:
        """Detect logical chapters in transcript."""
        logger.debug(f"detect_chapters: transcript length={len(transcript)} chars")

        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("chapter_detect").format(
            transcript=transcript,
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)

        if result.get("chapters"):
            return result["chapters"]

        # Fallback: single chapter
        return [{
            "title": "Full Video",
            "startSeconds": 0,
            "endSeconds": duration or 0
        }]

    async def summarize_chapter(
        self,
        chapter_text: str,
        title: str,
        has_creator_title: bool = False,
        persona: str = 'standard',
        concept_names: list[str] | None = None,
        extract_concepts: bool = False,
        total_chapters: int | None = None,
        already_extracted_names: list[str] | None = None,
    ) -> dict:
        """Generate dynamic content blocks for a chapter.

        Args:
            chapter_text: The transcript text for this chapter
            title: The chapter title (either creator's chapter title or AI-generated)
            has_creator_title: If True, also generates an explanatory subtitle
            persona: Content persona hint for selecting example files
            concept_names: Concept names for anchoring (backward compat)
            extract_concepts: If True, also extract concepts from this chapter
            total_chapters: Total number of chapters (used with extract_concepts)
            already_extracted_names: Names already extracted from prior chapters

        Returns:
            dict with:
            - "content": array of content blocks with blockId
            - "view": per-chapter view string (e.g., "cooking", "coding")
            - "generatedTitle": optional explanatory subtitle
            - "concepts": list of raw concept dicts (only when extract_concepts=True)
        """
        # Build dynamic prompt parts based on whether we need an explanation title
        if has_creator_title:
            extra_instruction = (
                "Also generate a short explanatory title that describes what the viewer "
                "will learn from this chapter (e.g., 'How to configure authentication' "
                "or 'Understanding the caching strategy')."
            )
            generated_title_field = ',\n  "generatedTitle": "short explanatory title for this chapter"'
        else:
            extra_instruction = ""
            generated_title_field = ""

        logger.debug(f"summarize_chapter: chapter_text length={len(chapter_text)} chars, title='{title}'")

        concepts_anchor = _build_concepts_anchor(concept_names)
        concept_extraction_section, concepts_field, max_tokens = _build_concept_prompt_parts(
            extract_concepts, total_chapters, already_extracted_names,
        )

        # Load unified persona system (Author + Domain Experts)
        persona_system = load_persona_system()
        # Load persona-specific examples (use global persona as hint)
        variant_examples = load_examples(persona)

        prompt = load_prompt("chapter_summary").format(
            title=title,
            content=chapter_text,
            extra_instruction=extra_instruction,
            generated_title_field=generated_title_field,
            persona_system=persona_system,
            variant_examples=variant_examples,
            concepts_anchor=concepts_anchor,
            concept_extraction_section=concept_extraction_section,
            concepts_field=concepts_field,
        )

        # Retry once if LLM returns empty content for non-empty input
        max_attempts = 2 if chapter_text.strip() else 1
        content: list[dict] = []
        result: dict = {"content": []}

        for attempt in range(max_attempts):
            text = await self._call_llm(prompt, max_tokens=max_tokens)
            result = _parse_json_response(text, {"content": []})

            # Ensure content is always an array
            content = result.get("content", [])
            if not isinstance(content, list):
                content = []

            if content or attempt == max_attempts - 1:
                break

            logger.warning(
                "Empty content from LLM for chapter '%s' (%d chars input), retrying...",
                title, len(chapter_text),
            )

        if not content and chapter_text.strip():
            logger.error(
                "LLM returned empty content for chapter '%s' after %d attempts (%d chars input)",
                title, max_attempts, len(chapter_text),
            )

        # Inject blockId into each content block
        content = inject_block_ids(content)

        # Resolve per-chapter view (LLM signal + soft block-inference correction)
        view = _resolve_view(content, result.get("view", ""), title)

        # Log block metrics for analysis
        _log_block_metrics(content, title, persona, view=view)

        response: dict = {
            "content": content,
            "view": view,
            "generatedTitle": result.get("generatedTitle"),
        }

        # Include extracted concepts when requested
        if extract_concepts:
            raw_concepts = result.get("concepts", [])
            if not isinstance(raw_concepts, list):
                raw_concepts = []
            response["concepts"] = raw_concepts

        return response

    async def extract_concepts(self, transcript: str) -> list[dict]:
        """Extract key concepts from transcript."""
        logger.debug(f"extract_concepts: transcript length={len(transcript)} chars")

        prompt = load_prompt("concept_extract").format(
            transcript=transcript
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)
        return result.get("concepts", [])

    async def synthesize_summary(self, sections: list[dict], concepts: list[dict]) -> dict:
        """Generate TLDR and key takeaways."""
        sections_text = "\n".join([
            f"- {s['title']}: {extract_summary_from_content(s.get('content', []))}" for s in sections
        ])
        concepts_text = ", ".join([c["name"] for c in concepts])

        prompt = load_prompt("global_synthesis").format(
            sections=sections_text,
            concepts=concepts_text
        )

        text = await self._call_llm(prompt, max_tokens=1000)
        return _parse_json_response(text, {"tldr": text[:500], "keyTakeaways": []})

    async def process_video(
        self,
        transcript: str,
        segments: list[dict],
        on_progress: Callable[[int, str], None] | None = None
    ) -> dict:
        """Full LLM processing pipeline.

        Args:
            transcript: Cleaned transcript text
            segments: List of transcript segments with timestamps
            on_progress: Optional callback for progress updates

        Returns:
            dict with tldr, key_takeaways, chapters, and concepts
        """
        if on_progress:
            on_progress(10, "Detecting chapters...")

        # 1. Detect chapters
        raw_chapters = await self.detect_chapters(transcript, segments)

        if on_progress:
            on_progress(20, "Extracting concepts...")

        # 2. Extract concepts early so names can be passed to chapter summaries
        raw_concepts = await self.extract_concepts(transcript)
        concepts = build_concept_dicts(raw_concepts)
        concept_names = [c["name"] for c in concepts]

        if on_progress:
            on_progress(30, "Summarizing chapters...")

        # 3. Summarize each chapter (with concept names for anchoring)
        chapters = []
        for i, raw in enumerate(raw_chapters):
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", 0) or (start + 300)

            chapter_segments = [
                s for s in segments
                if start <= s["start"] < end
            ]
            chapter_text = " ".join([s["text"] for s in chapter_segments])

            summary_data = await self.summarize_chapter(
                chapter_text, raw["title"], concept_names=concept_names,
            )

            if not summary_data.get("content"):
                logger.warning(
                    "Dropping chapter %d '%s' — empty content after LLM processing",
                    i, raw["title"],
                )
                continue
            content = summary_data["content"]

            chapter_dict: dict = {
                "id": str(uuid.uuid4()),
                "timestamp": seconds_to_timestamp(start),
                "start_seconds": start,
                "end_seconds": end,
                "title": raw["title"],
                "content": content,
            }
            if summary_data.get("view"):
                chapter_dict["view"] = summary_data["view"]
            chapters.append(chapter_dict)

            if on_progress:
                progress = 30 + int((i + 1) / len(raw_chapters) * 40)
                on_progress(progress, f"Summarizing chapter {i + 1}/{len(raw_chapters)}...")

        if on_progress:
            on_progress(90, "Generating summary...")

        # 4. Synthesize
        synthesis = await self.synthesize_summary(chapters, concepts)

        return {
            "tldr": synthesis.get("tldr", ""),
            "key_takeaways": synthesis.get("keyTakeaways", []),
            "chapters": chapters,
            "concepts": concepts,
        }

    # ========== STREAMING METHODS ==========

    async def _stream_and_parse(
        self, prompt: str, max_tokens: int = 2000
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream LLM response and parse JSON at the end.

        Yields:
            ("token", str) for each token
            ("complete", dict) when done with parsed JSON
        """
        full_response = ""

        async for token in self.stream_llm(prompt, max_tokens):
            full_response += token
            yield ("token", token)

        # Parse the final response
        result = _parse_json_response(full_response)
        yield ("complete", result)

    async def stream_detect_chapters(
        self, transcript: str, segments: list[dict], duration: int | None = None
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream chapter detection with tokens and final result.

        Args:
            transcript: Cleaned transcript text
            segments: List of transcript segments with timestamps
            duration: Video duration in seconds (used to constrain timestamps)

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with detected chapters
        """
        logger.debug(f"stream_detect_chapters: transcript length={len(transcript)} chars")

        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("chapter_detect").format(
            transcript=transcript,
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        result = None
        async for event_type, data in self._stream_and_parse(prompt):
            if event_type == "token":
                yield (event_type, data)
            else:
                result = data

        # Process the result (type guard for dict access)
        if isinstance(result, dict) and result.get("chapters"):
            chapters = result["chapters"]
        else:
            # Fallback: single chapter
            chapters = [{
                "title": "Full Video",
                "startSeconds": 0,
                "endSeconds": duration or 0
            }]

        yield ("complete", chapters)

    async def stream_summarize_chapter(
        self,
        chapter_text: str,
        title: str,
        persona: str = 'standard',
        concept_names: list[str] | None = None,
        extract_concepts: bool = False,
        total_chapters: int | None = None,
        already_extracted_names: list[str] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream chapter summary with tokens and final result.

        Args:
            chapter_text: The transcript text for this chapter
            title: The chapter title
            persona: Content persona hint for selecting example files
            concept_names: Optional list of concept names for anchoring
            extract_concepts: If True, also extract concepts from this chapter
            total_chapters: Total number of chapters (used with extract_concepts)
            already_extracted_names: Names already extracted from prior chapters

        Yields:
            ("token", str) for each token
            ("complete", dict) with content blocks (with blockId), view, and optional concepts
        """
        logger.debug(f"stream_summarize_chapter: chapter_text length={len(chapter_text)} chars, title='{title}'")

        concepts_anchor = _build_concepts_anchor(concept_names)
        concept_extraction_section, concepts_field, max_tokens = _build_concept_prompt_parts(
            extract_concepts, total_chapters, already_extracted_names,
        )

        # Load unified persona system (Author + Domain Experts)
        persona_system = load_persona_system()
        variant_examples = load_examples(persona)

        prompt = load_prompt("chapter_summary").format(
            title=title,
            content=chapter_text,
            extra_instruction="",
            generated_title_field="",
            persona_system=persona_system,
            variant_examples=variant_examples,
            concepts_anchor=concepts_anchor,
            concept_extraction_section=concept_extraction_section,
            concepts_field=concepts_field,
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=max_tokens):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Ensure we have required fields (type guard for dict)
                if isinstance(data, dict):
                    content = data.get("content", [])
                    if not isinstance(content, list):
                        content = []
                    # Inject blockId into each content block
                    content = inject_block_ids(content)

                    # Resolve per-chapter view (LLM signal + soft block-inference correction)
                    view = _resolve_view(content, data.get("view", ""), title)

                    _log_block_metrics(content, title, persona, view=view)
                    summary_data: dict[str, Any] = {
                        "content": content,
                        "view": view,
                    }

                    # Include extracted concepts when requested
                    if extract_concepts:
                        raw_concepts = data.get("concepts", [])
                        if not isinstance(raw_concepts, list):
                            raw_concepts = []
                        summary_data["concepts"] = raw_concepts
                else:
                    summary_data = {"content": [], "view": "standard"}
                yield ("complete", summary_data)

    async def stream_extract_concepts(
        self, transcript: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream concept extraction with tokens and final result.

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with concepts
        """
        logger.debug(f"stream_extract_concepts: transcript length={len(transcript)} chars")

        prompt = load_prompt("concept_extract").format(
            transcript=transcript
        )

        async for event_type, data in self._stream_and_parse(prompt):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    concepts = data.get("concepts", [])
                else:
                    concepts = []
                yield ("complete", concepts)

    async def stream_synthesize_summary(
        self, sections: list[dict], concepts: list[dict]
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream TLDR and key takeaways synthesis.

        Yields:
            ("token", str) for each token
            ("complete", dict) with tldr and keyTakeaways
        """
        sections_text = "\n".join([
            f"- {s['title']}: {s.get('summary', '')}" for s in sections
        ])
        concepts_text = ", ".join([c["name"] for c in concepts])

        prompt = load_prompt("global_synthesis").format(
            sections=sections_text,
            concepts=concepts_text
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=1000):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    result = {
                        "tldr": data.get("tldr", ""),
                        "keyTakeaways": data.get("keyTakeaways", [])
                    }
                else:
                    result = {"tldr": "", "keyTakeaways": []}
                yield ("complete", result)

    async def stream_quick_synthesis(
        self, transcript: str, duration: int
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream quick TLDR directly from transcript (no sections needed).

        This runs BEFORE section detection for faster UX.

        Yields:
            ("token", str) for each token
            ("complete", dict) with tldr and keyTakeaways
        """
        logger.debug(f"stream_quick_synthesis: transcript length={len(transcript)} chars")

        duration_formatted = f"{duration // 60}:{duration % 60:02d}"

        prompt = load_prompt("quick_synthesis").format(
            transcript=transcript,
            duration_formatted=duration_formatted,
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=800):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    result = {
                        "tldr": data.get("tldr", ""),
                        "keyTakeaways": data.get("keyTakeaways", [])
                    }
                else:
                    result = {"tldr": "", "keyTakeaways": []}
                yield ("complete", result)

    async def generate_metadata_tldr(
        self,
        title: str,
        description: str,
        chapter_titles: list[str],
    ) -> dict:
        """Generate TLDR from metadata only (no transcript needed).

        This is a fast method (~2-3 sec) that generates a summary based on:
        - Video title
        - First 500 chars of description
        - Chapter titles (if available)

        Used in parallel processing to provide quick TLDR while sections
        are being processed.

        Args:
            title: Video title
            description: Video description (will be truncated)
            chapter_titles: List of chapter names

        Returns:
            dict with "tldr" and "keyTakeaways"
        """
        # Format chapters for prompt
        if chapter_titles:
            chapters_text = "\n".join([f"- {ch}" for ch in chapter_titles])
        else:
            chapters_text = "Not available"

        prompt = load_prompt("metadata_tldr").format(
            title=title,
            description=description[:500] if description else "Not available",
            chapters=chapters_text,
        )

        text = await self._call_llm(prompt, max_tokens=500)
        result = _parse_json_response(text, {"tldr": "", "keyTakeaways": []})

        return {
            "tldr": result.get("tldr", ""),
            "keyTakeaways": result.get("keyTakeaways", [])
        }

    async def generate_master_summary(
        self,
        title: str,
        channel: str,
        duration: int,
        persona: str,
        tldr: str,
        key_takeaways: list[str],
        chapters: list[dict],
        concepts: list[dict],
    ) -> str:
        """Generate comprehensive master summary from all video data.

        This is the final summarization step that synthesizes all processed
        data into a dense, AI-optimized knowledge document.

        Args:
            title: Video title
            channel: Channel name
            duration: Video duration in seconds
            persona: Content persona ('code', 'recipe', 'standard', etc.)
            tldr: Current TLDR text
            key_takeaways: List of key takeaways
            chapters: List of processed chapters with content blocks
            concepts: List of extracted concepts with definitions

        Returns:
            Markdown string containing the master summary (500-800 words)
        """
        # Sanitize inputs to prevent prompt injection and resource exhaustion
        title = _sanitize_llm_input(title, max_length=500)
        channel = _sanitize_llm_input(channel, max_length=200)
        tldr = _sanitize_llm_input(tldr, max_length=2000)

        # Validate persona against whitelist (already validated in load_persona but double-check)
        if persona not in VALID_PERSONAS:
            persona = "standard"

        # Format duration
        mins = duration // 60
        secs = duration % 60
        duration_formatted = f"{mins}:{secs:02d}"

        # Format key takeaways (sanitize each)
        if key_takeaways:
            sanitized_takeaways = [_sanitize_llm_input(t, max_length=500) for t in key_takeaways[:20]]
            takeaways_text = "\n".join([f"• {t}" for t in sanitized_takeaways])
        else:
            takeaways_text = "Not available"

        # Format chapters - include title, summary, and key bullets (limit to 30 chapters max)
        chapters_parts = []
        for i, chapter in enumerate(chapters[:30], 1):
            chapter_title = _sanitize_llm_input(chapter.get("title", f"Chapter {i}"), max_length=200)
            # Extract summary and bullets from content blocks on-demand
            chapter_content = chapter.get("content", [])
            chapter_summary = _sanitize_llm_input(extract_summary_from_content(chapter_content), max_length=1000)
            chapter_bullets = extract_bullets_from_content(chapter_content)

            part = f"### {chapter_title}\n{chapter_summary}"
            if chapter_bullets:
                sanitized_bullets = [_sanitize_llm_input(b, max_length=300) for b in chapter_bullets[:5]]
                bullets_text = "\n".join([f"  - {b}" for b in sanitized_bullets])
                part += f"\n{bullets_text}"
            chapters_parts.append(part)

        chapters_detailed = "\n\n".join(chapters_parts) if chapters_parts else "No chapters available"

        # Format concepts (limit to 20 concepts max)
        if concepts:
            concepts_parts = []
            for c in concepts[:20]:
                name = _sanitize_llm_input(c.get("name", "Unknown"), max_length=100)
                definition = _sanitize_llm_input(c.get("definition", ""), max_length=500)
                if definition:
                    concepts_parts.append(f"• **{name}**: {definition}")
                else:
                    concepts_parts.append(f"• **{name}**")
            concepts_detailed = "\n".join(concepts_parts)
        else:
            concepts_detailed = "No key concepts extracted"

        prompt = load_prompt("master_summary").format(
            title=title,
            channel=channel or "Unknown",
            duration_formatted=duration_formatted,
            persona=persona,
            tldr=tldr or "Not available",
            key_takeaways=takeaways_text,
            chapters_detailed=chapters_detailed,
            concepts_detailed=concepts_detailed,
        )

        # Use higher max_tokens for comprehensive summary
        text = await self._call_llm(prompt, max_tokens=2000)

        # Validate output length (expected 500-800 words ≈ 3000-5000 chars, cap at 15000)
        result = text.strip()
        max_output_length = 15000
        if len(result) > max_output_length:
            logger.warning(f"Master summary truncated from {len(result)} to {max_output_length} chars")
            result = result[:max_output_length]

        return result
