"""Tests for llm_common.models."""

from datetime import UTC, datetime

from llm_common.models import UsageRecord, extract_provider


def test_extract_provider_with_slash():
    assert extract_provider("anthropic/claude-sonnet-4-20250514") == "anthropic"


def test_extract_provider_without_slash():
    assert extract_provider("gpt-4o") == "unknown"


def test_usage_record_defaults():
    record = UsageRecord(model="test/model", provider="test")
    assert record.tokens_in == 0
    assert record.tokens_out == 0
    assert record.cost_usd == 0.0
    assert record.feature == "unknown"
    assert record.success is True
    assert record.service == "unknown"
    assert isinstance(record.timestamp, datetime)


def test_usage_record_full():
    record = UsageRecord(
        model="anthropic/claude-sonnet-4-20250514",
        provider="anthropic",
        tokens_in=100,
        tokens_out=200,
        cost_usd=0.05,
        feature="summarize:chapter",
        success=True,
        duration_ms=1500,
        request_id="req-123",
        video_id="vid-456",
        is_stream=True,
        service="summarizer",
        prompt_preview="Summarize this...",
        prompt_hash="abc123",
    )
    assert record.tokens_in == 100
    assert record.cost_usd == 0.05
    assert record.video_id == "vid-456"


def test_usage_record_model_dump():
    record = UsageRecord(model="test/m", provider="test")
    d = record.model_dump()
    assert "model" in d
    assert "provider" in d
    assert "timestamp" in d
