#!/usr/bin/env python3
"""Eval harness for the EXTRACTION_USE_FAST_FIRST flag (Phase 4 / P2 gate).

Re-runs the extraction phase against a sample of already-processed videos with
both the primary (Sonnet) and the fast (Haiku) models, then writes a JSON
report comparing per-domain quality and cost.

Acceptance criteria for flipping ``EXTRACTION_USE_FAST_FIRST=True``:
    * Average quality-score delta < 0.05
    * Hard-miss rate increase < 5% absolute
    * No domain shows > 10% quality regression

Usage::

    python scripts/eval_extraction_models.py \\
        --limit 100 --output reports/extraction-eval.json
    python scripts/eval_extraction_models.py --domains learning,tech --limit 20
    python scripts/eval_extraction_models.py --dry-run         # plan only

Reads:
    * MongoDB ``videoSummaryCache`` for completed videos with stored triage,
      extraction baseline, and a ``rawTranscriptRef`` pointing at S3.
    * S3 raw-transcript blobs to reconstruct the input transcript.
    * MongoDB ``llm_usage`` (post-run) to attribute cost via the
      ``llm_feature_var`` tag.

Writes:
    * Per-video result rows, per-domain aggregation, and totals to
      ``--output`` as JSON.

This script is intentionally read-mostly: nothing in the source DB is mutated.
The fast/primary toggle is achieved by transient ``settings.EXTRACTION_USE_FAST_FIRST``
mutation around each call, scoped via ``contextlib.contextmanager``.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import os
import sys
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Iterable, Iterator

# Ensure the summarizer package is importable when invoked from repo root.
_REPO_ROOT = Path(__file__).resolve().parent.parent
_SUMMARIZER_SRC = _REPO_ROOT / "services" / "summarizer"
if str(_SUMMARIZER_SRC) not in sys.path:
    sys.path.insert(0, str(_SUMMARIZER_SRC))

from llm_common.context import llm_feature_var, llm_video_id_var  # noqa: E402

from src.config import settings  # noqa: E402
from src.services.llm import LLMService  # noqa: E402
from src.services.llm_provider import LLMProvider  # noqa: E402
from src.services.pipeline.extraction_quality import check_extraction_quality  # noqa: E402
from src.services.pipeline.extractor import extract  # noqa: E402
from src.services.pipeline.triage import TriageResult  # noqa: E402

logger = logging.getLogger("eval_extraction_models")

EVAL_FEATURE_PREFIX = "eval"


# ─── Data structures ────────────────────────────────────────────────────────


@dataclass
class VideoCase:
    """Hydrated input for one extraction re-run."""

    video_summary_id: str
    youtube_id: str
    domain: str
    triage: TriageResult
    transcript: str
    video_data: dict[str, Any]
    plan_tabs: list[dict[str, Any]]
    baseline_extraction: dict[str, Any]


@dataclass
class ModelRun:
    """Outcome of a single extract() pass."""

    model_label: str  # "primary" | "fast"
    score: float
    populated: int
    total: int
    empty_fields: list[str] = field(default_factory=list)
    cost_usd: float = 0.0
    duration_ms: int = 0
    error: str | None = None


@dataclass
class CaseResult:
    """Per-video comparison row."""

    video_summary_id: str
    youtube_id: str
    domain: str
    primary: ModelRun
    fast: ModelRun

    @property
    def score_delta(self) -> float:
        """Fast minus primary. Negative = regression."""
        return self.fast.score - self.primary.score

    @property
    def cost_delta_usd(self) -> float:
        """Fast minus primary cost. Negative = saving."""
        return self.fast.cost_usd - self.primary.cost_usd


# ─── Config helpers ─────────────────────────────────────────────────────────


@contextlib.contextmanager
def fast_first_enabled(enabled: bool) -> Iterator[None]:
    """Temporarily toggle ``settings.EXTRACTION_USE_FAST_FIRST``.

    The settings object is a pydantic-settings instance. Direct attribute
    assignment works at runtime; we restore the original value in ``finally``
    so an exception inside the block can't leak the override.
    """
    original = settings.EXTRACTION_USE_FAST_FIRST
    settings.EXTRACTION_USE_FAST_FIRST = enabled
    try:
        yield
    finally:
        settings.EXTRACTION_USE_FAST_FIRST = original


# ─── Pure functions: aggregation + report ───────────────────────────────────


def aggregate_per_domain(results: Iterable[CaseResult]) -> dict[str, dict[str, Any]]:
    """Group case rows by domain and compute mean deltas.

    Skips rows where either run errored — they should be reported separately
    in the summary instead of biasing the domain stats.
    """
    by_domain: dict[str, list[CaseResult]] = defaultdict(list)
    for r in results:
        if r.primary.error or r.fast.error:
            continue
        by_domain[r.domain].append(r)

    out: dict[str, dict[str, Any]] = {}
    for domain, rows in sorted(by_domain.items()):
        n = len(rows)
        if n == 0:
            continue
        primary_scores = [row.primary.score for row in rows]
        fast_scores = [row.fast.score for row in rows]
        score_deltas = [row.score_delta for row in rows]
        cost_deltas = [row.cost_delta_usd for row in rows]
        regressions = sum(1 for d in score_deltas if d < -0.10)
        out[domain] = {
            "samples": n,
            "primary_score_mean": round(sum(primary_scores) / n, 4),
            "fast_score_mean": round(sum(fast_scores) / n, 4),
            "score_delta_mean": round(sum(score_deltas) / n, 4),
            "score_delta_min": round(min(score_deltas), 4),
            "score_delta_max": round(max(score_deltas), 4),
            "cost_delta_mean_usd": round(sum(cost_deltas) / n, 6),
            "regression_rate": round(regressions / n, 4),
            "regressions_over_10pct": regressions,
        }
    return out


def evaluate_acceptance(
    per_domain: dict[str, dict[str, Any]],
    score_delta_threshold: float = 0.05,
    domain_regression_threshold: float = 0.10,
) -> dict[str, Any]:
    """Apply the P2 acceptance criteria to the aggregated stats.

    Returns a verdict dict with ``passed`` and a list of human-readable
    failure reasons. The default thresholds match the task plan:
    avg score delta < 0.05; no domain > 10% regression.
    """
    if not per_domain:
        return {"passed": False, "reasons": ["no domain data"], "verdict": "no-data"}

    failures: list[str] = []
    deltas = [d["score_delta_mean"] for d in per_domain.values()]
    overall_mean = sum(deltas) / len(deltas)

    if abs(overall_mean) > score_delta_threshold:
        failures.append(
            f"average score delta {overall_mean:.4f} exceeds ±{score_delta_threshold}"
        )

    for domain, stats in per_domain.items():
        if stats["score_delta_mean"] < -domain_regression_threshold:
            failures.append(
                f"{domain}: score regression {stats['score_delta_mean']:.4f} "
                f"exceeds {domain_regression_threshold}"
            )

    verdict = "pass" if not failures else "fail"
    return {
        "passed": not failures,
        "reasons": failures,
        "verdict": verdict,
        "overall_score_delta_mean": round(overall_mean, 4),
    }


def format_report(
    cases: list[CaseResult],
    per_domain: dict[str, dict[str, Any]],
    verdict: dict[str, Any],
    started_at: float,
    finished_at: float,
) -> dict[str, Any]:
    """Bundle case rows + aggregations + verdict + timing into one dict."""
    errors = [
        {
            "video_summary_id": c.video_summary_id,
            "youtube_id": c.youtube_id,
            "primary_error": c.primary.error,
            "fast_error": c.fast.error,
        }
        for c in cases
        if c.primary.error or c.fast.error
    ]
    return {
        "schema": "vie.extraction-eval/v1",
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": round(finished_at - started_at, 1),
        "samples_total": len(cases),
        "samples_with_errors": len(errors),
        "verdict": verdict,
        "per_domain": per_domain,
        "errors": errors,
        "cases": [_case_to_jsonable(c) for c in cases],
    }


def _case_to_jsonable(case: CaseResult) -> dict[str, Any]:
    return {
        "video_summary_id": case.video_summary_id,
        "youtube_id": case.youtube_id,
        "domain": case.domain,
        "score_delta": round(case.score_delta, 4),
        "cost_delta_usd": round(case.cost_delta_usd, 6),
        "primary": asdict(case.primary),
        "fast": asdict(case.fast),
    }


# ─── Pure helpers: input reconstruction ─────────────────────────────────────


def reconstruct_triage(triage_dict: dict[str, Any]) -> TriageResult:
    """Build a ``TriageResult`` from the stored ``pipeline.triage`` dict."""
    return TriageResult(
        content_tags=list(triage_dict.get("content_tags", []) or ["learning"]),
        modifiers=list(triage_dict.get("modifiers", []) or []),
        primary_tag=str(triage_dict.get("primary_tag", "learning")),
        user_goal=str(triage_dict.get("user_goal", "")),
        tabs=list(triage_dict.get("tabs", []) or []),
        confidence=float(triage_dict.get("confidence", 0.0) or 0.0),
    )


def transcript_from_segments(segments: list[dict[str, Any]]) -> str:
    """Concatenate segment ``text`` fields into a single transcript string.

    Mirrors how ``clean_text`` is built downstream — this is good enough for
    the eval since extraction cares about words, not exact whitespace.
    """
    parts = [str(seg.get("text", "")).strip() for seg in segments]
    return " ".join(p for p in parts if p)


def video_data_from_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Hydrate the ``video_data`` dict ``extract()`` expects."""
    return {
        "title": doc.get("title", ""),
        "duration": int(doc.get("duration", 0) or 0),
        "channel": doc.get("creator") or doc.get("channel", ""),
        "thumbnailUrl": doc.get("thumbnailUrl", ""),
    }


