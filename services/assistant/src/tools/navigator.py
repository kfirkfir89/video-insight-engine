"""Navigator tool — find tabs, sections, or timestamps in a video."""

from __future__ import annotations

from difflib import SequenceMatcher

from src.logging_config import get_logger
from src.repositories.video_repository import MongoVideoRepository, VideoContext

logger = get_logger(__name__)

_MIN_RELEVANCE_SCORE = 0.3


class NavigatorTool:
    """Find specific tabs, sections, or timestamps in the video."""

    name = "navigator"
    description = "Find specific tabs, sections, or timestamps in the video"

    def __init__(self, video_repo: MongoVideoRepository) -> None:
        self._video_repo = video_repo

    async def execute(self, params: dict, context: dict) -> dict:
        """Search through video tabs for matching content.

        Args:
            params: Must contain ``query`` (str).
            context: Must contain ``video_ctx`` (VideoContext).

        Returns:
            Dict with ``matches`` list of tab matches sorted by relevance.
        """
        query: str = params["query"]
        video_ctx: VideoContext = context["video_ctx"]

        logger.info("navigator_search", query=query[:80], tab_count=len(video_ctx.tabs))

        matches = _find_matching_tabs(query, video_ctx.tabs)

        logger.info("navigator_complete", match_count=len(matches))
        return {"matches": matches}


def _find_matching_tabs(query: str, tabs: list[dict]) -> list[dict]:
    """Score and rank tabs by fuzzy relevance to the query."""
    query_lower = query.lower()
    scored: list[tuple[float, dict]] = []

    for tab in tabs:
        score = _score_tab(query_lower, tab)
        if score >= _MIN_RELEVANCE_SCORE:
            scored.append((score, tab))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "tab_id": tab.get("id", ""),
            "label": tab.get("label", ""),
            "emoji": tab.get("emoji", ""),
            "relevance": _relevance_label(score),
        }
        for score, tab in scored[:5]
    ]


def _score_tab(query: str, tab: dict) -> float:
    """Compute a relevance score for a tab against a query.

    Combines label matching, id matching, and props content matching.
    """
    label = (tab.get("label") or "").lower()
    tab_id = (tab.get("id") or "").lower()

    # Direct substring match gets a high base score
    if query in label or query in tab_id:
        return 0.9

    # Fuzzy match on label
    label_ratio = SequenceMatcher(None, query, label).ratio()

    # Check props for keyword matches
    props_score = _score_props(query, tab.get("props", {}))

    return max(label_ratio, props_score)


def _score_props(query: str, props: dict) -> float:
    """Score tab props content against the query."""
    if not props:
        return 0.0

    # Search through string values in props for keyword overlap
    query_words = set(query.split())
    if not query_words:
        return 0.0

    text_blob = _extract_text_from_props(props).lower()
    if not text_blob:
        return 0.0

    matching_words = sum(1 for w in query_words if w in text_blob)
    return min(matching_words / len(query_words), 0.85)


def _extract_text_from_props(props: dict, max_depth: int = 2) -> str:
    """Recursively extract string values from props for text search."""
    if max_depth <= 0:
        return ""
    parts: list[str] = []
    for value in props.values():
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            for item in value[:20]:  # Cap to avoid huge lists
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    parts.append(_extract_text_from_props(item, max_depth - 1))
        elif isinstance(value, dict):
            parts.append(_extract_text_from_props(value, max_depth - 1))
    return " ".join(parts)


def _relevance_label(score: float) -> str:
    """Map a numeric score to a human-readable relevance label."""
    if score >= 0.8:
        return "high"
    if score >= 0.5:
        return "medium"
    return "low"
