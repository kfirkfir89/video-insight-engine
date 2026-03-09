# API Routes + Services — Context

**Last Updated:** 2026-03-02
**Status:** COMPLETE — All 9 phases + docs (601 tests passing, 0 TypeScript errors, docs updated)

---

## Key Files to Read Before Coding

### Core Architecture (Must Read)

| File | Purpose | Why It Matters |
|------|---------|----------------|
| `api/src/app.ts` | App builder, plugin/route registration | Where to register new routes |
| `api/src/container.ts` | DI container factory | Where to add new services/repos |
| `api/src/config.ts` | Env var validation (Zod) | Where to add Paddle + cost env vars |
| `api/src/utils/errors.ts` | AppError + 20 domain errors | Pattern for new error classes |
| `api/src/plugins/mongodb.ts` | DB connection + indexes | Where to add new indexes |

### Patterns to Follow (Reference)

| File | Pattern | Copy For |
|------|---------|----------|
| `api/src/routes/videos.routes.ts` | Route handler structure | All new routes |
| `api/src/routes/explain.routes.ts` | Auth + ownership check | Share, override routes |
| `api/src/services/video.service.ts` | Service with DI | All new services |
| `api/src/repositories/video.repository.ts` | Repository with collection access | Share repository |
| `api/src/schemas/video.schema.ts` | Zod validation schemas | All new input validation |
| `api/src/plugins/rate-limit.ts` | Per-route rate limiting | Tier-aware rate limits |
| `api/src/routes/stream.routes.ts` | SSE proxy pattern | Stream updates |
| `api/src/services/summarizer-client.ts` | External HTTP client | Override + breaker |
| `api/src/routes/internal.routes.ts` | Service-to-service auth | Webhook pattern ref |

### Tests to Reference

| File | Pattern |
|------|---------|
| `api/src/routes/videos.routes.test.ts` | Route integration testing |
| `api/src/services/video.service.test.ts` | Service unit testing |
| `api/src/test/helpers.ts` | Mock container, test app builder |
| `api/src/test/setup.ts` | MongoDB memory server setup |

### Shared Types

| File | Contains |
|------|----------|
| `packages/types/src/index.ts` | All shared TypeScript types |
| `plan-0-contracts.md` | New types to be added (OutputType, UserTier, ShareInfo, etc.) |

### Documentation

| File | Contains |
|------|----------|
| `docs/SERVICE-API.md` | vie-api architecture overview |
| `docs/API-REFERENCE.md` | All existing API contracts |
| `docs/DATA-MODELS.md` | MongoDB schemas |
| `docs/ERROR-HANDLING.md` | Error codes + strategies |
| `docs/SECURITY.md` | Auth, rate limiting, CORS |
| `docs/CROSS-CUTTING.md` | Multi-service development guide |

---

## Key Decisions

### D1: Share Slug Strategy
- **Decision:** Use nanoid (10 chars, URL-safe alphabet)
- **Why:** Short, collision-resistant, no sequential guessing
- **Alternative considered:** UUID (too long for URLs), auto-increment (guessable)

### D2: SSR Approach
- **Decision:** Template function returning HTML string (no SSR framework)
- **Why:** Minimal overhead, only used for share pages, no hydration needed
- **Alternative considered:** Next.js (overkill), React renderToString (unnecessary dependency)

### D3: OG Image Generation
- **Decision:** satori or @vercel/og for generating images from JSX-like templates
- **Why:** Programmatic, cacheable, no headless browser needed
- **Alternative considered:** Puppeteer screenshots (heavy, slow), static templates (inflexible)

### D4: Payment Provider
- **Decision:** Paddle (merchant of record)
- **Why:** Handles VAT/tax, simpler than Stripe for solo dev
- **Alternative considered:** Stripe (more control but more tax burden)

### D5: Cost Monitoring Data Source
- **Decision:** Aggregate from `llm_usage` collection (already exists via admin panel)
- **Why:** Single source of truth, already tracked by summarizer
- **Alternative considered:** Separate cost tracking (duplication)

### D6: Tier Caching
- **Decision:** Read tier from DB per authenticated request, no separate cache layer
- **Why:** Simple, correct, user tier changes are infrequent
- **Alternative considered:** Redis cache (adds complexity, No Redis in MVP)

### D7: View Count Deduplication
- **Decision:** Simple approach — increment on every GET, no session tracking
- **Why:** MVP simplicity. Exact counts aren't critical for sharing
- **Alternative considered:** IP+24h window (complex, privacy concerns), session cookies (breaks for crawlers)

### D8: Like Deduplication
- **Decision:** Track by IP hash per slug in a sub-document or separate collection
- **Why:** Prevent obvious abuse without requiring auth
- **Alternative considered:** Require auth to like (friction), cookie-based (bypassable)

### D9: Expiration and Shared Content
- **Decision:** Shared summaries (shareSlug != null) are exempt from TTL expiration
- **Why:** Breaking shared links is worse than storing extra data
- **Alternative considered:** Expire anyway (bad UX), copy to separate collection (complexity)

---

## Dependencies Between Phases