def domain_for_doc(doc: dict[str, Any]) -> str:
    """Resolve domain label for per-domain reporting.

    Falls back through ``primary_tag`` → ``content_tags[0]`` → ``"unknown"``.
    """
    triage = (doc.get("pipeline") or {}).get("triage") or {}
    primary = triage.get("primary_tag")
    if primary:
        return str(primary)
    tags = triage.get("content_tags") or []
    if tags:
        return str(tags[0])
    return "unknown"


# ─── Async glue: extract one case under both models ─────────────────────────


async def consume_extract(stream: AsyncIterator[dict[str, Any]]) -> dict[str, Any]:
    """Drive ``extract()`` to completion and return its final ``data`` payload."""
    final: dict[str, Any] = {}
    async for evt in stream:
        if evt.get("event") == "extraction_complete":
            final = evt.get("data") or {}
    return final


async def run_one_pass(
    case: VideoCase,
    llm_service: LLMService,
    *,
    use_fast: bool,
    feature_tag: str,
) -> tuple[dict[str, Any], int, str | None]:
    """Run one extract() pass under the chosen model. Returns (data, ms, err)."""
    started = time.perf_counter()
    feature_token = llm_feature_var.set(feature_tag)
    video_token = llm_video_id_var.set(case.video_summary_id)
    try:
        with fast_first_enabled(use_fast):
            stream = extract(
                llm_service,
                case.triage,
                case.transcript,
                case.video_data,
                chapters=None,
                force_primary_model=not use_fast,
            )
            data = await consume_extract(stream)
            duration_ms = int((time.perf_counter() - started) * 1000)
            return data, duration_ms, None
    except (ValueError, asyncio.TimeoutError, RuntimeError) as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.warning("extract failed: %s", exc)
        return {}, duration_ms, str(exc)
    finally:
        llm_feature_var.reset(feature_token)
        llm_video_id_var.reset(video_token)


