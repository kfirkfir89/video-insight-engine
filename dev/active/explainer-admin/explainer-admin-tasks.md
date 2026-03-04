# Plan 4: Explainer + Admin — Task Checklist

**Last Updated: 2026-03-02**

---

## Phase 1: Explainer outputType Compatibility (Day 1)

- [x] **1.1** Update `schemas.py` — add `output_type: str = "summary"` to VideoSummary (S)
- [x] **1.2** Create output type label mapping — `OUTPUT_TYPE_LABELS` dict with labels + framing hints (S)
- [x] **1.3** Update `explain_auto.py` — read outputType, add to prompt context (S) [depends: 1.1, 1.2]
- [x] **1.4** Update `explain_section.txt` — add `$output_type_label` contextual line (S)
- [x] **1.5** Update `explain_concept.txt` — add `$output_type_label` contextual line (S)
- [x] **1.6** Update `video_chat.py` — read outputType, build output_type_context (S) [depends: 1.1, 1.2]
- [x] **1.7** Update `video_chat_system.txt` — add `$output_type_context` section (S)
- [x] **1.8** Write explainer tests — outputType present/absent scenarios (M) [depends: 1.3, 1.6]

## Phase 2: Admin Dashboard Updates (Days 2-3)

- [x] **2.1** Add `/usage/by-output-type` endpoint in `usage.py` (M)
- [x] **2.2** Extend `/usage/stats` to include `total_tokens` (S)
- [x] **2.3** Add hooks: `useUsageByOutputType`, `useSharesTop`, `useSharesStats`, `useTierDistribution` (S)
- [x] **2.4** Add API types + endpoint functions in `api.ts` (S)
- [x] **2.5** Create `OutputTypeChart.tsx` — donut chart (M) [depends: 2.1, 2.3]
- [x] **2.6** Update `StatsCards.tsx` — add 5th "Total Tokens" card (S) [depends: 2.2, 2.3]
- [x] **2.7** Add OutputTypeChart to `DashboardPage.tsx` (S) [depends: 2.5]
- [x] **2.8** Write admin backend tests for outputType + totalTokens (M) [depends: 2.1, 2.2]
- [x] **2.9** Write admin UI tests for new components (M) [depends: 2.5, 2.6]

## Phase 3: Share + Tier Analytics (Day 4)

- [x] **3.1** Create `shares.py` route — `/shares/top`, `/shares/stats` (M)
- [x] **3.2** Create `tiers.py` route — `/tiers/distribution` (S)
- [x] **3.3** Register new routers in `main.py` (S) [depends: 3.1, 3.2]
- [x] **3.4** Create `TierDistribution.tsx` — horizontal bar chart (M) [depends: 2.3]
- [x] **3.5** Create `SharesTable.tsx` — top shared outputs table (M) [depends: 2.3]
- [x] **3.6** Add share/tier components to Dashboard or new Analytics page (S) [depends: 3.4, 3.5]
- [x] **3.7** Write share/tier backend tests (M) [depends: 3.1, 3.2]
- [x] **3.8** Write share/tier UI tests (M) [depends: 3.4, 3.5]

---

## Summary

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| 1. Explainer | 8 | 1 day | **Complete** |
| 2. Admin Dashboard | 9 | 2 days | **Complete** |
| 3. Share + Tier | 8 | 1 day | **Complete** |
| **Total** | **25** | **4 days** | **Complete** |

---

## Test Results

| Suite | Passed | Failed | Notes |
|-------|--------|--------|-------|
| Explainer Python (pytest) | 54 | 2 | Pre-existing failures (missing chat_system.txt, sections assertion) |
| Admin Python (pytest) | 33 | 0 | All pass |
| Admin UI (vitest) | 24 | 0 | All pass |
| Admin E2E (Playwright) | 164 | 1 | Pre-existing flaky loading skeleton timing test |

### New Tests Written
- `services/explainer/tests/test_output_type.py` — 7 tests (label mapping completeness)
- `services/explainer/tests/test_video_chat.py` — 11 tests (chat + outputType awareness)
- `services/explainer/tests/test_explain_auto.py` — extended with 3 outputType tests
- `services/admin/tests/test_shares.py` — 5 tests (auth + validation)
- `services/admin/tests/test_tiers.py` — 2 tests (auth)
- `services/admin/tests/test_usage_output_type.py` — 6 tests (auth + validation + computation)
- `services/admin/ui/src/components/OutputTypeChart.test.tsx` — 1 test (export)
- `services/admin/ui/src/components/SharesTable.test.tsx` — 1 test (export)
- `services/admin/ui/src/components/TierDistribution.test.tsx` — 1 test (export)
- `services/admin/ui/e2e/dashboard.spec.ts` — extended with 5 new E2E tests
- `services/admin/ui/e2e/fixtures.ts` — added mock data + route mocks for 4 new endpoints

### Playwright Layout/Responsivity (all viewports: desktop 1280px, tablet 768px, mobile 375px)
- No horizontal overflow detected on any viewport
- No horizontal scrollbar on any page
- All tables in overflow containers
- All new components (OutputTypeChart, SharesTable, TierDistribution) render correctly
- Section dividers (Analytics, Community, Services) visible
- Nav links accessible at all viewport sizes

---

## Notes

- All phases can be developed in parallel with Plan 0 using safe defaults
- Phase 1 is fully independent of Phases 2-3
- Phases 2 and 3 share the hooks file (2.3) but are otherwise independent
- Frontend components follow existing admin patterns (Recharts, React Query)