```
Plan 0 (Types + DB Schema)
    │
    ▼
Phase 1 (DB Indexes)
    │
    ├──────────────────┬─────────────────┬────────────────┐
    ▼                  ▼                 ▼                ▼
Phase 2 (Share)   Phase 4 (Override)  Phase 5 (Payment)  Phase 7 (Cost)
    │                                    │                Phase 8 (Stream)
    ▼                                    ▼
Phase 3 (SSR)                       Phase 6 (Tier MW)
                                         │
                                         ▼
                                    Phase 9 (Expiration)
```

---

## Environment Variables to Add

```bash
# Payment (Paddle)
PADDLE_VENDOR_ID=         # Paddle vendor ID
PADDLE_API_KEY=           # Paddle API key
PADDLE_WEBHOOK_SECRET=    # Webhook signature verification
PADDLE_PRO_PRICE_ID=      # Price ID for Pro tier
PADDLE_TEAM_PRICE_ID=     # Price ID for Team tier

# Cost Monitoring
COST_DAILY_LIMIT=50.00   # Daily LLM spend limit in USD
```

---

## New npm Dependencies

| Package | Version | Phase | Purpose |
|---------|---------|-------|---------|
| `nanoid` | ^5.x | Phase 2 | URL-safe slug generation |
| `@paddle/paddle-node-sdk` | Latest | Phase 5 | Paddle API integration |
| `satori` | ^0.x | Phase 3 | OG image generation (JSX to SVG) |
| `@resvg/resvg-js` | ^2.x | Phase 3 | SVG to PNG conversion |

---

## New Error Classes to Add

| Error | Code | HTTP | Phase |
|-------|------|------|-------|
| `ShareNotFoundError` | `SHARE_NOT_FOUND` | 404 | Phase 2 |
| `AlreadySharedError` | `ALREADY_SHARED` | 409 | Phase 2 |
| `ShareNotAllowedError` | `SHARE_NOT_ALLOWED` | 403 | Phase 2 (tier check) |
| `InvalidCategoryError` | `INVALID_CATEGORY` | 400 | Phase 4 |
| `PaymentError` | `PAYMENT_ERROR` | 500 | Phase 5 |
| `InvalidWebhookError` | `INVALID_WEBHOOK` | 400 | Phase 5 |
| `TierLimitExceededError` | `TIER_LIMIT_EXCEEDED` | 403 | Phase 6 |
| `CostLimitExceededError` | `COST_LIMIT_EXCEEDED` | 503 | Phase 7 |

---

## New MongoDB Indexes

| Collection | Index | Type | Phase |
|-----------|-------|------|-------|
| `videoSummaryCache` | `{ outputType: 1 }` | Standard | Phase 1 |
| `videoSummaryCache` | `{ shareSlug: 1 }` | Unique sparse | Phase 1 |
| `videoSummaryCache` | `{ expiresAt: 1 }` | TTL (0s) | Phase 1 |
| `users` | `{ tier: 1 }` | Standard | Phase 1 |

---

## DI Container Additions

```typescript
// New repositories
shareRepository: ShareRepository

// New services
shareService: ShareService
ogImageService: OgImageService
paymentService: PaymentService
costMonitorService: CostMonitorService
```

---

## Testing Strategy

| Phase | Unit Tests | Integration Tests | Notes |
|-------|-----------|-------------------|-------|
| Phase 1 | N/A | Index creation test | Verify indexes exist |
| Phase 2 | ShareService logic | Share routes (auth, public) | Slug generation, view/like counting |
| Phase 3 | Template rendering | SSR route (HTML output) | OG tag validation |
| Phase 4 | Override logic | Override route (auth, validation) | Category enum validation |
| Phase 5 | PaymentService logic | Webhook route (signature) | Idempotency, event handling |
| Phase 6 | Tier calculation | Tier-aware rate limits | Free vs Pro behavior |
| Phase 7 | Threshold logic | Breaker integration | Model switching |
| Phase 8 | Event parsing | Stream forwarding | New event type handling |
| Phase 9 | Expiration calc | Tier transition | TTL behavior |

---

## Files Modified (Summary)

### New Files (13)
1. `api/src/routes/share.routes.ts`
2. `api/src/routes/ssr.routes.ts`
3. `api/src/routes/override.routes.ts`
4. `api/src/routes/payment.routes.ts`
5. `api/src/services/share.service.ts`
6. `api/src/services/og-image.service.ts`
7. `api/src/services/payment.service.ts`
8. `api/src/services/cost-monitor.service.ts`
9. `api/src/repositories/share.repository.ts`
10. `api/src/plugins/tier.ts`
11. `api/src/templates/share-page.ts`
12. `api/src/schemas/share.schema.ts`
13. `api/src/schemas/payment.schema.ts`

### Modified Files (9)
1. `api/src/app.ts` — register new routes + tier plugin
2. `api/src/container.ts` — add new services/repos
3. `api/src/config.ts` — add Paddle + cost env vars
4. `api/src/plugins/mongodb.ts` — add new indexes
5. `api/src/plugins/rate-limit.ts` — tier-aware limits
6. `api/src/routes/videos.routes.ts` — tier check on POST
7. `api/src/routes/stream.routes.ts` — detection_result event
8. `api/src/services/video.service.ts` — overrideCategory, expiration
9. `api/src/services/summarizer-client.ts` — override, breaker check
10. `api/src/utils/errors.ts` — new error classes