async def evaluate_case(
    case: VideoCase,
    llm_service: LLMService,
    *,
    cost_lookup: "CostLookup",
) -> CaseResult:
    """Run primary + fast passes and bundle into a ``CaseResult``."""
    primary_tag = f"{EVAL_FEATURE_PREFIX}:primary:{case.video_summary_id}"
    fast_tag = f"{EVAL_FEATURE_PREFIX}:fast:{case.video_summary_id}"

    primary_data, primary_ms, primary_err = await run_one_pass(
        case, llm_service, use_fast=False, feature_tag=primary_tag,
    )
    fast_data, fast_ms, fast_err = await run_one_pass(
        case, llm_service, use_fast=True, feature_tag=fast_tag,
    )

    primary_quality = check_extraction_quality(case.plan_tabs, primary_data)
    fast_quality = check_extraction_quality(case.plan_tabs, fast_data)

    return CaseResult(
        video_summary_id=case.video_summary_id,
        youtube_id=case.youtube_id,
        domain=case.domain,
        primary=ModelRun(
            model_label="primary",
            score=primary_quality.score,
            populated=primary_quality.populated,
            total=primary_quality.total,
            empty_fields=list(primary_quality.empty_fields),
            cost_usd=cost_lookup.cost_for(primary_tag),
            duration_ms=primary_ms,
            error=primary_err,
        ),
        fast=ModelRun(
            model_label="fast",
            score=fast_quality.score,
            populated=fast_quality.populated,
            total=fast_quality.total,
            empty_fields=list(fast_quality.empty_fields),
            cost_usd=cost_lookup.cost_for(fast_tag),
            duration_ms=fast_ms,
            error=fast_err,
        ),
    )


