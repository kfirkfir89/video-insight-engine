# Explainer V2 — Implementation Plan

> Last Updated: 2026-02-16

## Executive Summary

Transform vie-explainer from an unused HTTP/FastAPI service into a production MCP server using Streamable HTTP transport. Wire explainer features (Go Deeper, Tell Me More, Video Chat, Export) into the video detail UI. Add per-user block customizations with a two-layer cache strategy.

**Scope:** This plan covers Phases 1A through 1D of PLAN-EXPLAINER-V2.md (the MVP). Phases 2A-3C are deferred.

**Key Insight:** The explainer service has *never* been integrated into the frontend. All existing code is backend-only dead code or never-called routes. This is effectively a greenfield build.

---

## Current State Analysis

### Explainer Service (`services/explainer/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `main.py` | HTTP/FastAPI entry point | Replace with Starlette + MCP |
| `server.py` | Deprecated MCP reference | Rewrite as production entry point |
| `tools/explain_auto.py` | Working tool | Adapt for MCP registration |
| `tools/explain_chat.py` | Dead code | Delete |
| `tools/explain_chat_stream.py` | Dead code | Delete |
| `tools/chat_utils.py` | Dead code | Delete |
| `prompts/chat_system.txt` | Dead code | Delete |
| `services/usage_tracker.py` | Empty, never imported | Delete |
| `services/llm.py` | Working LLM service | Keep, adapt |
| `services/llm_provider.py` | Working multi-provider | Keep |
| `repositories/` | Working async MongoDB | Keep |
| `config.py` | Working settings | Keep |
| `dependencies.py` | FastAPI-specific DI | Rewrite for Starlette/MCP |
| Tests | Mixed (some for dead code) | Update |

### API Service (`api/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `services/explainer-client.ts` | HTTP client | Rewrite to MCP client |
| `routes/explain.routes.ts` | 3 routes (1 used, 2 dead) | Refactor for MCP |
| `@modelcontextprotocol/sdk` | Already in package.json v1.25.2 | Ready to use |
| `container.ts` | Has explainerClient | Update |
| `config.ts` | Has EXPLAINER_URL | Keep |
| `routes/internal.routes.ts` | Expansion status handler | Review |

### Frontend (`apps/web/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `use-streaming-chat.ts` | Has `useExplainerChat` (orphaned) | Reuse for video chat |
| `RAGChatPanel.tsx` | Working chat UI | Reuse for video chat |
| `ConceptHighlighter.tsx` | Working inline highlighting | Add "Tell Me More" |
| `ConceptsContext.tsx` | Working concept provider | No changes needed |
| `ArticleSection.tsx` | Chapter display | Add "Go Deeper" button |
| `VideoDetailDesktop.tsx` | Desktop layout | Add chat panel tab |
| `VideoDetailMobile.tsx` | Mobile layout | Add chat drawer |
| `ContentBlockRenderer.tsx` | 31+ block types | No changes for Phase 1 |

### Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| `docker-compose.yml` | Service on port 8001 | Update CMD |
| `packages/types` | ContentBlock system (25+ types) | Add MergedBlock type |
| MongoDB | videoSummaryCache, systemExpansionCache exist | Add userBlockCustomizations |

---

## Proposed Future State (Phase 1 Complete)

```
vie-explainer (MCP Server — Streamable HTTP)
├── Tool: explain_auto      → Cached section/concept expansion
├── Tool: video_chat         → Chat about the video being viewed (NEW)
├── Endpoint: /mcp           → Streamable HTTP (stateless, json_response)
├── Endpoint: /health        → Docker health check
├── Framework: Starlette + FastMCP v1.x
└── No MongoDB access        → All context passed by caller

vie-api (BFF — MCP Client)
├── POST /api/explain/auto                → MCP explain_auto tool
├── POST /api/explain/video-chat          → MCP video_chat tool (NEW)
├── POST /api/explain/video-chat/stream   → SSE proxy (NEW)
├── BlockCustomizationService             → Merge base + user blocks (NEW)
├── systemExpansionCache                  → Shared cache (existing)
└── userBlockCustomizations               → Per-user overlay (NEW)

vie-web (Frontend)
├── "Go Deeper" on chapter headings       → Phase 1C
├── "Tell Me More" on concept tooltips    → Phase 1C
├── Video Chat Panel                      → Phase 1B
├── Copy as Markdown                      → Phase 1D
└── Download .md                          → Phase 1D
```

---

## Implementation Phases

### Phase 1A — Explainer Becomes MCP Server (~3-4 days)

**Goal:** Replace HTTP/FastAPI with Starlette + MCP. Delete dead code. Wire vie-api as MCP client.

