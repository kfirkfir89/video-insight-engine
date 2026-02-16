# Explainer V2 — Task Checklist

> Last Updated: 2026-02-16

## Phase 1A — Explainer Becomes MCP Server

### 1A.1 Delete Dead Code [S] ✅
- [x] Delete `services/explainer/src/tools/explain_chat.py`
- [x] Delete `services/explainer/src/tools/explain_chat_stream.py`
- [x] Delete `services/explainer/src/tools/chat_utils.py`
- [x] Delete `services/explainer/src/prompts/chat_system.txt`
- [x] Delete `services/explainer/src/services/usage_tracker.py`
- [x] Delete `services/explainer/tests/test_explain_chat.py`
- [x] Clean up `services/explainer/src/tools/__init__.py` imports
- [x] Clean up any other files that import deleted modules
- [x] Verify: no import errors

### 1A.2 Rewrite server.py as MCP Entry Point [L] ✅
- [x] Update `requirements.txt`: pin `mcp>=1.25,<2`, add `starlette>=0.41.0`
- [x] Update `pyproject.toml` dependencies to match
- [x] Rewrite `services/explainer/src/server.py` (Starlette + FastMCP)
- [x] Rewrite `dependencies.py` for non-FastAPI context
- [x] Delete `services/explainer/src/main.py`

### 1A.3 Update Dockerfile [S] ✅
- [x] Change CMD to uvicorn src.server:app

### 1A.4 Refactor API Explainer Client to MCP [L] ✅
- [x] Rewrite `api/src/services/explainer-client.ts` to MCP SDK client
- [x] Update `api/src/test/helpers.ts` — mock container (explainChat → videoChat)
- [x] Rewrite `api/src/services/__tests__/explainer-client.test.ts` for MCP
- [x] Verify: API tests pass (515 tests, 0 failures)

### 1A.5 Update API Routes [M] ✅
- [x] Refactor `api/src/routes/explain.routes.ts` (remove dead chat routes)
- [x] Rewrite `api/src/routes/explain.routes.test.ts` (remove chat tests, add video-chat)
- [x] Verify: All API tests pass

---

## Phase 1B — Video-Scoped Chat

### 1B.1 New MCP Tool: video_chat [L] ✅
- [x] Create `services/explainer/src/tools/video_chat.py`
- [x] Create `services/explainer/src/prompts/video_chat_system.txt`
- [x] Register `video_chat` as MCP tool in `server.py`

### 1B.2 API Route for Video Chat [M] ✅
- [x] Add `POST /api/explain/video-chat` to explain.routes.ts
- [x] Add `videoChat()` method to ExplainerClient
- [x] Add route tests

### 1B.3 Frontend: Video Chat Panel [L] ✅
- [x] Create `apps/web/src/components/video-detail/VideoChatPanel.tsx`
- [x] Create `apps/web/src/hooks/use-video-chat.ts` (ephemeral, React state)
- [x] Create `apps/web/src/api/explain.ts` (API client)

### 1B.4 Wire into VideoDetail Layouts [M] ✅
- [x] Desktop: chat panel replaces sticky chapter nav in sidebar
- [x] Mobile: full-screen chat drawer (fixed inset-0 z-50)
- [x] Layout: chat state management (isChatOpen, onToggleChat)
- [x] VideoSummaryIdProvider context for nested components

---

## Phase 1C — Wire Go Deeper & Tell Me More

### 1C.1 Go Deeper on Chapters [M] ✅
- [x] Add "Go Deeper" button to `ArticleSection.tsx`
- [x] Create `GoDeepDrawer.tsx` component with loading/error/content states
- [x] Uses `useExplainAuto` hook (React Query, 30min staleTime)
- [x] Wired into Desktop and Mobile layouts with expandedChapterId state

### 1C.2 Tell Me More on Concepts [M] ✅
- [x] Add `TellMeMore` component inside `ConceptHighlighter.tsx`
- [x] Lazy-loads explanation on click via `useExplainAuto`
- [x] Shows inside concept popover
- [x] Uses `VideoSummaryIdContext` to get videoSummaryId

### 1C.3 Loading States & Error Handling [S] ✅
- [x] Spinner during LLM generation (GoDeepDrawer, TellMeMore)
- [x] Error state with message
- [x] Service unavailable handled gracefully

---

## Phase 1D — Export: Markdown + Copy

### 1D.1 Block-to-Markdown Utility [L] ✅
- [x] Create `apps/web/src/lib/block-to-markdown.ts`
- [x] Handles all ContentBlock types: paragraph, bullets, numbered, code, quote, table, callout, timestamp, definition, keyvalue, comparison, example, do_dont, statistic + fallback
- [x] `chaptersToMarkdown(title, chapters)`, `copyToClipboard(text)`, `downloadAsFile(content, filename)`

### 1D.2 Copy & Download Buttons [M] ✅
- [x] Desktop: "Copy as Markdown" + "Download as Markdown" buttons in header
- [x] Mobile: icon-only buttons in header bar
- [x] Copy: clipboard API with copied feedback (2s timeout)
- [x] Download: Blob → createObjectURL → anchor click → revokeObjectURL

---

## Cross-Phase Tasks

### Test Coverage ✅
- [x] API: MCP client tests (explainer-client.test.ts — rewritten)
- [x] API: Route tests (explain.routes.test.ts — rewritten)
- [x] Web unit tests: 49 files, 1057 tests, 0 failures
- [x] API unit tests: 29 files, 515 tests, 0 failures
- [x] TypeScript compilation: both API and web pass clean (0 errors)
- [x] Playwright E2E: 16 tests all passing
  - Desktop: 7 tests (chat, Go Deeper, export, toggles)
  - Layout & Overflow: 4 tests (1440px, 1024px, 1280px, HTML hierarchy)
  - Responsivity: 5 tests (375px mobile, 768px tablet, chat drawer, Go Deeper, export)

### Documentation Updates ✅
- [x] Update `docs/SERVICE-EXPLAINER.md` — Rewritten: Starlette + FastMCP, video_chat, removed dead code
- [x] Update `docs/API-REFERENCE.md` — New video-chat endpoint, removed dead chat/stream endpoints, updated MCP section
- [x] Update `CLAUDE.md` — explainer tech stack = Starlette + FastMCP + LiteLLM
- [x] Update `docs/ARCHITECTURE.md` — Updated service diagram, video_chat flow replaces explain_chat

### Schema Cleanup ✅
- [x] Remove dead `ExplainChatRequest`, `ExplainChatResponse`, `ExplainAutoRequest`, `ExplainAutoResponse` from `schemas.py`

---

## Progress Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| 1A — MCP Server | ✅ Complete | 2026-02-16 |
| 1B — Video Chat | ✅ Complete | 2026-02-16 |
| 1C — Go Deeper / Tell Me More | ✅ Complete | 2026-02-16 |
| 1D — Export | ✅ Complete | 2026-02-16 |
| Testing | ✅ Complete | 2026-02-16 |
| Documentation | ✅ Complete | 2026-02-16 |
