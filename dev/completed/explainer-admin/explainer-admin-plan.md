# Plan 4: Explainer + Admin — Implementation Plan

**Last Updated: 2026-03-02**
**Branch:** `feat/explainer-admin`
**Base:** `dev-0`
**Depends on:** Plan 0 contracts (types + DB fields)
**Estimated Effort:** 4 days

---

## Executive Summary

Add `outputType` awareness to the explainer service so prompts adapt to content type (recipe vs tutorial vs workout etc.), and extend the admin dashboard with outputType analytics, share analytics, and tier distribution views. This plan is fully standalone — no downstream dependencies.

---

## Current State Analysis

### Explainer Service (`services/explainer/`)
- **explain_auto.py**: Pure function. Loads video summary, builds prompt context, calls LLM. Uses `explain_section.txt` and `explain_concept.txt` templates. No awareness of `outputType`.
- **video_chat.py**: Builds video context string, loads `video_chat_system.txt` system prompt. No awareness of `outputType`.
- **schemas.py**: `VideoSummary` Pydantic model has no `outputType` field.
- **Prompt templates**: Use `$video_title`, `$title`, `$summary`, `$bullets`, `$name`, `$definition` — none reference output type.

### Admin Service (`services/admin/`)
- **Routes**: `usage.py` (10 endpoints), `health.py` (4 endpoints), `alerts.py` (3 endpoints). No outputType, share, or tier analytics.
- **UI Components**: StatsCards (4 cards: cost, calls, avg duration, success rate), CostChart, FeatureBreakdown, ModelBreakdown, ServiceHealth, AlertsBanner, RecentCalls, LoginPrompt.
- **Hooks**: `use-admin-api.ts` — 14 React Query hooks for existing endpoints.
- **Pages**: Dashboard, Videos, Usage, Health, Alerts.
- **MongoDB collections used**: `llm_usage`, `llm_usage_daily`, `llm_alerts`, `llm_alert_config`, `health_history`, `videoSummaryCache`.

### Plan 0 Dependencies (NOT yet implemented)
- `OutputType` type literal not yet in `packages/types/src/index.ts`
- `outputType` field not yet on `videoSummaryCache` documents
- `shareSlug`, `viewsCount`, `likesCount` fields not yet on `videoSummaryCache`
- `tier` field not yet on `users` collection
- No sharing or tier infrastructure exists

---

## Proposed Future State

### Explainer — outputType-Aware Prompts
- `explain_auto.py` reads `outputType` from the loaded video summary and passes it to prompt templates
- `explain_section.txt` / `explain_concept.txt` include `$output_type` context so LLM frames explanations appropriately (e.g., "step" for recipes, "instruction" for tutorials)
- `video_chat.py` includes `outputType` in the system prompt so the chat assistant adapts its persona
- `video_chat_system.txt` gains a `$output_type_context` section describing how to adapt responses
- `schemas.py` VideoSummary model gains optional `outputType: str = "summary"` field

### Admin — New Analytics
- `/usage/by-output-type` endpoint aggregates LLM cost/calls by outputType (via `$lookup` to `videoSummaryCache`)
- `OutputTypeChart.tsx` renders a pie/donut chart of outputType distribution
- `StatsCards.tsx` gains a 5th card: "Total Tokens" (sum of tokens_in + tokens_out)
- `/shares/top` endpoint returns top shared videos by view count
- `/shares/stats` endpoint returns aggregate share metrics
- `/tiers/distribution` endpoint returns user count per tier
- `TierDistribution.tsx` renders tier breakdown (bar or pie chart)
- New routers registered in `main.py`

---

## Phase 1: Explainer outputType Compatibility (Day 1)

### 1.1 Update Explainer Schemas
**File:** `services/explainer/src/schemas.py`
- Add `output_type: str = "summary"` to `VideoSummary` model
- This makes the field optional (backward-compatible with existing cached data)
- **Effort:** S
- **Acceptance:** Schema validates with and without `outputType` in source data

### 1.2 Update explain_auto.py
**File:** `services/explainer/src/tools/explain_auto.py`
- Read `output_type` from loaded `video_summary` (default to `"summary"`)
- Add `output_type` to the context dict passed to both section and concept templates
- Add `output_type_label` (human-readable: "Recipe", "Tutorial", etc.) to context
- **Effort:** S
- **Acceptance:** `output_type` and `output_type_label` available in prompt context
- **Depends on:** 1.1

### 1.3 Update Prompt Templates
**Files:** `services/explainer/src/prompts/explain_section.txt`, `explain_concept.txt`
- Add `$output_type_label` to prompt preamble for contextual framing
- Section template: "This is from a $output_type_label video" — adapt tone accordingly
- Concept template: Add output-type context so definitions are framed appropriately
- Keep changes minimal — a single contextual line, not a restructure
- **Effort:** S
- **Acceptance:** Prompts render correctly with output type context

