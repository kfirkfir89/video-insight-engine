"""Tests for the admin Langfuse deep-link resolver (pure mapping + enable gate)."""

from __future__ import annotations

import asyncio
import time

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


class _TagLookupClient:
    """AsyncClient stand-in answering /projects and tag-filtered /traces."""

    def __init__(self, traces_by_tag: dict[str, list[dict]]) -> None:
        self._traces_by_tag = traces_by_tag
        self.calls: list[dict] = []

    async def __aenter__(self) -> "_TagLookupClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, url: str, **kwargs: object) -> object:
        params = kwargs.get("params") or {}
        self.calls.append({"url": url, "params": params})

        class _Resp:
            def __init__(self, data: list[dict]) -> None:
                self._data = data

            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {"data": self._data}

        if url.endswith("/api/public/projects"):
            return _Resp([{"id": "proj-9"}])
        return _Resp(self._traces_by_tag.get(str(params.get("tags")), []))


@pytest.mark.anyio
async def test_map_uses_one_tag_filtered_lookup_per_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    monkeypatch.setattr(settings, "LANGFUSE_PROJECT_ID", "proj-9")
    monkeypatch.setattr(settings, "LANGFUSE_BASE_URL", "https://lf.test")
    client = _TagLookupClient({"requestId:req-a": [{"id": "trace-a", "tags": ["requestId:req-a"]}]})
    monkeypatch.setattr(langfuse.httpx, "AsyncClient", lambda *a, **k: client)

    urls = await langfuse.map_request_ids_to_urls(["req-a", "req-b", "req-a"])

    assert urls == {"req-a": "https://lf.test/project/proj-9/traces/trace-a"}
    trace_calls = [c for c in client.calls if c["url"].endswith("/api/public/traces")]
    assert sorted(c["params"]["tags"] for c in trace_calls) == [
        "requestId:req-a",
        "requestId:req-b",
    ]
    assert all(c["params"]["fields"] == "core" and c["params"]["limit"] == 1 for c in trace_calls)


class _SlowTagLookupClient(_TagLookupClient):
    """Answers instantly for ids in ``traces_by_tag``; hangs on everything else."""

    def __init__(self, traces_by_tag: dict[str, list[dict]], hang_seconds: float) -> None:
        super().__init__(traces_by_tag)
        self._hang = hang_seconds

    async def get(self, url: str, **kwargs: object) -> object:
        params = kwargs.get("params") or {}
        tag = str(params.get("tags"))
        if url.endswith("/api/public/traces") and tag not in self._traces_by_tag:
            await asyncio.sleep(self._hang)
        return await super().get(url, **kwargs)


@pytest.mark.anyio
async def test_map_keeps_finished_links_when_budget_expires(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A slow Langfuse must not hold /usage/by-run: finished lookups are kept,
    pending ones are dropped at the batch deadline."""
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    monkeypatch.setattr(settings, "LANGFUSE_PROJECT_ID", "proj-9")
    monkeypatch.setattr(settings, "LANGFUSE_BASE_URL", "https://lf.test")
    monkeypatch.setattr(langfuse, "_TOTAL_BUDGET_SECONDS", 0.05)
    client = _SlowTagLookupClient(
        {"requestId:req-fast": [{"id": "trace-f", "tags": ["requestId:req-fast"]}]},
        hang_seconds=5.0,
    )
    monkeypatch.setattr(langfuse.httpx, "AsyncClient", lambda *a, **k: client)

    started = time.monotonic()
    urls = await langfuse.map_request_ids_to_urls(["req-fast", "req-slow"])

    assert time.monotonic() - started < 2.0
    assert urls == {"req-fast": "https://lf.test/project/proj-9/traces/trace-f"}


class _MalformedTraceClient(_TagLookupClient):
    """Returns a JSON *list* for /traces — ``.get`` on it raises AttributeError."""

    async def get(self, url: str, **kwargs: object) -> object:
        if url.endswith("/api/public/traces"):

            class _Resp:
                def raise_for_status(self) -> None:
                    return None

                def json(self) -> list:
                    return []

            return _Resp()
        return await super().get(url, **kwargs)


@pytest.mark.anyio
async def test_map_isolates_unexpected_lookup_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    """An unexpected exception inside one lookup yields no link — never a 500."""
    monkeypatch.setattr(settings, "LANGFUSE_PUBLIC_KEY", "pk")
    monkeypatch.setattr(settings, "LANGFUSE_SECRET_KEY", "sk")
    monkeypatch.setattr(settings, "LANGFUSE_PROJECT_ID", "proj-9")
    monkeypatch.setattr(langfuse.httpx, "AsyncClient", lambda *a, **k: _MalformedTraceClient({}))

    assert await langfuse.map_request_ids_to_urls(["req-a"]) == {}
