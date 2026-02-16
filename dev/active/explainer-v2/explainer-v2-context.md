# Explainer V2 — Key Context

> Last Updated: 2026-02-16

## Status: COMPLETE (All Phases + Documentation)

All four implementation phases, testing, and documentation are complete. Task is ready to archive.

## Reference Document

- **Source Plan:** `PLAN-EXPLAINER-V2.md` (root) — comprehensive design spec
- **Scope:** Phases 1A-1D (MCP activation, video chat, UI wiring, export)

---

## Completed Changes Summary

### Explainer Service (Python) — Phase 1A + 1B

| File | Action |
|------|--------|
| `services/explainer/src/server.py` | **REWRITTEN** — Starlette + FastMCP, /health + /mcp endpoints |
| `services/explainer/src/dependencies.py` | **REWRITTEN** — Non-FastAPI DI, module-level getters |
| `services/explainer/src/tools/video_chat.py` | **NEW** — Video chat MCP tool |
| `services/explainer/src/prompts/video_chat_system.txt` | **NEW** — Video chat system prompt |
| `services/explainer/requirements.txt` | **UPDATED** — mcp>=1.25,<2, starlette |
| `services/explainer/pyproject.toml` | **UPDATED** — dependencies |
| `services/explainer/Dockerfile` | **UPDATED** — CMD uvicorn src.server:app |
| `services/explainer/src/main.py` | **DELETED** |
| `services/explainer/src/tools/explain_chat.py` | **DELETED** |
| `services/explainer/src/tools/explain_chat_stream.py` | **DELETED** |
| `services/explainer/src/tools/chat_utils.py` | **DELETED** |
| `services/explainer/src/prompts/chat_system.txt` | **DELETED** |
| `services/explainer/src/services/usage_tracker.py` | **DELETED** |
| `services/explainer/tests/test_explain_chat.py` | **DELETED** |

### API Service (TypeScript) — Phase 1A + 1B

| File | Action |
|------|--------|
| `api/src/services/explainer-client.ts` | **REWRITTEN** — MCP SDK client (StreamableHTTPClientTransport) |
| `api/src/routes/explain.routes.ts` | **REFACTORED** — Dead routes removed, POST /api/explain/video-chat added |
| `api/src/test/helpers.ts` | **UPDATED** — explainChat/explainChatStream → videoChat |
| `api/src/services/__tests__/explainer-client.test.ts` | **REWRITTEN** — MCP SDK mocks |
| `api/src/routes/explain.routes.test.ts` | **REWRITTEN** — video-chat tests |

### Frontend (React/TypeScript) — Phases 1B-1D

| File | Action |
|------|--------|
| `apps/web/src/api/explain.ts` | **NEW** — API client for explain endpoints |
| `apps/web/src/hooks/use-video-chat.ts` | **NEW** — Ephemeral chat hook (React state only) |
| `apps/web/src/hooks/use-explain-auto.ts` | **NEW** — React Query wrapper (30min staleTime) |
| `apps/web/src/components/video-detail/VideoChatPanel.tsx` | **NEW** — Chat UI panel |
| `apps/web/src/components/video-detail/GoDeepDrawer.tsx` | **NEW** — Expandable explanation drawer |
| `apps/web/src/components/video-detail/VideoSummaryIdContext.tsx` | **NEW** — Context for videoSummaryId |
| `apps/web/src/lib/block-to-markdown.ts` | **NEW** — Block → Markdown converter + copy/download utils |
| `apps/web/src/components/video-detail/video-detail-types.ts` | **UPDATED** — Added chat/goDeeper props |
| `apps/web/src/components/video-detail/VideoDetailLayout.tsx` | **UPDATED** — Chat + GoDeeper state, VideoSummaryIdProvider |
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | **REWRITTEN** — Chat panel, Go Deeper, export buttons |
| `apps/web/src/components/video-detail/VideoDetailMobile.tsx` | **REWRITTEN** — Chat drawer, Go Deeper, export buttons |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | **UPDATED** — Go Deeper button |
| `apps/web/src/components/video-detail/ConceptHighlighter.tsx` | **UPDATED** — TellMeMore component in concept popover |

### E2E Tests

| File | Action |
|------|--------|
| `apps/web/e2e/explainer-v2.spec.ts` | **NEW** — 16 Playwright tests (desktop, layout, responsivity) |

---

## Key Decisions

### 1. Starlette over FastAPI
FastAPI has a confirmed lifespan bug with MCP mounting. Starlette handles nested lifespans cleanly.

### 2. Streamable HTTP over SSE
SSE deprecated since MCP spec 2025-03-26. Streamable HTTP is the standard for service-to-service in Docker.

### 3. Video Chat is Ephemeral
No server-side persistence. Chat history lives in React state only. Simpler implementation.

### 4. VideoSummaryIdContext
Created separate context to thread videoSummaryId to deeply nested ConceptHighlighter → TellMeMore.

### 5. Sidebar covers mobile viewport
The Layout component renders a 380px sidebar at any viewport size. At mobile widths, the sidebar covers the entire viewport. E2E tests set `localStorage.vie-ui-store.sidebarOpen = false` before navigating.

---

## Test Results

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| API unit tests | 29 | 515 | ✅ All pass |
| Web unit tests | 49 | 1057 | ✅ All pass |
| TypeScript (API) | - | 0 errors | ✅ Clean |
| TypeScript (Web) | - | 0 errors | ✅ Clean |
| Playwright E2E | 1 | 16 | ✅ All pass |

---

## Remaining Work

None. All tasks complete.

### Runtime Fixes Applied (during E2E testing)

1. **`summary.sections` → `summary.chapters`** in `mongodb_repository.py:54` — MongoDB stores chapters under `summary.chapters`, not `sections`
2. **`chat_history: str | None` → `list[dict] | None`** in `server.py` — FastMCP's `pre_parse_json` breaks `str | None` annotations
3. **`JSON.stringify(chatHistory)` → `chatHistory ?? null`** in `explainer-client.ts` — Pass raw objects, not serialized strings
4. **`TransportSecuritySettings`** with `vie-explainer:*` in allowed_hosts — Docker hostname blocked by MCP DNS rebinding protection
5. **Dead schemas removed** — `ExplainChatRequest`, `ExplainChatResponse`, `ExplainAutoRequest`, `ExplainAutoResponse` from `schemas.py`
