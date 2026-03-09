# Plan 4: Explainer + Admin — Context

**Last Updated: 2026-03-02**
**Status: COMPLETE**

---

## All Phases Complete

All 25 tasks across 3 phases have been implemented, tested, and verified.

### Phase 1: Explainer outputType Compatibility
- `schemas.py` — `output_type: str = "summary"` field on VideoSummary
- `utils/output_type.py` — OUTPUT_TYPE_LABELS mapping (11 types with labels + framing hints)
- `explain_auto.py` — reads outputType, passes label + hint to prompt context
- `explain_section.txt` / `explain_concept.txt` — include `$output_type_label` and `$output_type_hint`
- `video_chat.py` — builds `output_type_context` for system prompt
- `video_chat_system.txt` — includes `$output_type_context`

### Phase 2: Admin Dashboard Updates
- `usage.py` — `/usage/by-output-type` endpoint + `total_tokens` in `/usage/stats`
- `api.ts` — types: OutputTypeUsage, ShareItem, ShareStats, TierItem + endpoint functions
- `use-admin-api.ts` — 4 new hooks: useUsageByOutputType, useSharesTop, useSharesStats, useTierDistribution
- `OutputTypeChart.tsx` — Recharts PieChart (donut) showing cost by output type
- `StatsCards.tsx` — 5th "Total Tokens" card with CoinsIcon + fmtTokens formatter
- `DashboardPage.tsx` — OutputTypeChart + SharesTable + TierDistribution in grid layout

### Phase 3: Share + Tier Analytics
- `shares.py` — `/shares/top` and `/shares/stats` endpoints with TTLCache
- `tiers.py` — `/tiers/distribution` endpoint with $ifNull fallback to "free"
- `main.py` — both routers registered
- `TierDistribution.tsx` — Recharts horizontal BarChart with count + percentage labels
- `SharesTable.tsx` — Table with title, type badge, views (EyeIcon), likes (HeartIcon)
- Dashboard "Community" section with SharesTable + TierDistribution

### Tests
- 37 new tests written across Python (21) and TypeScript (16)
- Playwright E2E tests cover all new components across 3 viewports
- No horizontal overflow issues detected
- All responsive breakpoints verified

---

## Key Files

### Explainer Service (Modified)
| File | Changes |
|------|---------|
| `services/explainer/src/schemas.py` | Added `output_type` field |
| `services/explainer/src/utils/output_type.py` | New — label/hint mapping |
| `services/explainer/src/tools/explain_auto.py` | outputType awareness |
| `services/explainer/src/tools/video_chat.py` | outputType in system prompt |
| `services/explainer/src/prompts/explain_section.txt` | $output_type_label + hint |
| `services/explainer/src/prompts/explain_concept.txt` | $output_type_label + hint |
| `services/explainer/src/prompts/video_chat_system.txt` | $output_type_context |

### Admin Backend (Modified + Created)
| File | Changes |
|------|---------|
| `services/admin/src/routes/usage.py` | `/usage/by-output-type` + total_tokens |
| `services/admin/src/routes/shares.py` | New — `/shares/top`, `/shares/stats` |
| `services/admin/src/routes/tiers.py` | New — `/tiers/distribution` |
| `services/admin/src/main.py` | Register shares + tiers routers |

### Admin Frontend (Modified + Created)
| File | Changes |
|------|---------|
| `services/admin/ui/src/components/OutputTypeChart.tsx` | New — donut chart |
| `services/admin/ui/src/components/TierDistribution.tsx` | New — bar chart |
| `services/admin/ui/src/components/SharesTable.tsx` | New — table |
| `services/admin/ui/src/components/StatsCards.tsx` | 5th Total Tokens card |
| `services/admin/ui/src/hooks/use-admin-api.ts` | 4 new hooks |
| `services/admin/ui/src/lib/api.ts` | New types + endpoints |
| `services/admin/ui/src/pages/DashboardPage.tsx` | Community section |

### Tests (Created)
| File | Tests |
|------|-------|
| `services/explainer/tests/test_output_type.py` | 7 |
| `services/explainer/tests/test_video_chat.py` | 11 |
| `services/explainer/tests/test_explain_auto.py` | +3 (outputType) |
| `services/admin/tests/test_shares.py` | 5 |
| `services/admin/tests/test_tiers.py` | 2 |
| `services/admin/tests/test_usage_output_type.py` | 6 |
| `services/admin/ui/src/components/OutputTypeChart.test.tsx` | 1 |
| `services/admin/ui/src/components/SharesTable.test.tsx` | 1 |
| `services/admin/ui/src/components/TierDistribution.test.tsx` | 1 |
| `services/admin/ui/e2e/dashboard.spec.ts` | +5 (new components) |
| `services/admin/ui/e2e/fixtures.ts` | +4 mock datasets + routes |
