"""Tests for src.services.llm_telemetry.

Covers the cache-field surfacing path: when the Anthropic response carries
``cache_creation_input_tokens`` / ``cache_read_input_tokens`` on its usage
block, those numbers must appear in the Langfuse generation metadata so we
can answer "is the extraction prompt actually being cached?" from the UI.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from src.services import llm_telemetry


def _build_response(
    *,
    prompt_tokens: int = 1000,
    completion_tokens: int = 200,
    cache_creation: int = 0,
    cache_read: int = 0,
) -> MagicMock:
    """Build a mock LiteLLM response with the given usage shape."""
    response = MagicMock()
    response.usage = MagicMock()
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    response.usage.cache_creation_input_tokens = cache_creation
    response.usage.cache_read_input_tokens = cache_read
    return response


def test_records_cache_read_tokens_in_metadata():
    """A response with cache_read_input_tokens > 0 must surface cacheHit + cacheReadTokens in metadata."""
    response = _build_response(prompt_tokens=2000, cache_read=8000)
    with patch("src.services.llm_telemetry.log_generation") as mock_log:
        llm_telemetry.record_generation(
            span_name="extraction",
            model="anthropic/claude-sonnet-4-6",
            msg_dicts=[{"role": "user", "content": "x"}],
            content="ok",
            response=response,
            latency_ms=123,
            finish_reason="stop",
            extra_metadata=None,
        )
    metadata = mock_log.call_args.kwargs["metadata"]
    assert metadata["cacheReadTokens"] == 8000
    assert metadata["cacheHit"] is True


def test_records_cache_creation_tokens_on_first_call():
    """The first call writes the cache and only has cache_creation_input_tokens — must surface that too."""
    response = _build_response(prompt_tokens=2000, cache_creation=10_000)
    with patch("src.services.llm_telemetry.log_generation") as mock_log:
        llm_telemetry.record_generation(
            span_name="extraction",
            model="anthropic/claude-sonnet-4-6",
            msg_dicts=[{"role": "user", "content": "x"}],
            content="ok",
            response=response,
            latency_ms=123,
            finish_reason="stop",
            extra_metadata=None,
        )
    metadata = mock_log.call_args.kwargs["metadata"]
    assert metadata["cacheCreationTokens"] == 10_000
    # cacheHit only flips True on reads (creations are the cost we PAY to enable hits)
    assert "cacheHit" not in metadata


def test_omits_cache_fields_when_caching_did_not_happen():
    """Non-Anthropic or non-cached calls — metadata must not carry phantom zeroes."""
    response = _build_response(cache_creation=0, cache_read=0)
    with patch("src.services.llm_telemetry.log_generation") as mock_log:
        llm_telemetry.record_generation(
            span_name="synthesis",
            model="openai/gpt-4o-mini",
            msg_dicts=[{"role": "user", "content": "x"}],
            content="ok",
            response=response,
            latency_ms=50,
            finish_reason="stop",
            extra_metadata=None,
        )
    metadata = mock_log.call_args.kwargs["metadata"]
    assert "cacheReadTokens" not in metadata
    assert "cacheCreationTokens" not in metadata
    assert "cacheHit" not in metadata


def test_preserves_extra_metadata_alongside_cache_fields():
    """The extra_metadata bag (attempt/retry counters etc) must still pass through unchanged."""
    response = _build_response(cache_read=5000)
    with patch("src.services.llm_telemetry.log_generation") as mock_log:
        llm_telemetry.record_generation(
            span_name="extraction",
            model="anthropic/claude-sonnet-4-6",
            msg_dicts=[{"role": "user", "content": "x"}],
            content="ok",
            response=response,
            latency_ms=100,
            finish_reason="stop",
            extra_metadata={"attempt": 1, "useFastModel": False},
        )
    metadata = mock_log.call_args.kwargs["metadata"]
    assert metadata["attempt"] == 1
    assert metadata["useFastModel"] is False
    assert metadata["cacheReadTokens"] == 5000
