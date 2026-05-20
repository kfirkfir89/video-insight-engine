"""Tests for src.services.observability.langfuse_client (assistant).

Mirrors the summarizer's test suite. The assistant-specific concepts —
``session_trace`` and ``span`` — get dedicated coverage here.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.services.observability import langfuse_client as lc


@pytest.fixture(autouse=True)
def _reset_module_state(monkeypatch):
    lc._reset_for_tests()
    monkeypatch.setattr(lc.settings, "LANGFUSE_PUBLIC_KEY", None, raising=False)
    monkeypatch.setattr(lc.settings, "LANGFUSE_SECRET_KEY", None, raising=False)
    yield
    lc._reset_for_tests()


def _install_fake_sdk(monkeypatch) -> MagicMock:
    fake_sdk_cls = MagicMock(name="LangfuseSDK")
    monkeypatch.setattr(lc, "Langfuse", fake_sdk_cls)
    monkeypatch.setattr(lc.settings, "LANGFUSE_PUBLIC_KEY", "pk_test", raising=False)
    monkeypatch.setattr(lc.settings, "LANGFUSE_SECRET_KEY", "sk_test", raising=False)
    return fake_sdk_cls


def test_init_returns_none_when_keys_missing():
    assert lc.init_langfuse() is None
    assert lc.is_enabled() is False


def test_init_builds_client_when_keys_present(monkeypatch):
    _install_fake_sdk(monkeypatch)
    assert lc.init_langfuse() is not None
    assert lc.is_enabled() is True


@pytest.mark.asyncio
async def test_session_trace_yields_none_when_disabled():
    async with lc.session_trace(video_id="v1") as trace:
        assert trace is None


@pytest.mark.asyncio
async def test_session_trace_opens_and_resets_context(monkeypatch):
    _install_fake_sdk(monkeypatch)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace

    async with lc.session_trace(video_id="v1", user_id="u1", session_id="s1") as trace:
        assert trace is fake_trace
        assert lc.get_current_trace() is fake_trace
    assert lc.get_current_trace() is None
    lc._client.trace.assert_called_once()
    kwargs = lc._client.trace.call_args.kwargs
    assert kwargs["name"] == "chat:v1"
    assert kwargs["user_id"] == "u1"
    assert kwargs["session_id"] == "s1"
    assert "videoId:v1" in kwargs["tags"]
    assert "userId:u1" in kwargs["tags"]


@pytest.mark.asyncio
async def test_span_creates_child_when_trace_active(monkeypatch):
    _install_fake_sdk(monkeypatch)
    lc.init_langfuse()
    fake_trace = MagicMock()
    fake_span = MagicMock()
    fake_trace.span.return_value = fake_span
    lc._client.trace.return_value = fake_trace

    async with lc.session_trace(video_id="v1"):
        async with lc.span("tool", metadata={"intent": "quiz_generator"}) as s:
            assert s is fake_span
        fake_span.end.assert_called_once()


@pytest.mark.asyncio
async def test_span_yields_none_when_no_trace():
    async with lc.span("tool") as s:
        assert s is None


@pytest.mark.asyncio
async def test_span_swallows_create_errors(monkeypatch):
    _install_fake_sdk(monkeypatch)
    lc.init_langfuse()
    fake_trace = MagicMock()
    fake_trace.span.side_effect = RuntimeError("create boom")
    lc._client.trace.return_value = fake_trace

    async with lc.session_trace(video_id="v1"):
        async with lc.span("tool") as s:
            assert s is None  # creation failed cleanly


@pytest.mark.asyncio
async def test_log_generation_records_under_current_trace(monkeypatch):
    _install_fake_sdk(monkeypatch)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace

    async with lc.session_trace(video_id="v1"):
        lc.log_generation(
            name="rag_generation",
            model="anthropic/claude-sonnet-4-6",
            input_payload=[{"role": "user", "content": "hello"}],
            output_payload="hi back",
            input_tokens=4,
            output_tokens=3,
            cost_usd=0.0001,
            latency_ms=80,
        )

    fake_trace.generation.assert_called_once()


def test_redact_pii_strips_emails():
    assert "alice@example.com" not in lc.redact_pii("contact alice@example.com")


def test_truncate_payload_caps_large_strings():
    out = lc.truncate_payload("y" * 5000, max_bytes=100)
    assert out.endswith("[TRUNCATED]")
    # The original length must NOT be encoded — that's a sizing oracle.
    assert "5000" not in out


# ─── Secret-token redaction + structured content (added 2026-05-20) ─────
def test_redact_pii_strips_jwt_and_keys():
    jwt = (
        "eyJhbGciOiJIUzI1NiJ9"
        ".eyJzdWIiOiIxMjM0NTY3ODkwIn0"
        ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    text = (
        f"jwt={jwt} aws=AKIAIOSFODNN7EXAMPLE "
        f"openai=sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaa "
        f"anthropic=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxabcdef "
        f"gh=ghp_abcdefghijklmnopqrstuvwxyzABCD1234"
    )
    out = lc.redact_pii(text)
    for needle in (
        jwt, "AKIAIOSFODNN7EXAMPLE", "sk-proj-", "sk-ant-api03",
        "ghp_abcdefghijklmnopqrstuvwxyzABCD1234",
    ):
        assert needle not in out


@pytest.mark.asyncio
async def test_structured_content_blocks_are_redacted(monkeypatch):
    """Mirrors the summarizer test — OCR text inside content blocks is redacted."""
    _install_fake_sdk(monkeypatch)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "OCR found alice@example.com"},
                {"type": "image", "source": {"type": "base64", "data": "img"}},
            ],
        },
    ]
    async with lc.session_trace(video_id="v1"):
        lc.log_generation(
            name="rag_generation",
            model="m",
            input_payload=messages,
            output_payload="",
        )
    sent = fake_trace.generation.call_args.kwargs["input"]
    assert "alice@example.com" not in sent[0]["content"][0]["text"]
    assert sent[0]["content"][1]["type"] == "image"


# ─── User-id consent gate ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_user_id_omit_mode_drops_user_id(monkeypatch):
    _install_fake_sdk(monkeypatch)
    monkeypatch.setattr(lc.settings, "LANGFUSE_USER_ID_MODE", "omit", raising=False)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace
    async with lc.session_trace(video_id="v1", user_id="user-1"):
        pass
    assert lc._client.trace.call_args.kwargs["user_id"] is None


@pytest.mark.asyncio
async def test_user_id_hash_mode_replaces_user_id(monkeypatch):
    _install_fake_sdk(monkeypatch)
    monkeypatch.setattr(lc.settings, "LANGFUSE_USER_ID_MODE", "hash", raising=False)
    monkeypatch.setattr(lc.settings, "LANGFUSE_USER_ID_HASH_SALT", "pepper", raising=False)
    lc.init_langfuse()
    fake_trace = MagicMock()
    lc._client.trace.return_value = fake_trace
    async with lc.session_trace(video_id="v1", user_id="user-1"):
        pass
    sent = lc._client.trace.call_args.kwargs["user_id"]
    assert sent != "user-1"
    assert len(sent) == 16