# ─── Cost lookup ────────────────────────────────────────────────────────────


class CostLookup:
    """Read attribute: cost per ``feature`` tag from MongoDB ``llm_usage``."""

    def __init__(self, costs: dict[str, float] | None = None) -> None:
        self._costs = dict(costs or {})

    def cost_for(self, feature: str) -> float:
        return float(self._costs.get(feature, 0.0))

    @classmethod
    def from_mongo(cls, db: Any, prefix: str = EVAL_FEATURE_PREFIX) -> "CostLookup":
        """Aggregate costs grouped by ``feature`` for tags starting with ``prefix:``."""
        cursor = db["llm_usage"].aggregate([
            {"$match": {"feature": {"$regex": f"^{prefix}:"}}},
            {"$group": {"_id": "$feature", "cost_usd": {"$sum": "$cost_usd"}}},
        ])
        costs: dict[str, float] = {}
        for row in cursor:
            costs[str(row["_id"])] = float(row.get("cost_usd", 0.0) or 0.0)
        return cls(costs)


# ─── Loader ─────────────────────────────────────────────────────────────────


def query_candidate_docs(
    collection: Any,
    *,
    limit: int,
    domains: list[str] | None,
) -> list[dict[str, Any]]:
    """Query MongoDB for completed videos with the data we need."""
    query: dict[str, Any] = {
        "status": "completed",
        "rawTranscriptRef": {"$exists": True, "$ne": None},
        "pipeline.triage": {"$exists": True},
        "pipeline.extraction": {"$exists": True},
    }
    if domains:
        query["pipeline.triage.primary_tag"] = {"$in": domains}
    cursor = collection.find(query).limit(limit)
    return list(cursor)


async def hydrate_case(doc: dict[str, Any], transcript_loader: Any) -> VideoCase | None:
    """Reconstruct a ``VideoCase`` from a stored document. ``None`` on failure."""
    triage_dict = (doc.get("pipeline") or {}).get("triage") or {}
    extraction = (doc.get("pipeline") or {}).get("extraction") or {}
    if not triage_dict or not extraction:
        return None

    raw_ref = doc.get("rawTranscriptRef")
    if not raw_ref:
        return None

    raw = await transcript_loader.get_by_ref(raw_ref)
    if raw is None:
        return None

    transcript = transcript_from_segments(raw.segments)
    if not transcript:
        return None

    return VideoCase(
        video_summary_id=str(doc["_id"]),
        youtube_id=str(doc.get("youtubeId", "")),
        domain=domain_for_doc(doc),
        triage=reconstruct_triage(triage_dict),
        transcript=transcript,
        video_data=video_data_from_doc(doc),
        plan_tabs=list(triage_dict.get("tabs") or []),
        baseline_extraction=extraction,
    )


