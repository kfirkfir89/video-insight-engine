"""Langfuse deep-link resolution for pipeline-run rows.

Admin owns the cost ledger; Langfuse owns per-call trace forensics. Rather than
mirror traces, each run row links straight to its Langfuse trace. The summarizer
tags every pipeline trace ``requestId:<id>`` (see services/summarizer
pipeline_runner), so we resolve a run's ``request_id`` to a concrete trace id via
the Langfuse public API and build a direct URL:
``{base}/project/{project_id}/traces/{trace_id}``.

Everything here is best-effort: any failure (keys unset, network, 4xx) returns an
empty result so the admin UI simply renders no link. It never raises into the
hot path of the usage endpoints.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

# Tight read budget: this resolve sits on the critical path of the cost
# dashboard, so a degraded cloud.langfuse.com must not stall it. The whole
# result is cached 30s by the caller, so a slow first load is amortised; being
# best-effort, a timeout just yields no link rather than an error.
_TIMEOUT = httpx.Timeout(4.0, connect=2.0)
# Resolved once from the keys and reused; the project id never changes per key pair.
_project_id_cache: str | None = None


def is_enabled() -> bool:
    """True when both Langfuse keys are configured."""
    return bool(settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY)


def _auth() -> tuple[str, str]:
    return (settings.LANGFUSE_PUBLIC_KEY, settings.LANGFUSE_SECRET_KEY)


def _base_url() -> str:
    return settings.LANGFUSE_BASE_URL.rstrip("/")


async def _resolve_project_id(client: httpx.AsyncClient) -> str | None:
    """Return the project id, preferring the explicit env override, else the
    project the API keys belong to (cached after the first lookup)."""
    global _project_id_cache
    if settings.LANGFUSE_PROJECT_ID:
        return settings.LANGFUSE_PROJECT_ID
    if _project_id_cache is not None:
        return _project_id_cache

    resp = await client.get(f"{_base_url()}/api/public/projects", auth=_auth())
    resp.raise_for_status()
    projects = resp.json().get("data", [])
    if not projects:
        return None
    _project_id_cache = str(projects[0]["id"])
    return _project_id_cache


def _trace_url(project_id: str, trace_id: str) -> str:
    return f"{_base_url()}/project/{project_id}/traces/{trace_id}"


def _build_url_map(traces: list[dict], project_id: str, wanted: set[str]) -> dict[str, str]:
    """Map each wanted ``request_id`` to a trace URL by scanning trace tags.

    Pure (no I/O) so it can be unit-tested. The summarizer tags pipeline traces
    ``requestId:<id>``; the first trace carrying a wanted id wins (traces arrive
    newest-first from the API).
    """
    urls: dict[str, str] = {}
    for trace in traces:
        trace_id = trace.get("id")
        if not trace_id:
            continue
        for tag in trace.get("tags") or []:
            if not tag.startswith("requestId:"):
                continue
            rid = tag.split(":", 1)[1]
            if rid in wanted and rid not in urls:
                urls[rid] = _trace_url(project_id, trace_id)
    return urls


# Parallel tag lookups per run: a filtered ``tags=requestId:<id>`` query is
# small and fast, whereas the unfiltered 100-trace listing (~10 s on
# cloud.langfuse.com) blew the read budget and every run rendered without a link.
_LOOKUP_CONCURRENCY = 8
# Wall-clock cap for the whole batch. A page can carry 100 runs; at 8-wide with
# a 4 s per-call timeout a degraded Langfuse would otherwise hold /usage/by-run
# for ~50 s. Lookups still pending at the deadline are dropped (no link).
_TOTAL_BUDGET_SECONDS = 8.0


async def _lookup_trace_url(
    client: httpx.AsyncClient, project_id: str, request_id: str, sem: asyncio.Semaphore
) -> tuple[str, str | None]:
    async with sem:
        try:
            resp = await client.get(
                f"{_base_url()}/api/public/traces",
                auth=_auth(),
                params={"tags": f"requestId:{request_id}", "limit": 1, "fields": "core"},
            )
            resp.raise_for_status()
            traces = resp.json().get("data", [])
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            logger.warning("langfuse_deeplink_lookup_failed request_id=%s: %s", request_id, exc)
            return request_id, None
    urls = _build_url_map(traces, project_id, {request_id})
    return request_id, urls.get(request_id)


async def _lookup_all(
    client: httpx.AsyncClient, project_id: str, wanted: list[str]
) -> dict[str, str]:
    """Run every lookup under one wall-clock budget; keep whatever finished.

    A lookup that raises something unexpected (malformed JSON shape, etc.)
    costs only its own link — it must never turn into a 500 on the run list.
    """
    sem = asyncio.Semaphore(_LOOKUP_CONCURRENCY)
    tasks = [asyncio.create_task(_lookup_trace_url(client, project_id, rid, sem)) for rid in wanted]
    done, pending = await asyncio.wait(tasks, timeout=_TOTAL_BUDGET_SECONDS)
    if pending:
        logger.warning(
            "langfuse_deeplink_budget_exhausted pending=%d total=%d", len(pending), len(tasks)
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

    urls: dict[str, str] = {}
    for task in done:
        exc = task.exception()
        if exc is not None:
            logger.warning("langfuse_deeplink_lookup_crashed: %r", exc)
            continue
        rid, url = task.result()
        if url:
            urls[rid] = url
    return urls


async def map_request_ids_to_urls(request_ids: list[str]) -> dict[str, str]:
    """Resolve each ``request_id`` to its Langfuse trace URL.

    One tag-filtered lookup per run, ``_LOOKUP_CONCURRENCY`` at a time, all
    within ``_TOTAL_BUDGET_SECONDS``. Runs whose lookup fails, times out or
    finds no trace simply get no link. Returns an empty dict on any
    project-resolution error or when Langfuse is not configured.
    """
    wanted = [rid for rid in dict.fromkeys(request_ids) if rid]
    if not wanted or not is_enabled():
        return {}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            project_id = await _resolve_project_id(client)
            if not project_id:
                return {}
            return await _lookup_all(client, project_id, wanted)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning("langfuse_deeplink_resolve_failed: %s", exc)
        return {}
