"""Unit tests for ``scripts/eval_extraction_models.py`` (Phase 4 / P2 gate).

Covers:
    * Pure helpers — aggregation, acceptance verdict, report shape,
      input-reconstruction helpers, and ``CostLookup``.
    * ``consume_extract`` driving an async generator.
    * ``evaluate_case`` and ``run_eval`` orchestration with extract() mocked.

These tests do not hit MongoDB, S3, or any LLM — every external boundary is
stubbed so the suite stays in the unit-test budget.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

# Make the script directory importable.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "scripts"
sys.path.insert(0, str(_SCRIPTS_DIR))

import eval_extraction_models as eval_mod  # noqa: E402
from eval_extraction_models import (  # noqa: E402
    CaseResult,
    CostLookup,
    ModelRun,
    VideoCase,
    aggregate_per_domain,
    consume_extract,
    domain_for_doc,
    evaluate_acceptance,
    evaluate_case,
    fast_first_enabled,
    format_report,
    reconstruct_triage,
    run_eval,
    transcript_from_segments,
    video_data_from_doc,
)
from src.services.pipeline.triage import TriageResult


# ─── Helpers / fixtures ─────────────────────────────────────────────────────


def _make_run(label: str, score: float, cost: float = 0.0, error: str | None = None) -> ModelRun:
    return ModelRun(
        model_label=label,
        score=score,
        populated=int(score * 10),
        total=10,
        empty_fields=[],
        cost_usd=cost,
        duration_ms=1000,
        error=error,
    )


def _case(domain: str, primary: float, fast: float, **kwargs: Any) -> CaseResult:
    return CaseResult(
        video_summary_id=kwargs.get("vid", f"v_{domain}_{primary}_{fast}"),
        youtube_id=kwargs.get("yid", "yt"),
        domain=domain,
        primary=_make_run(
            "primary", primary,
            cost=kwargs.get("primary_cost", 0.10),
            error=kwargs.get("primary_error"),
        ),
        fast=_make_run(
            "fast", fast,
            cost=kwargs.get("fast_cost", 0.02),
            error=kwargs.get("fast_error"),
        ),
    )


# ─── aggregate_per_domain ───────────────────────────────────────────────────


class TestAggregatePerDomain:

    def test_returns_empty_dict_when_no_cases(self):
        assert aggregate_per_domain([]) == {}

    def test_groups_by_domain_and_averages(self):
        cases = [
            _case("learning", primary=0.80, fast=0.78),
            _case("learning", primary=0.90, fast=0.88),
            _case("tech", primary=0.70, fast=0.65),
        ]
        agg = aggregate_per_domain(cases)
        assert set(agg.keys()) == {"learning", "tech"}
        assert agg["learning"]["samples"] == 2
        assert agg["learning"]["primary_score_mean"] == pytest.approx(0.85)
        assert agg["learning"]["fast_score_mean"] == pytest.approx(0.83)
        assert agg["learning"]["score_delta_mean"] == pytest.approx(-0.02)
        assert agg["tech"]["samples"] == 1
        assert agg["tech"]["score_delta_mean"] == pytest.approx(-0.05)

    def test_skips_cases_with_errors(self):
        cases = [
            _case("learning", primary=0.80, fast=0.78),
            _case("learning", primary=0.50, fast=0.50, fast_error="boom"),
        ]
        agg = aggregate_per_domain(cases)
        assert agg["learning"]["samples"] == 1
        assert agg["learning"]["primary_score_mean"] == pytest.approx(0.80)

    def test_counts_regressions_over_10pct(self):
        cases = [
            _case("learning", primary=0.90, fast=0.85),  # delta -0.05, NOT a regression
            _case("learning", primary=0.90, fast=0.70),  # delta -0.20, IS a regression
            _case("learning", primary=0.80, fast=0.65),  # delta -0.15, IS a regression
        ]
        agg = aggregate_per_domain(cases)
        assert agg["learning"]["regressions_over_10pct"] == 2
        assert agg["learning"]["regression_rate"] == pytest.approx(2 / 3, rel=1e-3)


# ─── evaluate_acceptance ────────────────────────────────────────────────────


class TestEvaluateAcceptance:

    def test_passes_when_deltas_within_threshold(self):
        per_domain = {
            "learning": {"score_delta_mean": -0.02, "samples": 10},
            "tech": {"score_delta_mean": 0.01, "samples": 8},
        }
        verdict = evaluate_acceptance(per_domain)
        assert verdict["passed"] is True
        assert verdict["verdict"] == "pass"
        assert verdict["reasons"] == []

    def test_fails_when_overall_delta_exceeds_threshold(self):
        per_domain = {
            "learning": {"score_delta_mean": -0.08, "samples": 5},
            "tech": {"score_delta_mean": -0.07, "samples": 5},
        }
        verdict = evaluate_acceptance(per_domain)
        assert verdict["passed"] is False
        assert any("average score delta" in r for r in verdict["reasons"])

    def test_fails_when_a_domain_regresses_over_threshold(self):
        per_domain = {
            "learning": {"score_delta_mean": 0.00, "samples": 5},
            "tech": {"score_delta_mean": -0.15, "samples": 5},
        }
        verdict = evaluate_acceptance(per_domain)
        assert verdict["passed"] is False
        assert any("tech" in r for r in verdict["reasons"])

    def test_no_data_yields_explicit_verdict(self):
        verdict = evaluate_acceptance({})
        assert verdict["verdict"] == "no-data"
        assert verdict["passed"] is False


# ─── format_report ──────────────────────────────────────────────────────────


class TestFormatReport:

    def test_includes_schema_and_timing(self):
        cases = [_case("learning", primary=0.80, fast=0.78)]
        agg = aggregate_per_domain(cases)
        verdict = evaluate_acceptance(agg)
        report = format_report(cases, agg, verdict, started_at=100.0, finished_at=110.0)
        assert report["schema"] == "vie.extraction-eval/v1"
        assert report["duration_seconds"] == 10.0
        assert report["samples_total"] == 1
        assert report["per_domain"]["learning"]["samples"] == 1

    def test_records_errors_separately(self):
        cases = [
            _case("learning", primary=0.80, fast=0.78),
            _case("tech", primary=0.0, fast=0.0, fast_error="rate limited"),
        ]
        agg = aggregate_per_domain(cases)
        report = format_report(cases, agg, evaluate_acceptance(agg), 0.0, 1.0)
        assert report["samples_total"] == 2
        assert report["samples_with_errors"] == 1
        assert report["errors"][0]["fast_error"] == "rate limited"

    def test_case_rows_serialize_runs_and_deltas(self):
        cases = [_case("learning", primary=0.80, fast=0.70, primary_cost=0.10, fast_cost=0.02)]
        agg = aggregate_per_domain(cases)
        report = format_report(cases, agg, evaluate_acceptance(agg), 0.0, 1.0)
        case = report["cases"][0]
        assert case["score_delta"] == pytest.approx(-0.10)
        assert case["cost_delta_usd"] == pytest.approx(-0.08)
        assert case["primary"]["score"] == pytest.approx(0.80)


# ─── input reconstruction helpers ───────────────────────────────────────────


class TestReconstructTriage:

    def test_uses_stored_fields_with_defaults(self):
        triage = reconstruct_triage({
            "content_tags": ["tech", "learning"],
            "modifiers": ["finance"],
            "primary_tag": "tech",
            "user_goal": "Master Effect",
            "tabs": [{"id": "code", "dataSource": "tech.code"}],
            "confidence": 0.92,
        })
        assert isinstance(triage, TriageResult)
        assert triage.content_tags == ["tech", "learning"]
        assert triage.primary_tag == "tech"
        assert triage.confidence == pytest.approx(0.92)
        assert triage.tabs[0]["dataSource"] == "tech.code"

    def test_falls_back_to_safe_defaults_when_dict_is_empty(self):
        triage = reconstruct_triage({})
        assert triage.content_tags == ["learning"]
        assert triage.primary_tag == "learning"
        assert triage.confidence == 0.0


class TestTranscriptFromSegments:

    def test_concatenates_text_with_spaces(self):
        segments = [{"text": "Hello world."}, {"text": "Today we'll learn React."}]
        assert transcript_from_segments(segments) == "Hello world. Today we'll learn React."

    def test_skips_empty_segments(self):
        segments = [{"text": "First"}, {"text": "  "}, {"text": "Second"}, {}]
        assert transcript_from_segments(segments) == "First Second"


class TestVideoDataFromDoc:

    def test_extracts_canonical_fields(self):
        doc = {
            "title": "Effect 101",
            "duration": 1800,
            "creator": "Mr. Functional",
            "thumbnailUrl": "https://example.com/thumb.jpg",
        }
        out = video_data_from_doc(doc)
        assert out == {
            "title": "Effect 101",
            "duration": 1800,
            "channel": "Mr. Functional",
            "thumbnailUrl": "https://example.com/thumb.jpg",
        }

    def test_falls_back_to_channel_when_creator_missing(self):
        doc = {"title": "x", "duration": 0, "channel": "Channel Ten"}
        assert video_data_from_doc(doc)["channel"] == "Channel Ten"

    def test_handles_missing_duration(self):
        out = video_data_from_doc({"title": "x"})
        assert out["duration"] == 0


class TestDomainForDoc:

    def test_prefers_primary_tag(self):
        doc = {"pipeline": {"triage": {"primary_tag": "music", "content_tags": ["learning"]}}}
        assert domain_for_doc(doc) == "music"

    def test_falls_back_to_first_tag(self):
        doc = {"pipeline": {"triage": {"content_tags": ["fitness"]}}}
        assert domain_for_doc(doc) == "fitness"

    def test_returns_unknown_when_no_signal(self):
        assert domain_for_doc({}) == "unknown"
        assert domain_for_doc({"pipeline": {}}) == "unknown"


# ─── CostLookup ─────────────────────────────────────────────────────────────


class TestCostLookup:

    def test_returns_zero_for_unknown_feature(self):
        cl = CostLookup({"eval:primary:abc": 0.42})
        assert cl.cost_for("eval:primary:abc") == 0.42
        assert cl.cost_for("eval:fast:abc") == 0.0

    def test_from_mongo_aggregates_by_feature(self):
        fake_db = MagicMock()
        fake_db.__getitem__.return_value.aggregate.return_value = iter([
            {"_id": "eval:primary:vid1", "cost_usd": 0.31},
            {"_id": "eval:fast:vid1", "cost_usd": 0.04},
        ])
        cl = CostLookup.from_mongo(fake_db)
        assert cl.cost_for("eval:primary:vid1") == pytest.approx(0.31)
        assert cl.cost_for("eval:fast:vid1") == pytest.approx(0.04)


# ─── fast_first_enabled context manager ─────────────────────────────────────


class TestFastFirstEnabled:

    def test_toggles_and_restores(self):
        from src.config import settings
        original = settings.EXTRACTION_USE_FAST_FIRST
        try:
            settings.EXTRACTION_USE_FAST_FIRST = False
            with fast_first_enabled(True):
                assert settings.EXTRACTION_USE_FAST_FIRST is True
            assert settings.EXTRACTION_USE_FAST_FIRST is False
        finally:
            settings.EXTRACTION_USE_FAST_FIRST = original

    def test_restores_on_exception(self):
        from src.config import settings
        original = settings.EXTRACTION_USE_FAST_FIRST
        try:
            settings.EXTRACTION_USE_FAST_FIRST = False
            with pytest.raises(RuntimeError):
                with fast_first_enabled(True):
                    raise RuntimeError("boom")
            assert settings.EXTRACTION_USE_FAST_FIRST is False
        finally:
            settings.EXTRACTION_USE_FAST_FIRST = original


# ─── consume_extract ────────────────────────────────────────────────────────


class TestConsumeExtract:

    @pytest.mark.asyncio
    async def test_returns_data_payload_from_extraction_complete(self):
        async def fake_stream():
            yield {"event": "extraction_progress", "section": "all", "percent": 10}
            yield {"event": "extraction_progress", "section": "all", "percent": 50}
            yield {"event": "extraction_complete", "data": {"learning": {"keyPoints": ["a"]}}}

        out = await consume_extract(fake_stream())
        assert out == {"learning": {"keyPoints": ["a"]}}

    @pytest.mark.asyncio
    async def test_returns_empty_dict_when_no_complete_event(self):
        async def fake_stream():
            yield {"event": "extraction_progress", "section": "all", "percent": 10}

        out = await consume_extract(fake_stream())
        assert out == {}


# ─── evaluate_case (integration with extract() mocked) ──────────────────────


def _build_case() -> VideoCase:
    triage = TriageResult(
        content_tags=["learning"],
        primary_tag="learning",
        tabs=[{"id": "key_points", "dataSource": "learning.keyPoints"}],
    )
    return VideoCase(
        video_summary_id="vid1",
        youtube_id="yt1",
        domain="learning",
        triage=triage,
        transcript="lots of words " * 100,
        video_data={"title": "T", "duration": 600, "channel": "C", "thumbnailUrl": ""},
        plan_tabs=[{"id": "key_points", "dataSource": "learning.keyPoints"}],
        baseline_extraction={},
    )


class TestEvaluateCase:

    @pytest.mark.asyncio
    async def test_runs_primary_and_fast_and_attributes_costs(self):
        case = _build_case()

        async def fake_extract(*args, **kwargs):
            yield {
                "event": "extraction_complete",
                "data": {"learning": {"keyPoints": ["one", "two"]}},
            }

        cost = CostLookup({
            "eval:primary:vid1": 0.18,
            "eval:fast:vid1": 0.03,
        })

        with patch.object(eval_mod, "extract", fake_extract):
            result = await evaluate_case(case, MagicMock(), cost_lookup=cost)

        assert result.primary.score == pytest.approx(1.0)
        assert result.fast.score == pytest.approx(1.0)
        assert result.primary.cost_usd == pytest.approx(0.18)
        assert result.fast.cost_usd == pytest.approx(0.03)
        assert result.primary.error is None
        assert result.fast.error is None

    @pytest.mark.asyncio
    async def test_captures_error_when_extract_raises(self):
        case = _build_case()

        async def boom(*args, **kwargs):
            raise ValueError("LLM down")
            yield  # pragma: no cover — needed to make this a generator

        with patch.object(eval_mod, "extract", boom):
            result = await evaluate_case(case, MagicMock(), cost_lookup=CostLookup())

        assert result.primary.error == "LLM down"
        assert result.fast.error == "LLM down"
        assert result.primary.score == 0.0


# ─── run_eval orchestration ─────────────────────────────────────────────────


class TestRunEval:

    @pytest.mark.asyncio
    async def test_end_to_end_with_mocked_extract_and_costs(self):
        cases = [_build_case()]

        async def fake_extract(*args, **kwargs):
            yield {
                "event": "extraction_complete",
                "data": {"learning": {"keyPoints": ["a", "b"]}},
            }

        cost = CostLookup({
            "eval:primary:vid1": 0.10,
            "eval:fast:vid1": 0.02,
        })

        with patch.object(eval_mod, "extract", fake_extract):
            report = await run_eval(
                cases=cases,
                llm_service=MagicMock(),
                cost_lookup_factory=lambda: cost,
            )

        assert report["schema"] == "vie.extraction-eval/v1"
        assert report["samples_total"] == 1
        assert report["per_domain"]["learning"]["samples"] == 1
        assert report["cases"][0]["primary"]["cost_usd"] == pytest.approx(0.10)
        assert report["cases"][0]["fast"]["cost_usd"] == pytest.approx(0.02)
        assert report["cases"][0]["cost_delta_usd"] == pytest.approx(-0.08)
        assert report["verdict"]["verdict"] == "pass"