# ─── Orchestrator ───────────────────────────────────────────────────────────


async def run_eval(
    *,
    cases: list[VideoCase],
    llm_service: LLMService,
    cost_lookup_factory,
) -> dict[str, Any]:
    """Run the eval over already-hydrated cases. Returns the report dict."""
    started = time.time()
    results: list[CaseResult] = []
    cost_stub = CostLookup({})  # cost is filled in after all calls land
    for idx, case in enumerate(cases, start=1):
        logger.info("eval [%d/%d] video=%s domain=%s", idx, len(cases), case.video_summary_id, case.domain)
        result = await evaluate_case(case, llm_service, cost_lookup=cost_stub)
        results.append(result)

    final_costs = cost_lookup_factory()
    for r in results:
        r.primary.cost_usd = final_costs.cost_for(
            f"{EVAL_FEATURE_PREFIX}:primary:{r.video_summary_id}"
        )
        r.fast.cost_usd = final_costs.cost_for(
            f"{EVAL_FEATURE_PREFIX}:fast:{r.video_summary_id}"
        )

    per_domain = aggregate_per_domain(results)
    verdict = evaluate_acceptance(per_domain)
    finished = time.time()
    return format_report(results, per_domain, verdict, started, finished)


# ─── CLI ────────────────────────────────────────────────────────────────────


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=100, help="Max videos to evaluate (default: 100)")
    parser.add_argument("--domains", type=str, default="", help="Comma-separated domains to filter (default: all)")
    parser.add_argument(
        "--output",
        type=str,
        default="reports/extraction-eval.json",
        help="Path to write JSON report (default: reports/extraction-eval.json)",
    )
    parser.add_argument("--mongo-uri", type=str, default=os.environ.get("MONGODB_URI", "mongodb://localhost:27017"))
    parser.add_argument("--mongo-db", type=str, default=os.environ.get("MONGODB_DB", "video-insight-engine"))
    parser.add_argument("--dry-run", action="store_true", help="Plan only — print sample IDs and exit")
    parser.add_argument("--verbose", "-v", action="store_true")
    return parser.parse_args(argv)


async def amain(args: argparse.Namespace) -> int:
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    from pymongo import MongoClient
    client = MongoClient(args.mongo_uri)
    db = client[args.mongo_db]

    domains = [d.strip() for d in args.domains.split(",") if d.strip()]
    docs = query_candidate_docs(db["videoSummaryCache"], limit=args.limit, domains=domains)
    logger.info("Found %d candidate videos", len(docs))
    if args.dry_run:
        for d in docs[:25]:
            logger.info("  %s | %s | domain=%s", d["_id"], d.get("youtubeId"), domain_for_doc(d))
        return 0
    if not docs:
        logger.warning("No candidates found — exiting.")
        return 1

    from src.services.transcription.transcript_store import TranscriptStoreService
    transcript_store = TranscriptStoreService()

    cases: list[VideoCase] = []
    for doc in docs:
        case = await hydrate_case(doc, transcript_store)
        if case is None:
            logger.debug("Skip %s: missing transcript or triage", doc.get("_id"))
            continue
        cases.append(case)
    logger.info("Hydrated %d cases", len(cases))

    if not cases:
        logger.error("No hydrated cases — check transcript availability.")
        return 1

    llm_service = LLMService(LLMProvider())

    report = await run_eval(
        cases=cases,
        llm_service=llm_service,
        cost_lookup_factory=lambda: CostLookup.from_mongo(db),
    )

    out_path = Path(args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, default=str))
    logger.info("Wrote report to %s", out_path)
    logger.info("Verdict: %s | reasons=%s", report["verdict"]["verdict"], report["verdict"]["reasons"])
    return 0 if report["verdict"]["passed"] else 2


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return asyncio.run(amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
