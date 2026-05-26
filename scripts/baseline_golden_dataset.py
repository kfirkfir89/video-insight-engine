#!/usr/bin/env python3
"""Regenerate ``dev/golden-dataset/videos.yaml`` from current pipeline output.

For each picked video, the script:
  1. POSTs to the API (auth via the eval user — reused from run_eval).
  2. Polls until the pipeline completes.
  3. Pulls the actual tab IDs and component names out of the response.
  4. Derives keyContent terms from the video metadata so the scorer's
     content_coverage check has something realistic to match against.
  5. Writes the result back to videos.yaml as the new spec.

This is the "baseline-as-snapshot" workflow: future eval runs score against
what the pipeline CURRENTLY produces, so any change to extraction/synthesis/
assembly that would alter the output shape will surface as a score drop.

Run from inside the summarizer container so the API is reachable on the
in-cluster hostname:

    docker compose exec vie-summarizer python scripts/baseline_golden_dataset.py \\
        --api-url http://vie-api:3000

Then run the eval against the same IDs and expect scores ≈ 1.0 — that proves
the loop is wired correctly end-to-end:

    docker compose exec vie-summarizer python scripts/run_eval.py \\
        --api-url http://vie-api:3000 \\
        --filter food-knife-skills,tech-react-hooks,language-spanish-basics,narrative-mt-everest-1996,fitness-pushup-form
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
import sys
from pathlib import Path
from typing import Any

import yaml

# Reuse the helpers already shipped in run_eval — single source of truth for
# auth + pipeline polling logic.
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts"))
from run_eval import authenticate, load_dataset, run_pipeline  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("baseline_golden_dataset")

_DATASET_PATH = _REPO_ROOT / "dev" / "golden-dataset" / "videos.yaml"

# Default selection: 5 videos covering the categories the user picked.
# - tech / food / language are obvious by id prefix.
# - narrative-* tends to be long-form (documentaries) — best ">60min proxy"
#   from the current dataset (existing entries are all <30min per the header
#   comment in videos.yaml, so swap this entry for a real >60min URL if you
#   have one).
# - fitness-* tutorials are typically <10min — short-form proxy.
_DEFAULT_IDS = [
    "tech-react-hooks",
    "food-knife-skills",
    "language-spanish-basics",
    "narrative-mt-everest-1996",
    "fitness-pushup-form",
]


def _derive_key_content(meta: dict[str, Any], tabs: list[dict[str, Any]]) -> list[str]:
    """Pull 5 distinctive lowercase terms from the pipeline's own output.

    Sourced from ``meta.title`` first (most likely to appear in assembled
    tab text) with tab labels as a fallback. Drops 1-3 letter tokens and
    common stop-ish words so the resulting list is actually signal.
    """
    stop = {"the", "and", "for", "with", "from", "this", "that", "your", "you", "are", "how", "why", "what"}
    candidates: list[str] = []

    def _tokens(text: str) -> list[str]:
        cleaned = re.sub(r"[^a-zA-Z0-9\s\-']", " ", text).lower()
        return [w for w in cleaned.split() if len(w) >= 4 and w not in stop]

    title = meta.get("title") or ""
    candidates.extend(_tokens(title))
    for tab in tabs:
        label = tab.get("label") or ""
        candidates.extend(_tokens(label))

    # De-dup preserving order; take top 5 — keeps content_coverage ≥80% easy
    # to hit while still being a real signal.
    seen: set[str] = set()
    out: list[str] = []
    for tok in candidates:
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
        if len(out) >= 5:
            break
    return out


def _build_baseline_record(rec: dict[str, Any], actual: dict[str, Any]) -> dict[str, Any]:
    """Convert a pipeline response into a videos.yaml entry."""
    tabs = actual.get("tabs") or []
    meta = actual.get("meta") or {}

    expected_tabs = [t["id"] for t in tabs if t.get("id")]
    # Dedup components while preserving first-seen order.
    components: list[str] = []
    for t in tabs:
        comp = t.get("component")
        if comp and comp not in components:
            components.append(comp)

    return {
        "id": rec["id"],
        "url": rec["url"],
        "domain": rec.get("domain", "unknown"),
        "format": rec.get("format", "unknown"),
        "language": rec.get("language", "en"),
        "expectedTabs": expected_tabs,
        "requiredComponents": components,
        "keyContent": _derive_key_content(meta, tabs),
    }


def _load_existing_records() -> dict[str, dict[str, Any]]:
    """Return ``{id: record}`` from videos.yaml, or ``{}`` when the file is absent.

    The dataset is gitignored (it can be regenerated locally and varies per
    developer), so a fresh clone won't have it. We treat absence as "no IDs
    to refresh against" — the caller logs a clear message and exits cleanly
    rather than crashing with FileNotFoundError.
    """
    if not _DATASET_PATH.exists():
        return {}
    return {r["id"]: r for r in load_dataset()}


async def _capture(api_url: str, ids: list[str]) -> list[dict[str, Any]]:
    existing = _load_existing_records()
    if not existing:
        logger.error(
            "Dataset not found at %s. Run `docker compose exec vie-summarizer "
            "python scripts/build_golden_dataset.py` first, or seed the file by "
            "hand. This script refreshes existing entries — it does not invent "
            "URLs from --ids alone.",
            _DATASET_PATH,
        )
        return []
    missing = [vid for vid in ids if vid not in existing]
    if missing:
        logger.warning("Unknown ids (not in videos.yaml, will skip): %s", missing)

    token = await authenticate(api_url)
    captured: list[dict[str, Any]] = []
    for vid in ids:
        rec = existing.get(vid)
        if rec is None:
            continue
        logger.info("Processing %s (%s) ...", vid, rec["url"])
        try:
            actual = await run_pipeline(api_url, rec["url"], token)
        except Exception as exc:  # noqa: BLE001 — log and continue for any pipeline failure
            logger.error("  failed: %s", exc)
            continue
        captured.append(_build_baseline_record(rec, actual))
        logger.info(
            "  captured %d tabs, %d components, %d keyContent terms",
            len(captured[-1]["expectedTabs"]),
            len(captured[-1]["requiredComponents"]),
            len(captured[-1]["keyContent"]),
        )
    return captured


def _write_yaml(records: list[dict[str, Any]], output: Path) -> None:
    header = (
        "# Golden dataset — auto-generated baseline from current pipeline output.\n"
        "# Regenerate with: python scripts/baseline_golden_dataset.py\n"
        "# Eval against this baseline: python scripts/run_eval.py --filter <id>\n"
        "#\n"
        "# Schema:\n"
        "#   id, url, domain, format, language        — video identity\n"
        "#   expectedTabs                              — tab ids the pipeline emitted\n"
        "#   requiredComponents                        — component names that must appear\n"
        "#   keyContent                                — terms expected in assembled output\n"
    )
    body = yaml.safe_dump({"videos": records}, sort_keys=False, default_flow_style=None)
    output.write_text(header + "\n" + body)
    logger.info("Wrote %d baseline entries → %s", len(records), output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://localhost:3000")
    parser.add_argument(
        "--ids", default=",".join(_DEFAULT_IDS),
        help="Comma-separated dataset ids to capture (default: the 5-video baseline set).",
    )
    parser.add_argument(
        "--output", default=str(_DATASET_PATH),
        help="Path to write the regenerated videos.yaml (default: dev/golden-dataset/videos.yaml).",
    )
    args = parser.parse_args()

    ids = [s.strip() for s in args.ids.split(",") if s.strip()]
    captured = asyncio.run(_capture(args.api_url, ids))
    if not captured:
        logger.error("No videos were captured successfully — refusing to overwrite videos.yaml")
        return 1
    _write_yaml(captured, Path(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