#### 1A.1 Delete Dead Code
- **Effort:** S
- **Files to delete:**
  - `services/explainer/src/tools/explain_chat.py`
  - `services/explainer/src/tools/explain_chat_stream.py`
  - `services/explainer/src/tools/chat_utils.py`
  - `services/explainer/src/prompts/chat_system.txt`
  - `services/explainer/src/services/usage_tracker.py`
  - `services/explainer/tests/test_explain_chat.py`
- **Clean up:** `tools/__init__.py` imports
- **Acceptance:** No import errors, no test failures for remaining code

#### 1A.2 Rewrite server.py as MCP Entry Point
- **Effort:** L
- **Framework:** Starlette (NOT FastAPI — lifespan bug with MCP mounting)
- **SDK:** `mcp>=1.25,<2` (`FastMCP` from `mcp.server.fastmcp`)
- **Transport:** Streamable HTTP at `/mcp` with `stateless_http=True`, `json_response=True`
- **Health:** `/health` route in same Starlette app
- **Key decisions:**
  - Rewrite `dependencies.py` for non-FastAPI DI (manual init in lifespan)
  - `explain_auto` tool wraps existing `tools/explain_auto.py` logic
  - MongoDB init/teardown in Starlette lifespan
- **Acceptance:** `uvicorn src.server:app` starts, `/health` returns OK, `/mcp` accepts MCP tool calls

#### 1A.3 Update Dockerfile
- **Effort:** S
- **Change:** CMD from `src.main:app` to `src.server:app`
- **Update requirements.txt:** Pin `mcp>=1.25,<2`, add `starlette>=0.41.0`
- **Acceptance:** `docker-compose up vie-explainer` starts cleanly

#### 1A.4 Refactor API Explainer Client to MCP
- **Effort:** L
- **Current:** HTTP fetch to `/explain/auto`, `/explain/chat`, `/explain/chat/stream`
- **Target:** `@modelcontextprotocol/sdk` Client with `StreamableHTTPClientTransport`
- **Key changes:**
  - `explainAuto()` → `client.callTool({ name: 'explain_auto', arguments: {...} })`
  - Remove `explainChat()` and `explainChatStream()` (dead code)
  - Connection management: init on first call, reconnect on failure
- **Acceptance:** `explainAuto` route returns same results via MCP

#### 1A.5 Update API Routes
- **Effort:** M
- **Remove:** Chat-related endpoints (dead code)
- **Keep:** `GET /api/explain/:videoSummaryId/:targetType/:targetId` → uses MCP client
- **Update tests:** Remove chat route tests, update explain_auto tests for MCP client
- **Acceptance:** API tests pass, explain_auto route works through MCP

#### 1A.6 Docker & Integration Verification
- **Effort:** M
- **Update:** `docker-compose.yml` if needed (port, healthcheck)
- **Test:** Full docker-compose up, health checks pass, API → MCP flow works
- **Acceptance:** End-to-end explain_auto works in Docker

---

### Phase 1B — Video-Scoped Chat (~3-4 days)

**Goal:** Chat panel in video detail page. User asks about the video being viewed.

#### 1B.1 New MCP Tool: video_chat
- **Effort:** L
- **New file:** `services/explainer/src/tools/video_chat.py`
- **New prompt:** `services/explainer/src/prompts/video_chat_system.txt`
- **Context building:** title, TLDR, chapter titles + first 2-3 blocks, concepts, masterSummary
- **Streaming:** Tool returns streaming-compatible response
- **Acceptance:** MCP tool call returns grounded response

#### 1B.2 API Route for Video Chat
- **Effort:** M
- **New endpoint:** `POST /api/explain/video-chat` (SSE streaming)
- **Request:** `{ videoSummaryId, message, chatHistory? }`
- **Flow:** Load summary from cache → Pass context to MCP tool → Stream response
- **Auth:** Required, verify user access to video
- **Acceptance:** API endpoint streams response grounded in video content

#### 1B.3 Frontend: Video Chat Panel
- **Effort:** L
- **Reuse:** `RAGChatPanel.tsx` for UI, `use-streaming-chat.ts` for hook pattern
- **New component:** `VideoChatPanel.tsx` in `components/video-detail/`
- **Desktop:** Sidebar tab (alongside chapter nav)
- **Mobile:** Bottom drawer
- **Features:** "Ask about this video" input, suggested questions, session-only history
- **Acceptance:** Chat visible, streams responses, grounded in video content

#### 1B.4 Wire into VideoDetail Layouts
- **Effort:** M
- **Modify:** `VideoDetailDesktop.tsx` — add chat tab to sidebar
- **Modify:** `VideoDetailMobile.tsx` — add chat drawer
- **State:** Ephemeral (React state only, no persistence)
- **Acceptance:** Chat accessible on both layouts, responsive

---

### Phase 1C — Wire Go Deeper & Tell Me More (~2-3 days)

**Goal:** "Go Deeper" on chapters, "Tell Me More" on concepts. Backend already handles this — frontend wiring only.

