"""Tests for the faithfulness judge.

Covers:
- claim flattening from a nested extraction blob
- deterministic sampling by youtube_id
- judge response parsing (json + json-in-prose + garbage)
- end-to-end run with mocked LLM, including:
    * grounded vs ungrounded verdicts
    * judge errors don't crash the check
    * disabled when sample rate is 0
    * report is logged onto Langfuse trace via log_score
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.observability import langfuse_client as lc
from src.services.pipeline import faithfulness as fh


@pytest.fixture(autouse=True)
def _reset_observability(monkeypatch):
    lc._reset_for_tests()
    monkeypatch.setattr(lc.settings, "LANGFUSE_PUBLIC_KEY", None, raising=False)
    monkeypatch.setattr(lc.settings, "LANGFUSE_SECRET_KEY", None, raising=False)
    yield
    lc._reset_for_tests()


# ─── Claim flattening ───────────────────────────────────────────────────
def test_flatten_claims_picks_known_leaf_fields():
    """Claims under 20 chars are filtered as boilerplate; longer leaves are kept."""
    data = {
        "concepts": [
            {"name": "Photosynthesis basics 101",  # > 20 chars so it survives
             "definition": "the process by which plants make food from sunlight"},
        ],
        "key_points": [
            {"text": "chlorophyll absorbs red and blue light, reflects green"},
        ],
        "noise": {"randomKey": "irrelevant"},
    }
    claims = fh._flatten_claims(data)
    assert any("Photosynthesis basics" in c for c in claims)
    assert any("chlorophyll" in c for c in claims)
    # Boilerplate / unknown keys aren't pulled in
    assert not any("randomKey" in c for c in claims)


def test_flatten_claims_filters_short_text():
    data = {"key_points": [{"text": "ok"}, {"text": "long enough to be a real claim about something"}]}
    claims = fh._flatten_claims(data)
    assert len(claims) == 1
    assert "long enough" in claims[0]


def test_flatten_claims_deduplicates():
    data = {
        "a": [{"text": "same claim about a thing here repeated"}],
        "b": {"text": "same claim about a thing here repeated"},
    }
    claims = fh._flatten_claims(data)
    assert len(claims) == 1


# ─── Sampling ───────────────────────────────────────────────────────────
def test_sample_claims_deterministic_per_video():
    claims = [f"claim number {i} something happened here that is long enough" for i in range(20)]
    first = fh._sample_claims(claims, rate=0.2, youtube_id="abc123")
    second = fh._sample_claims(claims, rate=0.2, youtube_id="abc123")
    assert first == second


def test_sample_claims_rate_zero_returns_empty():
    assert fh._sample_claims(["a"], rate=0.0, youtube_id="x") == []


def test_sample_claims_caps_at_six():
    claims = [f"claim {i} something here long enough" for i in range(100)]
    sample = fh._sample_claims(claims, rate=1.0, youtube_id="x")
    assert len(sample) == fh._MAX_SAMPLES_PER_VIDEO


# ─── Judge response parsing ─────────────────────────────────────────────
def test_parse_grounded_true():
    assert fh._parse_judge_response('{"grounded": true, "evidence": "x"}') is True


def test_parse_grounded_false():
    assert fh._parse_judge_response('{"grounded": false, "evidence": ""}') is False


def test_parse_handles_prose_wrap():
    raw = 'Here is my verdict:\n{"grounded": true, "evidence": "y"}\nThanks!'
    assert fh._parse_judge_response(raw) is True


def test_parse_handles_string_boolean():
    assert fh._parse_judge_response('{"grounded": "true"}') is True
    assert fh._parse_judge_response('{"grounded": "false"}') is False


def test_parse_garbage_returns_none():
    assert fh._parse_judge_response("nope") is None
    assert fh._parse_judge_response("") is None
    assert fh._parse_judge_response('{"other": 1}') is None


# ─── End-to-end ─────────────────────────────────────────────────────────
def _llm_returning(verdicts: list[str]):
    """Return a MagicMock LLMService that yields the given judge outputs."""
    service = MagicMock()
    service.call_llm = AsyncMock(side_effect=verdicts)
    service.call_llm_fast = AsyncMock(side_effect=verdicts)
    service.model = "anthropic/claude-sonnet-4-6"
    service.fast_model = "anthropic/claude-haiku-4-5-20251001"
    return service


@pytest.mark.asyncio
async def test_disabled_when_sample_rate_zero():
    llm = _llm_returning([])
    report = await fh.run_faithfulness_check(
        llm_service=llm,
        transcript="t",
        extraction_data={"key_points": [{"text": "some long claim worth scoring here"}]},
        youtube_id="vid",
        sample_rate=0.0,
    )
    assert report is None
    llm.call_llm_fast.assert_not_called()


@pytest.mark.asyncio
async def test_returns_none_when_no_claims():
    llm = _llm_returning([])
    report = await fh.run_faithfulness_check(
        llm_service=llm,
        transcript="t",
        extraction_data={"key_points": []},
        youtube_id="vid",
        sample_rate=0.2,
    )
    assert report is None


@pytest.mark.asyncio
async def test_reports_grounded_score_and_logs_to_langfuse(monkeypatch):
    # Install fake Langfuse so log_score has a trace target
    fake_sdk = MagicMock()
    monkeypatch.setattr(lc, "Langfuse", fake_sdk)
    monkeypatch.setattr(lc.settings, "LANGFUSE_PUBLIC_KEY", "pk", raising=False)
    monkeypatch.setattr(lc.settings, "LANGFUSE_SECRET_KEY", "sk", raising=False)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace

    llm = _llm_returning([
        '{"grounded": true, "evidence": ""}',
        '{"grounded": false, "evidence": ""}',
        '{"grounded": true, "evidence": ""}',
    ])
    extraction = {
        "key_points": [
            {"text": "claim about photosynthesis being the process plants use"},
            {"text": "claim about light reactions occurring in thylakoid membranes"},
            {"text": "claim about calvin cycle producing glucose in stroma"},
        ],
    }

    async with lc.pipeline_trace("vid"):
        report = await fh.run_faithfulness_check(
            llm_service=llm,
            transcript="photosynthesis happens. light reactions occur. calvin cycle.",
            extraction_data=extraction,
            youtube_id="vid",
            sample_rate=1.0,
        )

    assert report is not None
    assert report.sample_size == 3
    assert report.grounded_count == 2
    assert report.score == pytest.approx(0.667, abs=0.01)
    fake_trace.score.assert_called_once()
    assert fake_trace.score.call_args.kwargs["name"] == "faithfulness"


@pytest.mark.asyncio
async def test_judge_errors_dont_crash():
    """When the judge returns garbage, we just skip that verdict."""
    llm = _llm_returning(["garbage", '{"grounded": true}', '{"grounded": true}'])
    extraction = {"key_points": [
        {"text": f"claim {i} about something with enough length to count"} for i in range(3)
    ]}
    report = await fh.run_faithfulness_check(
        llm_service=llm,
        transcript="t",
        extraction_data=extraction,
        youtube_id="vid",
        sample_rate=1.0,
    )
    # 3 sampled, 1 garbage → 2 usable, 2 grounded → score 1.0
    assert report is not None
    assert report.sample_size == 2
    assert report.score == 1.0


@pytest.mark.asyncio
async def test_transcript_window_covers_long_videos():
    """Regression: an 80K-char transcript (≈ 80-min video) must reach the judge.

    Previously the budget was 12K chars, which truncated everything past
    the opening 12 minutes — claims from later chapters were never in-window
    and the judge always returned `false`, dragging the score to 0/N.
    """
    assert fh._TRANSCRIPT_BUDGET_CHARS >= 60_000


@pytest.mark.asyncio
async def test_run_logs_diagnostic_summary(caplog):
    """Every run should emit a one-line summary with transcript size + sample size."""
    llm = _llm_returning(['{"grounded": true}', '{"grounded": true}'])
    extraction = {"key_points": [
        {"text": "claim one with enough characters to be considered"},
        {"text": "claim two with enough characters to be considered"},
    ]}
    with caplog.at_level("INFO"):
        await fh.run_faithfulness_check(
            llm_service=llm,
            transcript="t" * 5000,
            extraction_data=extraction,
            youtube_id="vid-log",
            sample_rate=1.0,
        )
    summary = [r for r in caplog.records if "[faithfulness]" in r.getMessage() and "claims_total" in r.getMessage()]
    assert summary, "expected one diagnostic summary log line per run"
    assert "vid-log" in summary[0].getMessage()
    assert "truncated=False" in summary[0].getMessage()


@pytest.mark.asyncio
async def test_judge_exception_returns_none_verdict():
    """An exception inside call_llm_with_retry is logged and treated as None."""
    llm = MagicMock()
    llm.call_llm_fast = AsyncMock(side_effect=RuntimeError("boom"))
    llm.call_llm = AsyncMock(side_effect=RuntimeError("boom"))
    llm.model = "anthropic/claude-sonnet-4-6"
    llm.fast_model = "anthropic/claude-haiku-4-5-20251001"
    extraction = {"key_points": [{"text": "claim long enough to be useful here"}]}
    report = await fh.run_faithfulness_check(
        llm_service=llm,
        transcript="t",
        extraction_data=extraction,
        youtube_id="vid",
        sample_rate=1.0,
    )
    # Single claim, judge errored → no usable verdicts → returns None
    assert report is None
