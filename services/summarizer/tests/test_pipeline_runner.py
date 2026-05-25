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