### 1.4 Update video_chat.py
**File:** `services/explainer/src/tools/video_chat.py`
- Read `output_type` from loaded video summary
- Build an `output_type_context` string (e.g., "This is a recipe video — frame answers around cooking steps and ingredients")
- Pass to system prompt template
- **Effort:** S
- **Acceptance:** System prompt includes output type guidance
- **Depends on:** 1.1

### 1.5 Update video_chat_system.txt
**File:** `services/explainer/src/prompts/video_chat_system.txt`
- Add `$output_type_context` after the rules section, before `$video_context`
- Keep it as a single adaptive line, not per-type branching
- **Effort:** S
- **Acceptance:** Template renders with output type context

### 1.6 Add Output Type Label Mapping
**File:** `services/explainer/src/tools/explain_auto.py` (or new `utils/output_type.py`)
- Create `OUTPUT_TYPE_LABELS` dict mapping outputType → human label + framing hint
- Example: `"recipe": ("Recipe", "Frame explanations around cooking steps, ingredients, and techniques")`
- Used by both explain_auto and video_chat
- **Effort:** S
- **Acceptance:** All 11 output types have labels and framing hints

### 1.7 Write Tests for outputType Integration
**Files:** `services/explainer/tests/test_explain_auto.py`, new `test_video_chat.py`
- Test explain_auto with outputType present in video summary
- Test explain_auto with outputType absent (backward compat)
- Test video_chat system prompt includes output type context
- Test OUTPUT_TYPE_LABELS completeness
- **Effort:** M
- **Acceptance:** All tests pass, covers both present/absent outputType scenarios

---

## Phase 2: Admin Dashboard Updates (Days 2-3)

### 2.1 Add outputType Aggregation Endpoint
**File:** `services/admin/src/routes/usage.py`
- `GET /usage/by-output-type?days=30` — aggregates from `llm_usage` joined with `videoSummaryCache` via `video_id` → `youtubeId`
- Pipeline: `$lookup` videoSummaryCache on `video_id` → `youtubeId`, `$group` by `outputType`, `$sort` by cost desc
- Returns `[{ outputType, cost, calls, tokens }]`
- Add TTLCache entry (30s like other aggregations)
- **Effort:** M
- **Acceptance:** Endpoint returns correct aggregation, cached
- **Depends on:** Plan 0 (outputType field in videoSummaryCache) — can mock for dev

### 2.2 Add totalTokens to Stats Endpoint
**File:** `services/admin/src/routes/usage.py`
- Extend `/usage/stats` response to include `total_tokens` (sum of `tokens_in + tokens_out`)
- Already computes `total_calls`, `total_cost` — add token sum to same pipeline
- **Effort:** S
- **Acceptance:** `/usage/stats` response includes `total_tokens` field

### 2.3 Create OutputTypeChart Component
**File:** `services/admin/ui/src/components/OutputTypeChart.tsx` (new)
- Recharts `PieChart` (donut style, matching `ModelBreakdown.tsx` pattern)
- Color palette: 11 colors for 11 output types (extend `--chart-*` tokens or hardcode)
- Shows outputType name + call count + cost
- Tooltip with details, Legend below
- Loading skeleton matching existing chart components
- **Effort:** M
- **Acceptance:** Chart renders with mock/real data, matches admin design system
- **Depends on:** 2.1, 2.5

### 2.4 Update StatsCards with Total Tokens
**File:** `services/admin/ui/src/components/StatsCards.tsx`
- Add 5th card: "Total Tokens" with token icon
- Format large numbers with abbreviations (e.g., "1.2M")
- Match existing card styling (colored icon, soft background, left-border)
- **Effort:** S
- **Acceptance:** 5th card renders with correct token count
- **Depends on:** 2.2, 2.5

### 2.5 Add New API Hooks
**File:** `services/admin/ui/src/hooks/use-admin-api.ts`
- `useUsageByOutputType(days)` — calls `/usage/by-output-type`
- `useSharesTop(days, limit)` — calls `/shares/top`
- `useSharesStats(days)` — calls `/shares/stats`
- `useTierDistribution()` — calls `/tiers/distribution`
- Add type definitions in `ui/src/lib/api.ts`
- **Effort:** S
- **Acceptance:** Hooks return typed data, follow existing patterns (React Query)

### 2.6 Add OutputTypeChart to Dashboard
**File:** `services/admin/ui/src/pages/DashboardPage.tsx`
- Add `OutputTypeChart` to the dashboard grid
- Place alongside or below ModelBreakdown
- **Effort:** S
- **Acceptance:** Chart visible on dashboard, responsive layout
- **Depends on:** 2.3

### 2.7 Write Admin Backend Tests
**Files:** `services/admin/tests/test_usage_output_type.py` (new)
- Test `/usage/by-output-type` endpoint with mocked data
- Test `/usage/stats` includes `total_tokens`
- Test edge cases: no data, single outputType, all types
- **Effort:** M
- **Acceptance:** Tests pass, cover happy path and edge cases

### 2.8 Write Admin UI Tests
**Files:** `services/admin/ui/e2e/output-type.spec.ts` (new or extend `usage.spec.ts`)
- Test OutputTypeChart renders
- Test StatsCards shows 5th token card
- Test data loading states
- **Effort:** M
- **Acceptance:** E2E tests pass

