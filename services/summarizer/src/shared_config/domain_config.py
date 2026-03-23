"""Domain configuration — reads from the shared domains.json.

Resolves path via:
  1. Docker mount: /app/shared/domains.json
  2. Local dev: ../../packages/shared/src/config/domains.json (relative to repo root)
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Possible locations for domains.json
_DOCKER_PATH = Path("/app/shared/domains.json")
_LOCAL_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "packages" / "shared" / "src" / "config" / "domains.json"


@lru_cache(maxsize=1)
def _load_config() -> dict:
    """Load and cache the domain configuration."""
    for path in (_DOCKER_PATH, _LOCAL_PATH):
        if path.exists():
            logger.debug("Loading domain config from %s", path)
            return json.loads(path.read_text())

    raise FileNotFoundError(
        f"domains.json not found at {_DOCKER_PATH} or {_LOCAL_PATH}"
    )


def get_config() -> dict:
    """Get the full domain configuration dict."""
    return _load_config()


# ─────────────────────────────────────────────────────
# Derived sets (for validation)
# ─────────────────────────────────────────────────────

def valid_content_tags() -> frozenset[str]:
    """All valid content tag names."""
    return frozenset(get_config()["domains"].keys())


def valid_modifiers() -> frozenset[str]:
    """All valid modifier names."""
    return frozenset(get_config()["modifiers"].keys())


def valid_components() -> frozenset[str]:
    """All valid component names from domains.json top-level components array."""
    return frozenset(get_config()["components"])


# ─────────────────────────────────────────────────────
# Category mapping
# ─────────────────────────────────────────────────────

def map_category_to_tag(category: str) -> str:
    """Map a raw category name to a content tag."""
    category_map = get_config()["categoryMap"]
    return category_map.get(category.lower(), "learning")


# ─────────────────────────────────────────────────────
# Tab helpers
# ─────────────────────────────────────────────────────

def get_default_tab_ids(tag: str) -> list[str]:
    """Get the ordered default tab IDs for a domain."""
    domains = get_config()["domains"]
    domain = domains.get(tag, domains.get("learning", {}))
    return [t["id"] for t in domain.get("defaultTabs", []) if isinstance(t, dict) and "id" in t]


def get_tab_meta(tab_id: str) -> tuple[str, str] | None:
    """Get (label, emoji) for a tab ID. Searches defaultTabs across all domains."""
    cfg = get_config()
    for domain in cfg["domains"].values():
        for tab in domain.get("defaultTabs", []):
            if isinstance(tab, dict) and tab.get("id") == tab_id:
                return (tab.get("label", tab_id), tab.get("emoji", ""))
    return None


def get_enrichment_map() -> dict[str, str]:
    """Map of content tag → enrichment prompt filename.

    Only tags listed here trigger the enrichment stage.
    """
    return dict(get_config().get("enrichment", {}))


def build_fallback_tabs(tag: str) -> list[dict]:
    """Build default TabDefinition dicts for a domain.

    Returns complete objects directly from domains.json defaultTabs.
    """
    cfg = get_config()
    domain = cfg["domains"].get(tag, cfg["domains"].get("learning", {}))
    return list(domain.get("defaultTabs", []))
