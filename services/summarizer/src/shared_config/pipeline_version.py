"""Canonical PIPELINE_VERSION — reads from the shared pipeline-version.json.

Single source of truth shared with the api gateway (which feeds it into
idempotency hashes, videoSummaryCache.dedupKey, and the stale-doc regen
check). The summarizer feeds it into the Redis response-cache key namespace
and stamps it on every persisted Mongo summary doc.

Resolves path via:
  1. Docker mount: /app/shared/pipeline-version.json
  2. Local dev: packages/shared/src/config/pipeline-version.json (repo root)
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_DOCKER_PATH = Path("/app/shared/pipeline-version.json")
_LOCAL_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "packages"
    / "shared"
    / "src"
    / "config"
    / "pipeline-version.json"
)


@lru_cache(maxsize=1)
def get_pipeline_version() -> str:
    """Load and cache the canonical pipeline version string (e.g. "v6")."""
    for path in (_DOCKER_PATH, _LOCAL_PATH):
        if path.exists():
            logger.debug("Loading pipeline version from %s", path)
            return json.loads(path.read_text())["version"]

    raise FileNotFoundError(f"pipeline-version.json not found at {_DOCKER_PATH} or {_LOCAL_PATH}")
