"""Tests for the pipeline orchestration in src.routes.pipeline_runner.

Focused on the faithfulness fire-and-forget spawn — the rest of the
runner is exercised through integration tests.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from llm_common.context import llm_feature_var
from src.routes import pipeline_runner


@pytest.mark.asyncio
async def test_faithfulness_task_overrides_inherited_feature_var():
    """Regression: the spawned judge task must label its LLM calls as
    "summarize:faithfulness", not inherit "summarize:extraction" from the
    parent task that spawned it.

    Without this contract, every faithfulness LLM call rolls up into the
    extraction cost row in dashboards, hiding both stages' real spend.
    """
    captured: dict[str, str | None] = {"feature": None}

    async def fake_run_check(**_kwargs: object) -> None:
        # Snapshot the contextvar as observed inside the spawned task.
        captured["feature"] = llm_feature_var.get()

    ctx = MagicMock()
    ctx.extraction_data = {"key_points": [{"text": "claim long enough to be used"}]}
    ctx.clean_text = "some transcript text"
    ctx.youtube_id = "abc123"
    ctx.llm_service = MagicMock()

    # Set the parent context to simulate being inside the extraction phase
    # — this is what the bug case looked like before the fix.
    llm_feature_var.set("summarize:extraction")

    with patch(
        "src.services.pipeline.faithfulness.run_faithfulness_check",
        new=fake_run_check,
    ):
        task = pipeline_runner._launch_faithfulness_check(ctx)
        assert task is not None
        await task

    assert captured["feature"] == "summarize:faithfulness", (
        "Spawned task must override the inherited feature var to "
        "'summarize:faithfulness' so cost tracking attributes the LLM calls "
        "correctly. Inherited the parent's extraction label instead."
    )


@pytest.mark.asyncio
async def test_faithfulness_task_does_not_mutate_parent_feature_var():
    """The child task's contextvar set must NOT leak back to the parent.

    Python ContextVars are task-local by default — but this test pins the
    contract so a future refactor doesn't break attribution for the
    surrounding pipeline phases.
    """
    parent_token = llm_feature_var.set("summarize:extraction")
    try:
        ctx = MagicMock()
        ctx.extraction_data = {"key_points": [{"text": "claim long enough to be used"}]}
        ctx.clean_text = "transcript"
        ctx.youtube_id = "abc123"
        ctx.llm_service = MagicMock()

        async def noop_run(**_kwargs: object) -> None:
            return None

        with patch(
            "src.services.pipeline.faithfulness.run_faithfulness_check",
            new=noop_run,
        ):
            task = pipeline_runner._launch_faithfulness_check(ctx)
            assert task is not None
            await task

        # Parent must still see its own value after the child task completes.
        assert llm_feature_var.get() == "summarize:extraction"
    finally:
        llm_feature_var.reset(parent_token)


@pytest.mark.asyncio
async def test_launch_returns_none_when_extraction_data_missing():
    """Guard: if extraction failed, the judge has nothing to score."""
    ctx = MagicMock()
    ctx.extraction_data = {}
    ctx.clean_text = "transcript"
    ctx.youtube_id = "abc123"

    assert pipeline_runner._launch_faithfulness_check(ctx) is None


@pytest.mark.asyncio
async def test_launch_returns_none_when_transcript_missing():
    """Guard: judge needs a transcript to compare claims against."""
    ctx = MagicMock()
    ctx.extraction_data = {"key_points": [{"text": "claim"}]}
    ctx.clean_text = ""
    ctx.youtube_id = "abc123"

    assert pipeline_runner._launch_faithfulness_check(ctx) is None


@pytest.mark.asyncio
async def test_stream_sets_attribution_ctxvars_on_cache_hit():
    """Phase 0: the cost-tracking ctxvars (user/video/video_summary/request)
    must be set BEFORE the cache lookup, so even a Redis cache-hit run that
    makes a (rare) LLM call writes attributable `llm_usage` rows.

    Run grouping and per-user reconciliation match on these keys; if the fast
    path skipped them, cache-hit cost would be unattributable.
    """
    import structlog

    from llm_common.context import (
        llm_request_id_var,
        llm_user_id_var,
        llm_video_id_var,
        llm_video_summary_id_var,
    )

    cached = {
        "status": "completed",
        "youtubeId": "yt_cache_hit",
        "tabs": [{"id": "overview"}],
        "meta": {"contentTags": ["learning"]},
    }

    async def fake_get_response(_youtube_id: str) -> dict:
        return cached

    async def fake_cached_stream(_vsid: str, _cached: dict):
        yield "data: {}\n\n"

    captured: dict[str, str | None] = {}

    async def capture_then_stream(_vsid: str, _cached: dict):
        # Snapshot ctxvars at the point the cache-hit branch streams — they
        # must already be set by this point.
        captured["video_id"] = llm_video_id_var.get()
        captured["video_summary_id"] = llm_video_summary_id_var.get()
        captured["user_id"] = llm_user_id_var.get()
        captured["request_id"] = llm_request_id_var.get()
        async for ev in fake_cached_stream(_vsid, _cached):
            yield ev

    repository = MagicMock()
    entry = {"youtubeId": "yt_cache_hit", "userId": "user_77", "status": "processing"}

    structlog.contextvars.bind_contextvars(request_id="req_live_42")
    try:
        with patch.object(
            pipeline_runner.response_cache, "get_response", new=fake_get_response
        ), patch.object(
            pipeline_runner, "_stream_cached_structured", new=capture_then_stream
        ), patch.object(
            pipeline_runner.settings, "REDIS_ENABLED", True
        ):
            events = [
                ev
                async for ev in pipeline_runner.stream_summarization(
                    "vsum_55", entry, repository, MagicMock()
                )
            ]
    finally:
        structlog.contextvars.unbind_contextvars("request_id")

    assert events, "cache-hit path should stream at least one event"
    assert captured["video_id"] == "yt_cache_hit"
    assert captured["video_summary_id"] == "vsum_55"
    assert captured["user_id"] == "user_77"
    assert captured["request_id"] == "req_live_42"


@pytest.mark.asyncio
async def test_stream_reads_user_id_from_contextvars_when_entry_has_none():
    """Regression: the ``entry`` row is the cross-user ``videoSummaryCache`` doc
    and carries no per-run owner, so ``user_id`` must come from the structlog
    contextvar the worker binds from the queue payload — NOT ``entry``.

    Before the fix, ``entry.get("userId")`` was the only source, so every
    summarizer cost row landed with ``user_id=None`` and per-user reconciliation
    matched zero rows.
    """
    import structlog

    from llm_common.context import llm_user_id_var

    cached = {
        "status": "completed",
        "youtubeId": "yt_cross_user",
        "tabs": [{"id": "overview"}],
        "meta": {"contentTags": ["learning"]},
    }

    async def fake_get_response(_youtube_id: str) -> dict:
        return cached

    captured: dict[str, str | None] = {}

    async def capture_then_stream(_vsid: str, _cached: dict):
        captured["user_id"] = llm_user_id_var.get()
        yield "data: {}\n\n"

    repository = MagicMock()
    # No "userId" key on the cache doc — the cross-user case.
    entry = {"youtubeId": "yt_cross_user", "status": "processing"}

    structlog.contextvars.bind_contextvars(request_id="req_x", user_id="payload_user_99")
    try:
        with patch.object(
            pipeline_runner.response_cache, "get_response", new=fake_get_response
        ), patch.object(
            pipeline_runner, "_stream_cached_structured", new=capture_then_stream
        ), patch.object(
            pipeline_runner.settings, "REDIS_ENABLED", True
        ):
            _ = [
                ev
                async for ev in pipeline_runner.stream_summarization(
                    "vsum_x", entry, repository, MagicMock()
                )
            ]
    finally:
        structlog.contextvars.unbind_contextvars("request_id", "user_id")

    assert captured["user_id"] == "payload_user_99"