#### 1C.1 Go Deeper on Chapters
- **Effort:** M
- **Modify:** `ArticleSection.tsx` — add "Go Deeper" button to chapter header
- **On click:** Call `GET /api/explain/:videoSummaryId/chapter/:chapterId`
- **Display:** Accordion below chapter content with expansion blocks
- **Cache:** Cached responses load instantly (system-level cache)
- **Acceptance:** Button visible, expansion renders inline, cached on second click

#### 1C.2 Tell Me More on Concepts
- **Effort:** M
- **Modify:** `ConceptHighlighter.tsx` — add "Tell Me More" to concept popover
- **On click:** Call `GET /api/explain/:videoSummaryId/concept/:conceptId`
- **Display:** Expanded content in popover or side panel
- **Acceptance:** Link visible in popover, expansion renders cleanly

#### 1C.3 Loading States & Error Handling
- **Effort:** S
- **Add:** Skeleton/spinner while LLM generates
- **Add:** Error state with retry option
- **Acceptance:** Loading state visible, errors don't crash UI

---

### Phase 1D — Export: Markdown + Copy (~2-3 days)

**Goal:** "Copy as text" and "Download as Markdown" — 100% client-side.

#### 1D.1 Block-to-Markdown Utility
- **Effort:** L
- **New file:** `apps/web/src/lib/block-to-markdown.ts`
- **Coverage:** All 25+ block types → Markdown
- **Functions:** `blockToMarkdown()`, `chapterToMarkdown()`, `summaryToMarkdown()`
- **Acceptance:** All block types produce valid Markdown

#### 1D.2 Copy & Download Buttons
- **Effort:** M
- **Copy:** `navigator.clipboard.writeText(markdown)` + toast notification
- **Download:** Blob → `URL.createObjectURL` → anchor click → `URL.revokeObjectURL`
- **Placement:** Full summary in video detail header, per-chapter in chapter dropdown
- **Acceptance:** Copy works, download produces valid .md file

---

## Per-User Block Customizations (Data Architecture)

### New MongoDB Collection: `userBlockCustomizations`

```typescript
interface UserBlockCustomization {
  _id: ObjectId;
  userId: ObjectId;
  videoSummaryId: ObjectId;
  chapterId: string;
  targetScope: 'block' | 'chapter';
  targetBlockId: string | null;
  strategy: 'append' | 'replace';
  action: 'expand' | 'simplify' | 'persona' | 'tell_me_more';
  mode?: string;
  blocks: ContentBlock[];
  collapsed: boolean;
  originalBlockSnapshot?: ContentBlock;
  systemCacheId?: ObjectId;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### New API Service: `BlockCustomizationService`

- **File:** `api/src/services/block-customization.service.ts`
- **Responsibility:** Merge base blocks + user customizations
- **Strategies:** Append (expansions after block) or Replace (simplify/persona)
- **Stacking:** Multiple expansions on same block

### Cache Strategy (Two Layers)

1. **systemExpansionCache** (shared): Same expansion across all users → no LLM call
2. **userBlockCustomizations** (per-user): Records which customizations user has active

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| FastAPI lifespan bug with MCP | High | Confirmed | Use Starlette (plan specifies this) |
| MCP SDK v2 breaking changes | High | Low (not released) | Pin `mcp>=1.25,<2` |
| Streaming through MCP | Medium | Medium | Test early, fallback to direct SSE |
| Large video contexts exceeding token limits | Medium | Medium | Truncate to masterSummary + key blocks |
| Concept popover "Tell Me More" UX | Low | Medium | Start with simple expansion, iterate |

---

## Success Metrics

- [ ] vie-explainer starts as MCP server in Docker
- [ ] explain_auto works end-to-end through MCP (same results as HTTP)
- [ ] Video chat returns grounded responses
- [ ] "Go Deeper" renders expansion inline with caching
- [ ] "Tell Me More" expands concept definitions
- [ ] Export produces valid Markdown for all 25+ block types
- [ ] No regression in existing functionality
- [ ] Dead code fully removed

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `mcp>=1.25,<2` (Python) | Needs pinning | Currently `mcp>=1.0.0` in requirements.txt |
| `starlette>=0.41.0` (Python) | New dependency | Replaces FastAPI for MCP mounting |
| `@modelcontextprotocol/sdk` (TS) | Already installed v1.25.2 | Ready to use |
| MongoDB | Running | New collection `userBlockCustomizations` |
| Docker | Running | CMD change only |

---

## Execution Order

```
Phase 1A (MCP + Cleanup)  ──→  Phase 1B (Video Chat)  ──→  Phase 1C (Go Deeper / Tell Me More)
                                        │
                                        └──→  Phase 1D (Export)  [parallel with 1C]
```

**No dependency on PLAN-MEMORIZE-V2.md.** This entire plan executes independently.
