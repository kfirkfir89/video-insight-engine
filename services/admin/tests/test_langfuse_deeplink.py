"""Tests for the admin Langfuse deep-link resolver (pure mapping + enable gate)."""

from __future__ import annotations

import httpx
import pytest

from src.config import settings
from src.services import langfuse


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# ─── is_enabled ───


def test_is_enabled_false_without_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "")
    assert langfuse.is_enabled() is False


def test_is_enabled_true_with_both_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk-lf-x")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk-lf-y")
    assert langfuse.is_enabled() is True


# ─── _build_url_map (pure) ───


def test_build_url_map_matches_request_id_tag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_BASE_URL", "https://lf.example.com")
    traces = [
        {"id": "trace-1", "tags": ["youtubeId:abc", "requestId:req-aaa", "videoSummaryId:v1"]},
        {"id": "trace-2", "tags": ["requestId:req-bbb"]},
    ]
    urls = langfuse._build_url_map(traces, "proj-9", {"req-aaa", "req-bbb"})
    assert urls["req-aaa"] == "https://lf.example.com/project/proj-9/traces/trace-1"
    assert urls["req-bbb"] == "https://lf.example.com/project/proj-9/traces/trace-2"


def test_build_url_map_ignores_unwanted_and_untagged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_BASE_URL", "https://lf.example.com")
    traces = [
        {"id": "trace-1", "tags": ["requestId:other"]},  # not wanted
        {"id": "trace-2", "tags": ["videoId:x"]},  # no requestId tag
        {"tags": ["requestId:req-aaa"]},  # no trace id → skip
    ]
    urls = langfuse._build_url_map(traces, "proj-9", {"req-aaa"})
    assert urls == {}


def test_build_url_map_first_trace_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    """Newest-first ordering: the first trace carrying the id is used."""
    monkeypatch.setattr(settings, "LANGFUSE_BASE_URL", "https://lf.example.com")
    traces = [
        {"id": "newest", "tags": ["requestId:req-aaa"]},
        {"id": "older", "tags": ["requestId:req-aaa"]},
    ]
    urls = langfuse._build_url_map(traces, "p", {"req-aaa"})
    assert urls["req-aaa"].endswith("/traces/newest")


# ─── map_request_ids_to_urls early returns (no I/O) ───


@pytest.mark.anyio
async def test_map_returns_empty_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "")
    assert await langfuse.map_request_ids_to_urls(["req-aaa"]) == {}


@pytest.mark.anyio
async def test_map_returns_empty_for_no_request_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    assert await langfuse.map_request_ids_to_urls([]) == {}
    assert await langfuse.map_request_ids_to_urls([None, ""]) == {}  # type: ignore[list-item]


# ─── map_request_ids_to_urls best-effort on transport failure ───


class _RaisingClient:
    """Minimal httpx.AsyncClient stand-in whose calls raise an HTTP error.

    Confirms the tight, best-effort timeout bound: a degraded/slow Langfuse
    surfaces as an httpx error, which must yield no links rather than propagate.
    """

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    async def __aenter__(self) -> "_RaisingClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, *_args: object, **_kwargs: object) -> object:
        raise self._exc


@pytest.mark.anyio
async def test_map_returns_empty_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    monkeypatch.setattr(settings, "LANGFUSE_PROJECT_ID", "proj-9")
    monkeypatch.setattr(
        langfuse.httpx,
        "AsyncClient",
        lambda *a, **k: _RaisingClient(httpx.TimeoutException("read timed out")),
    )
    assert await langfuse.map_request_ids_to_urls(["req-aaa"]) == {}


@pytest.mark.anyio
async def test_map_returns_empty_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    monkeypatch.setattr(settings, "LANGFUSE_PROJECT_ID", "proj-9")
    monkeypatch.setattr(
        langfuse.httpx,
        "AsyncClient",
        lambda *a, **k: _RaisingClient(httpx.ConnectError("refused")),
    )
    assert await langfuse.map_request_ids_to_urls(["req-aaa"]) == {}
