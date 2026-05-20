#!/usr/bin/env python3
"""Run the pipeline against the golden dataset and score the output.

Phases:

1. Load ``dev/golden-dataset/videos.yaml``.
2. For each entry, invoke the summarizer pipeline live (HTTP call to
   ``http://localhost:3000/api/videos``) OR — when ``--dry-run`` is set —
   simulate with a stub run.
3. Score each result against the entry's expectations:
     - tabCount         within ±1 of expected
     - components       every requiredComponent appears
     - keyContent       ≥80% of expected terms appear in the assembled tabs
     - emptyTabs        no tab has an empty required list (assembled props ok)
4. Write ``reports/eval-{timestamp}.csv`` and ``.md``.
5. Optionally publish a dataset run to Langfuse so the dashboards reflect
   the new baseline.

Usage::

    # Local — talks to a running vie-api at http://localhost:3000
    python3 scripts/run_eval.py --output reports/

    # Dry-run — exercises the scoring logic without making network calls
    python3 scripts/run_eval.py --dry-run

Acceptance threshold for CI gating::

    --fail-under 0.7      Exit non-zero when average score < 0.7
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("run_eval")

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DATASET_PATH = _REPO_ROOT / "dev" / "golden-dataset" / "videos.yaml"

# Golden dataset entries must point at YouTube only. Without this guard a
# malicious PR could swap a URL to an internal host and the eval would
# happily POST it to vie-api — a low-impact SSRF vector that we cut off
# at the script layer.
_ALLOWED_VIDEO_HOSTS: frozenset[str] = frozenset({
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
})


def _is_allowed_video_url(url: str) -> bool:
    """Return ``True`` when ``url`` is an https YouTube URL."""
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    return host in _ALLOWED_VIDEO_HOSTS


# ─── Loading ───────────────────────────────────────────────────────────
def load_dataset(path: Path = _DATASET_PATH) -> list[dict[str, Any]]:
    try:
        import yaml  # type: ignore
    except ImportError:
        sys.exit("PyYAML is required: pip install pyyaml")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data.get("videos", []) if isinstance(data, dict) else []


# ─── Result + scoring ──────────────────────────────────────────────────
@dataclass
class EvalResult:
    id: str
    domain: str
    tab_count: int
    expected_tab_count: int
    tab_count_score: float
    component_coverage: float
    content_coverage: float
    empty_tab_count: int
    overall: float
    notes: str = ""


def _flatten_text(tabs: list[dict[str, Any]]) -> str:
    """Concat all text-ish strings in the assembled tabs into one searchable blob."""
    out: list[str] = []
    for tab in tabs:
        out.append(str(tab.get("label", "")))
        props = tab.get("props", {})
        if isinstance(props, dict):
            out.append(json.dumps(props, default=str))
    return " ".join(out).lower()


def score_entry(expected: dict[str, Any], actual: dict[str, Any]) -> EvalResult:
    """Score one assembled response against its golden expectations.

    Tolerant of partial data — every sub-score caps at ``1.0`` even when the
    expected list is empty, so missing fields don't depress the overall.
    """
    tabs = actual.get("tabs", []) or []
    tab_count = len(tabs)

    expected_tabs: list[str] = expected.get("expectedTabs") or []
    expected_components: list[str] = expected.get("requiredComponents") or []
    expected_content: list[str] = expected.get("keyContent") or []

    # 1) Tab count within ±1
    expected_count = len(expected_tabs)
    delta = abs(tab_count - expected_count)
    tab_count_score = max(0.0, 1.0 - delta * 0.25)

    # 2) Component coverage
    actual_components = {str(t.get("component", "")).lower() for t in tabs}
    if expected_components:
        hit = sum(1 for c in expected_components if c.lower() in actual_components)
        component_coverage = hit / len(expected_components)
    else:
        component_coverage = 1.0

    # 3) Content keyword coverage (case-insensitive substring)
    blob = _flatten_text(tabs)
    if expected_content:
        hit = sum(1 for term in expected_content if term.lower() in blob)
        content_coverage = hit / len(expected_content)
    else:
        content_coverage = 1.0

    # 4) Empty tab count (data-quality signal; uses presence of any 'data'
    #    or 'items' list — kept loose so it doesn't false-positive on
    #    overview tabs that are intentionally short).
    empty = 0
    for tab in tabs:
        props = tab.get("props", {}) or {}
        if not isinstance(props, dict):
            continue
        for key in ("items", "data", "rows", "questions", "cards"):
            value = props.get(key)
            if isinstance(value, list) and len(value) == 0:
                empty += 1
                break

    overall = round(
        (tab_count_score * 0.2)
        + (component_coverage * 0.4)
        + (content_coverage * 0.3)
        + (max(0.0, 1.0 - 0.1 * empty) * 0.1),
        3,
    )

    return EvalResult(
        id=expected.get("id", "unknown"),
        domain=expected.get("domain", "unknown"),
        tab_count=tab_count,
        expected_tab_count=expected_count,
        tab_count_score=round(tab_count_score, 3),
        component_coverage=round(component_coverage, 3),
        content_coverage=round(content_coverage, 3),
        empty_tab_count=empty,
        overall=overall,
    )


# ─── Pipeline invocation ───────────────────────────────────────────────
async def _run_pipeline(api_url: str, url: str) -> dict[str, Any]:
    """POST to the local vie-api and consume the SSE stream until ``complete``.

    Returns the assembled response dict (``meta`` + ``tabs``). Raises on
    HTTP errors so the caller can short-circuit the eval row.
    """
    import httpx

    async with httpx.AsyncClient(timeout=600.0) as client:
        resp = await client.post(f"{api_url}/api/videos", json={"url": url})
        resp.raise_for_status()
        body = resp.json()
        video_summary_id = body.get("videoSummaryId") or body.get("id")
        if not video_summary_id:
            raise RuntimeError(f"No videoSummaryId in response: {body}")

        # Poll the GET endpoint until status==completed (simpler than parsing SSE).
        for _ in range(120):
            await asyncio.sleep(5)
            r = await client.get(f"{api_url}/api/videos/{video_summary_id}")
            if r.status_code == 404:
                continue
            data = r.json()
            if data.get("status") == "completed":
                return {
                    "meta": data.get("meta") or data.get("assembledMeta") or {},
                    "tabs": data.get("tabs") or data.get("assembledTabs") or [],
                }
        raise TimeoutError(f"Video {video_summary_id} did not complete within 10 min")


def _stub_actual(expected: dict[str, Any]) -> dict[str, Any]:
    """Produce a stub assembled response for ``--dry-run``.

    The stub returns exactly what the expectations want, so dry-run smoke-
    tests the scoring code path without making any network calls.
    """
    tabs = []
    for tab_id, component in zip(
        expected.get("expectedTabs", []),
        expected.get("requiredComponents", []) + ["overview"] * 10,
        strict=False,
    ):
        tabs.append({
            "id": tab_id,
            "label": tab_id.replace("_", " ").title(),
            "component": component,
            "props": {"items": [{"text": term} for term in expected.get("keyContent", [])]},
        })
    return {"meta": {"language": expected.get("language", "en")}, "tabs": tabs}


# ─── Reporting ─────────────────────────────────────────────────────────
def write_reports(results: list[EvalResult], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    csv_path = out_dir / f"eval-{ts}.csv"
    md_path = out_dir / f"eval-{ts}.md"

    with csv_path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(asdict(results[0]).keys()))
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))

    avg = sum(r.overall for r in results) / max(1, len(results))
    md_lines = [
        f"# Eval Report — {ts}",
        "",
        f"**Average overall:** {avg:.3f} (n={len(results)})",
        "",
        "| id | domain | tabs (got/exp) | components | content | empty | overall |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda x: x.overall):
        md_lines.append(
            f"| {r.id} | {r.domain} | {r.tab_count}/{r.expected_tab_count} | "
            f"{r.component_coverage:.2f} | {r.content_coverage:.2f} | "
            f"{r.empty_tab_count} | **{r.overall:.3f}** |"
        )
    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return csv_path, md_path


# ─── Optional Langfuse dataset run ─────────────────────────────────────
def post_to_langfuse(results: list[EvalResult], run_name: str) -> None:
    public = os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret = os.environ.get("LANGFUSE_SECRET_KEY")
    if not public or not secret:
        logger.info("Langfuse keys not set — skipping run upload")
        return
    try:
        from langfuse import Langfuse  # type: ignore
    except ImportError:
        logger.warning("Langfuse SDK not installed — skipping run upload")
        return
    host = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
    client = Langfuse(public_key=public, secret_key=secret, host=host)

    for r in results:
        try:
            client.create_dataset_run_item(
                run_name=run_name,
                dataset_item_id=r.id,
                metadata=asdict(r),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Run upload failed for %s: %s", r.id, exc)


# ─── Entry point ───────────────────────────────────────────────────────
async def _run_all(args) -> int:
    records = load_dataset()
    if args.filter:
        records = [r for r in records if args.filter in r.get("id", "")]
    if args.limit:
        records = records[: args.limit]
    logger.info("Running eval on %d entries (dry_run=%s)", len(records), args.dry_run)

    results: list[EvalResult] = []
    for rec in records:
        rid = rec.get("id", "?")
        url = rec.get("url", "")
        if not args.dry_run and not _is_allowed_video_url(url):
            logger.warning("Skipping %s — url %r is not an allowed YouTube host", rid, url)
            results.append(EvalResult(
                id=rid, domain=rec.get("domain", "?"),
                tab_count=0, expected_tab_count=len(rec.get("expectedTabs") or []),
                tab_count_score=0.0, component_coverage=0.0, content_coverage=0.0,
                empty_tab_count=0, overall=0.0, notes="rejected URL host",
            ))
            continue
        try:
            actual = _stub_actual(rec) if args.dry_run else await _run_pipeline(args.api_url, url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Pipeline failed for %s: %s", rid, exc)
            results.append(EvalResult(
                id=rid, domain=rec.get("domain", "?"),
                tab_count=0, expected_tab_count=len(rec.get("expectedTabs") or []),
                tab_count_score=0.0, component_coverage=0.0, content_coverage=0.0,
                empty_tab_count=0, overall=0.0, notes=str(exc)[:200],
            ))
            continue
        results.append(score_entry(rec, actual))

    csv_path, md_path = write_reports(results, Path(args.output))
    avg = sum(r.overall for r in results) / max(1, len(results))
    logger.info("Wrote %s and %s (avg=%.3f)", csv_path, md_path, avg)

    if args.publish_run:
        post_to_langfuse(results, args.publish_run)

    if args.fail_under and avg < args.fail_under:
        logger.error("Average %.3f below --fail-under threshold %.3f", avg, args.fail_under)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://localhost:3000")
    parser.add_argument("--output", default="reports/")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--filter", default="")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--fail-under", type=float, default=0.0)
    parser.add_argument("--dataset-name", default="vie-golden-v1")
    parser.add_argument("--publish-run", default="",
                        help="Run name to publish to Langfuse (empty = skip).")
    args = parser.parse_args()
    return asyncio.run(_run_all(args))


if __name__ == "__main__":
    raise SystemExit(main())