---

## Phase 3: Share + Tier Analytics (Day 4)

### 3.1 Create Shares Route
**File:** `services/admin/src/routes/shares.py` (new)
- `GET /shares/top?days=30&limit=10` — top shared videos by `viewsCount`
  - Query `videoSummaryCache` where `shareSlug` exists, sort by `viewsCount` desc
  - Return: `[{ title, youtubeId, shareSlug, viewsCount, likesCount, sharedAt, outputType }]`
- `GET /shares/stats?days=30` — aggregate share metrics
  - Total shared count, total views, total likes, avg views per share
- Add TTLCache (30s)
- **Effort:** M
- **Acceptance:** Both endpoints return correct data, handle empty state
- **Depends on:** Plan 0 (share fields in videoSummaryCache)

### 3.2 Create Tiers Route
**File:** `services/admin/src/routes/tiers.py` (new)
- `GET /tiers/distribution` — user count per tier
  - Aggregate `users` collection, group by `tier` field (default `"free"`)
  - Return: `[{ tier, count, percentage }]`
- Add TTLCache (60s — changes less frequently)
- **Effort:** S
- **Acceptance:** Endpoint returns tier breakdown, handles missing tier field
- **Depends on:** Plan 0 (tier field in users collection)

### 3.3 Create TierDistribution Component
**File:** `services/admin/ui/src/components/TierDistribution.tsx` (new)
- Recharts `BarChart` (horizontal bars, matching `FeatureBreakdown.tsx` pattern)
- 3 bars: free, pro, team — each with count and percentage label
- Color-coded (gray for free, primary for pro, accent for team)
- Loading skeleton
- **Effort:** M
- **Acceptance:** Chart renders, matches admin design system

### 3.4 Create SharesTable Component
**File:** `services/admin/ui/src/components/SharesTable.tsx` (new)
- Table showing top shared outputs
- Columns: Title, Output Type, Views, Likes, Shared At
- Clickable rows linking to video detail
- Empty state message
- **Effort:** M
- **Acceptance:** Table renders with data, empty state works

### 3.5 Register New Routers
**File:** `services/admin/src/main.py`
- Import and register `shares_router` and `tiers_router`
- Add to lifespan index creation if needed (share/tier queries may benefit from indexes)
- **Effort:** S
- **Acceptance:** New routes accessible, health check still works
- **Depends on:** 3.1, 3.2

### 3.6 Create Analytics Page (or extend Dashboard)
**File:** `services/admin/ui/src/pages/DashboardPage.tsx` (extend) or new `AnalyticsPage.tsx`
- Add TierDistribution and SharesTable to dashboard or a new "Analytics" tab
- If new page: add nav link in `App.tsx`
- **Effort:** S
- **Acceptance:** New components visible and accessible
- **Depends on:** 3.3, 3.4, 2.5

### 3.7 Write Share/Tier Backend Tests
**Files:** `services/admin/tests/test_shares.py`, `test_tiers.py` (new)
- Test `/shares/top` and `/shares/stats` endpoints
- Test `/tiers/distribution` endpoint
- Test empty states, edge cases
- **Effort:** M
- **Acceptance:** Tests pass

### 3.8 Write Share/Tier UI Tests
**Files:** `services/admin/ui/e2e/analytics.spec.ts` (new)
- Test TierDistribution renders
- Test SharesTable renders with data
- Test empty states
- **Effort:** M
- **Acceptance:** E2E tests pass

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Plan 0 not complete (outputType field missing) | High | Medium | Use `output_type = getattr(summary, 'output_type', 'summary')` fallback; mock for dev |
| Share fields not in DB yet | Medium | Medium | Shares route returns empty list gracefully; guard with field existence checks |
| Tier field not in users collection | Medium | Medium | Default to `"free"` if field missing; `$ifNull` in aggregation |
| Explainer prompt changes degrade quality | Medium | Low | Keep changes minimal (one contextual line); test with multiple output types |
| Admin chart colors clash | Low | Low | Follow existing `--chart-*` palette; extend if needed |

---

## Success Metrics

1. Explainer prompts adapt framing based on outputType (verifiable in generated content)
2. Admin dashboard shows outputType distribution chart
3. Admin StatsCards displays 5th "Total Tokens" card
4. Admin shows top shared outputs with view/like counts
5. Admin shows user tier distribution
6. All new endpoints have test coverage >= 80%
7. No regression in existing admin functionality
8. Backward compatible — works with and without outputType in DB

---

## Required Resources

- **Explainer service**: `services/explainer/` — Python, prompts, Pydantic schemas
- **Admin backend**: `services/admin/src/` — Python FastAPI routes
- **Admin frontend**: `services/admin/ui/` — React, Recharts, React Query
- **Shared types**: `packages/types/src/index.ts` — Plan 0 dependency
- **MongoDB**: `videoSummaryCache`, `users`, `llm_usage` collections
