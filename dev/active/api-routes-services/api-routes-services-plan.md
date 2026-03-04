# Plan 2: API Routes + Services

**Last Updated:** 2026-03-02
**Status:** Planning
**Depends on:** Plan 0 (shared types + DB schema changes)
**Produces:** API endpoints consumed by Plan 1 (frontend)

---

## Executive Summary

Implement the full set of new API routes and services for v1.4 features: sharing, SSR, detection override, payments, tier middleware, cost circuit breakers, stream updates, and output expiration. This builds on top of the existing well-architected vie-api (Fastify + DI container + repository pattern) and follows established patterns for routes, services, repositories, error handling, and testing.

---

## Current State Analysis

### What Exists (Healthy Foundation)

| Component | Status | Notes |
|-----------|--------|-------|
| DI Container (`container.ts`) | Solid | Manual injection, 78 lines, clean pattern |
| App Builder (`app.ts`) | Solid | Plugin registration, error handler, route mounting |
| Config (`config.ts`) | Solid | Zod validation, computed properties |
| Error System (`utils/errors.ts`) | Solid | AppError base + 20+ domain errors |
| Auth (JWT) | Complete | Access (15m) + Refresh (7d httpOnly cookie) |
| Rate Limiting | Basic | Global 300/min, per-route overrides |
| MongoDB Plugin | Complete | Connection + indexes on `onReady` |
| Video CRUD | Complete | 386-line service, versioning, cache strategy |
| Stream (SSE proxy) | Complete | Proxies summarizer SSE, metadata persistence |
| Explain (MCP) | Complete | explain_auto + video_chat |
| Tests | 18 test files | Route + Service + Repository + Utility tests |

### What's Missing (This Plan Creates)

| Feature | Files to Create | Files to Modify |
|---------|----------------|-----------------|
| Share Routes + Service | 3 new files | app.ts, container.ts |
| SSR Route + Templates | 3 new files | app.ts |
| Detection Override | 1 new file | video.service.ts, summarizer-client.ts |
| Payment Routes + Service | 2 new files | app.ts, container.ts, config.ts |
| Tier Middleware | 1 new file | rate-limit.ts, videos.routes.ts |
| Cost Circuit Breaker | 1 new file | summarizer-client.ts, config.ts |
| Stream Updates | 0 new files | stream.routes.ts |
| Output Expiration | 0 new files | video.service.ts, mongodb.ts |

---

## Proposed Future State

After implementation, the API will have:

```
api/src/
├── routes/
│   ├── share.routes.ts          # NEW: Share endpoints
│   ├── ssr.routes.ts            # NEW: Server-side rendered share pages
│   ├── override.routes.ts       # NEW: Detection category override
│   ├── payment.routes.ts        # NEW: Paddle webhook + checkout + tier
│   ├── stream.routes.ts         # MODIFIED: detection_result event
│   └── videos.routes.ts         # MODIFIED: tier check on creation
│
├── services/
│   ├── share.service.ts         # NEW: Slug generation, public retrieval
│   ├── og-image.service.ts      # NEW: OG image generation
│   ├── payment.service.ts       # NEW: Paddle integration
│   ├── cost-monitor.service.ts  # NEW: Daily spend tracking
│   ├── video.service.ts         # MODIFIED: overrideCategory, expiration
│   └── summarizer-client.ts     # MODIFIED: override call, breaker check
│
├── repositories/
│   └── share.repository.ts      # NEW: Share-specific DB queries
│
├── plugins/
│   ├── tier.ts                  # NEW: Tier decorator middleware
│   ├── mongodb.ts               # MODIFIED: New indexes
│   └── rate-limit.ts            # MODIFIED: Tier-aware limits
│
├── templates/
│   └── share-page.ts            # NEW: HTML template for SSR
│
└── config.ts                    # MODIFIED: Paddle + cost env vars
```

---

## Implementation Phases

### Phase 1: DB Schema + Indexes (Days 1-2) [Effort: M]

**Prerequisite:** Plan 0 types must be merged.

Modify `api/src/plugins/mongodb.ts` to add new indexes:

| Index | Collection | Type | Purpose |
|-------|-----------|------|---------|
| `{ outputType: 1 }` | videoSummaryCache | Standard | Filter by output type |
| `{ shareSlug: 1 }` | videoSummaryCache | Unique sparse | Lookup shared summaries |
| `{ expiresAt: 1 }` | videoSummaryCache | TTL (expireAfterSeconds: 0) | Auto-cleanup expired |
| `{ tier: 1 }` | users | Standard | Filter by tier |

Run Plan 0 backfill script to populate new fields on existing documents.

**Acceptance Criteria:**
- All indexes created successfully on app startup
- Backfill script runs idempotently
- Existing data unaffected
- Tests pass with new schema

---

### Phase 2: Share Routes + Service (Days 2-4) [Effort: L]

The core sharing feature: generate share slugs, retrieve public summaries, track engagement.

#### 2a. Share Repository (`api/src/repositories/share.repository.ts`)

```typescript
class ShareRepository {
  // Find by slug (public, no auth)
  findBySlug(slug: string): Promise<VideoSummaryCache | null>
  // Mark as shared (generate slug)
  markAsShared(videoSummaryId: ObjectId, slug: string): Promise<void>
  // Increment views
  incrementViews(slug: string): Promise<void>
  // Increment likes (with IP dedup via separate collection or field)
  incrementLikes(slug: string): Promise<void>
  // Check if already shared
  getShareInfo(videoSummaryId: ObjectId): Promise<ShareInfo | null>
}
```

#### 2b. Share Service (`api/src/services/share.service.ts`)

```typescript
class ShareService {
  constructor(
    private shareRepository: ShareRepository,
    private videoRepository: VideoRepository
  )

  // Generate share slug using nanoid, validate user owns video
  createShare(userId: string, videoSummaryId: string): Promise<ShareInfo>
  // Get public summary (no auth, increment views)
  getPublicSummary(slug: string): Promise<PublicVideoSummary>
  // Like a shared summary
  likeShare(slug: string, ip: string): Promise<{ likesCount: number }>
}
```

#### 2c. Share Routes (`api/src/routes/share.routes.ts`)

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/api/share/:videoSummaryId` | Yes | 20/hr | Generate share link |
| `GET` | `/api/share/:slug` | No | 100/min | Get public summary |
| `POST` | `/api/share/:slug/like` | No | 10/min/IP | Like a share |

#### 2d. Integration

- Register in `app.ts` with prefix `/api/share`
- Add `ShareService` + `ShareRepository` to `container.ts`
- Add `ShareNotFoundError`, `AlreadySharedError` to `errors.ts`
- Add `nanoid` dependency

**Acceptance Criteria:**
- Share slug is 10-char URL-safe nanoid
- Duplicate share returns existing slug (idempotent)
- View count increments on GET (deduplicated by session/24h window)
- Like is limited to 1 per IP per slug
- Public summary strips user-specific data
- Rate limits prevent abuse
- Tests: unit (service logic), integration (routes)

---

### Phase 3: SSR for /s/:slug (Days 4-5) [Effort: M]

Server-side rendered share page with Open Graph tags for social media previews.

#### 3a. HTML Template (`api/src/templates/share-page.ts`)

```typescript
function renderSharePage(summary: PublicVideoSummary): string
// Returns full HTML page with:
// - OG meta tags (og:title, og:description, og:image, og:url)
// - Twitter Card tags
// - JSON-LD structured data (VideoObject)
// - Hydration script pointing to frontend app
// - Fallback static content for crawlers
```

#### 3b. OG Image Service (`api/src/services/og-image.service.ts`)

```typescript
class OgImageService {
  // Generate OG image from template (satori or canvas-based)
  generateOgImage(summary: PublicVideoSummary): Promise<Buffer>
  // Cache generated images
  getCachedOrGenerate(slug: string): Promise<Buffer>
}
```

#### 3c. SSR Routes (`api/src/routes/ssr.routes.ts`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/s/:slug` | No | HTML page with OG tags |
| `GET` | `/s/:slug/og-image.png` | No | Generated OG image |

#### 3d. Integration

- Register in `app.ts` (NOT under `/api` prefix — top-level routes)
- Content-Type: `text/html` for page, `image/png` for OG image
- Cache OG images aggressively (they rarely change)

**Acceptance Criteria:**
- Social media crawlers see correct OG tags
- Page loads with meaningful content even without JS
- JSON-LD validates with Google Structured Data Testing Tool
- OG image includes: video title, channel, thumbnail, category badge
- Page redirects to frontend app for interactive use
- Tests: template rendering, OG tag validation

---

### Phase 4: Detection Override Route (Day 5) [Effort: S]

Allow users to manually correct the auto-detected category for their video.

#### 4a. Override Routes (`api/src/routes/override.routes.ts`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `PATCH` | `/api/videos/:id/override-category` | Yes | Change detected category |

Request body:
```json
{
  "category": "cooking",
  "outputType": "recipe"
}
```

#### 4b. Service Changes

- `video.service.ts`: Add `overrideCategory(userId, videoId, category, outputType)` method
  - Validates user owns video
  - Updates videoSummaryCache context.category
  - Triggers re-summarization with new category/outputType via summarizer
- `summarizer-client.ts`: Add `triggerResummarize(videoSummaryId, overrides)` method

**Acceptance Criteria:**
- Only video owner can override
- Category must be from valid VideoCategory enum
- OutputType must match category mapping (Plan 0.5)
- Re-summarization uses new category for persona selection
- Original category preserved in `context.originalCategory` for audit
- Tests: auth check, validation, service logic

---

### Phase 5: Payment Routes + Service (Days 6-7) [Effort: L]

Paddle payment integration for tier upgrades.

#### 5a. Payment Service (`api/src/services/payment.service.ts`)

```typescript
class PaymentService {
  constructor(
    private userRepository: UserRepository,
    private config: Config
  )

  // Verify Paddle webhook signature
  verifyWebhook(body: string, signature: string): boolean
  // Handle subscription events (created, updated, cancelled)
  handleWebhookEvent(event: PaddleEvent): Promise<void>
  // Generate checkout URL for user
  generateCheckoutUrl(userId: string, tier: UserTier): Promise<string>
  // Get user tier + limits
  getUserTier(userId: string): Promise<{ tier: UserTier; limits: TierLimits }>
}
```

#### 5b. Payment Routes (`api/src/routes/payment.routes.ts`)

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| `POST` | `/api/payments/webhook` | Paddle sig | N/A | Webhook handler |
| `GET` | `/api/payments/checkout` | Yes | 10/hr | Generate checkout URL |
| `GET` | `/api/tier` | Yes | 60/min | Current tier + limits |

**Webhook events to handle:**
- `subscription.created` -> Set user tier to 'pro'
- `subscription.updated` -> Update tier based on plan
- `subscription.cancelled` -> Schedule downgrade to 'free'
- `subscription.past_due` -> Grace period warning

#### 5c. Config Changes

Add to `config.ts`:
```
PADDLE_VENDOR_ID, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET,
PADDLE_PRO_PRICE_ID, PADDLE_TEAM_PRICE_ID
```

#### 5d. Integration

- Register in `app.ts` with prefix `/api/payments` (webhook) and `/api` (tier)
- Add `PaymentService` to `container.ts`
- Webhook route: raw body parsing (not JSON), signature verification
- Add `PaymentError`, `InvalidWebhookError` to `errors.ts`

**Acceptance Criteria:**
- Webhook signature verified before processing
- Subscription lifecycle handled (create, update, cancel, past_due)
- Checkout URL includes user email for pre-fill
- Tier endpoint returns current limits
- Idempotent webhook processing (handle duplicate events)
- Tests: webhook verification, event handling, tier calculation

---

### Phase 6: Tier Middleware (Days 7-8) [Effort: M]

Enforce tier-based limits across the API.

#### 6a. Tier Plugin (`api/src/plugins/tier.ts`)

```typescript
// Fastify decorator that adds tier info to request
declare module 'fastify' {
  interface FastifyRequest {
    tier: { name: UserTier; limits: TierLimits }
  }
}

function tierPlugin(fastify: FastifyInstance): void
// - Reads user tier from DB (or cache)
// - Decorates request with tier + limits
// - Lightweight (single DB read, cacheable)
```

#### 6b. Rate Limit Changes (`api/src/plugins/rate-limit.ts`)

| Tier | Videos/Day | Chat/Output | Share | Export |
|------|-----------|-------------|-------|--------|
| free | 3 | 5 | No | No |
| pro | unlimited | unlimited | Yes | Yes |
| team | unlimited | unlimited | Yes | Yes |

Modify rate-limit plugin to use `req.tier.limits` for dynamic limits.

#### 6c. Route Changes (`api/src/routes/videos.routes.ts`)

- Add tier preHandler to `POST /api/videos`
- Check `req.tier.limits.videosPerDay` against daily count
- Return `403 TIER_LIMIT_EXCEEDED` with upgrade prompt

**Acceptance Criteria:**
- Tier decorates all authenticated requests
- Free users blocked at 3 videos/day
- Pro users have no video limit
- Rate limit headers reflect tier-based limits
- Tier info cached per request (not per query)
- Add `TierLimitExceededError` to errors.ts
- Tests: tier decoration, limit enforcement, upgrade path

---

### Phase 7: Cost Circuit Breakers (Days 8-9) [Effort: M]

Prevent runaway LLM costs by monitoring daily spend.

#### 7a. Cost Monitor Service (`api/src/services/cost-monitor.service.ts`)

```typescript
class CostMonitorService {
  constructor(private db: Db, private config: Config)

  // Check if daily spend exceeds limit
  isDailyLimitExceeded(): Promise<boolean>
  // Get current daily spend from llm_usage collection
  getDailySpend(): Promise<{ total: number; limit: number; percentage: number }>
  // Get recommended model based on spend level
  getRecommendedModel(): Promise<'sonnet' | 'haiku' | 'flash'>
  // Record usage
  recordUsage(model: string, tokens: number, cost: number): Promise<void>
}
```

**Thresholds:**
- 0-70% daily limit: Use configured model (Sonnet)
- 70-90%: Auto-switch to Flash/Haiku
- 90-100%: Warning in logs, continue with cheap model
- 100%+: Block new summarizations, return 503

#### 7b. Summarizer Client Changes

- Before triggering summarization, check `costMonitor.isDailyLimitExceeded()`
- If at 70%+, include `preferredModel: 'flash'` in summarize request
- If at 100%+, reject with `CostLimitExceededError`

#### 7c. Config Changes

Add to `config.ts`:
```
COST_DAILY_LIMIT=50.00  # USD
```

**Acceptance Criteria:**
- Daily spend calculated from llm_usage collection (aggregation)
- Threshold transitions logged with alerts
- Auto-downgrade to cheaper model is transparent
- Hard limit prevents further LLM calls
- Cost data queryable for admin dashboard
- Tests: threshold logic, model selection, blocking behavior

---

### Phase 8: Stream Route Updates (Day 9) [Effort: S]

Forward new SSE events from the summarizer and persist metadata.

#### 8a. Stream Route Changes (`api/src/routes/stream.routes.ts`)

- Forward `detection_result` SSE event to frontend
- When `detection_result` arrives, persist `outputType` to videoSummaryCache
- Forward event data unchanged to SSE client

**Event payload:**
```json
{
  "event": "detection_result",
  "category": "cooking",
  "outputType": "recipe",
  "confidence": 0.92
}
```

**Acceptance Criteria:**
- New event type forwarded to frontend SSE stream
- outputType persisted to DB on receipt
- Existing event handling unaffected
- Tests: event forwarding, DB persistence

---

### Phase 9: Output Expiration (Day 10) [Effort: S]

Implement tier-based content expiration.

#### 9a. Expiration Logic

| Tier | TTL | Implementation |
|------|-----|----------------|
| anonymous | 7 days | `expiresAt = now + 7d` |
| free | 30 days | `expiresAt = now + 30d` |
| pro | never | `expiresAt = null` |

#### 9b. Video Service Changes

- On video creation (`POST /api/videos`), set `expiresAt` based on user tier
- On tier upgrade, clear `expiresAt` for all user's videos
- On tier downgrade, set `expiresAt = now + 30d` for all user's videos

#### 9c. MongoDB TTL

TTL index on `expiresAt` (already created in Phase 1) handles automatic deletion.

**Acceptance Criteria:**
- New videos get correct expiration based on tier
- Tier upgrade removes expiration from existing videos
- Tier downgrade adds 30-day expiration
- TTL index automatically deletes expired documents
- Shared summaries exempt from expiration (shareSlug != null)
- Tests: expiration calculation, tier transition handling

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Plan 0 types not ready | Medium | Blocks all work | Start with local type definitions, merge later |
| Paddle API changes | Low | Blocks payments | Use Paddle SDK, abstract behind service |
| OG image generation perf | Medium | Slow share page | Cache aggressively, generate async |
| Cost monitor accuracy | Medium | Over/under-spend | Conservative thresholds, manual override |
| TTL index deleting shared content | High | Data loss | Exempt shared docs (shareSlug != null) from expiration |
| Rate limit bypass via tier change | Low | Abuse | Rate limit check reads fresh tier, not cached |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| All new routes have integration tests | 100% |
| New service code has unit tests | >80% coverage |
| Share page OG tags pass social media validators | Pass |
| Webhook processing is idempotent | Verified |
| Cost circuit breaker triggers at threshold | Verified |
| TTL cleanup doesn't affect shared content | Verified |
| No regressions in existing tests | All pass |

---

## Dependencies

### External Dependencies (New)

| Package | Purpose | Version |
|---------|---------|---------|
| `nanoid` | Share slug generation | ^5.x |
| `@paddle/paddle-node-sdk` | Payment processing | Latest |
| `satori` or `@vercel/og` | OG image generation | Latest |

### Internal Dependencies

| Dependency | Status | Blocks |
|-----------|--------|--------|
| Plan 0 shared types | Not started | Phase 1-9 (can start with local types) |
| Plan 0 backfill script | Not started | Phase 1 |
| `@vie/types` OutputType, UserTier | Not merged | Phase 2, 4, 5 |
| `llm_usage` collection | Exists (via admin) | Phase 7 |

---

## Timeline Estimates

| Phase | Days | Effort | Dependencies |
|-------|------|--------|-------------|
| Phase 1: DB Schema | 1-2 | M | Plan 0 |
| Phase 2: Share Routes | 2-4 | L | Phase 1 |
| Phase 3: SSR | 4-5 | M | Phase 2 |
| Phase 4: Detection Override | 5 | S | Phase 1 |
| Phase 5: Payment Routes | 6-7 | L | Phase 1 |
| Phase 6: Tier Middleware | 7-8 | M | Phase 5 |
| Phase 7: Cost Breakers | 8-9 | M | Phase 1 |
| Phase 8: Stream Updates | 9 | S | Phase 1 |
| Phase 9: Expiration | 10 | S | Phase 6 |

**Critical Path:** Phase 1 -> Phase 2 -> Phase 3 (sharing flow)
**Parallel Work:** Phases 4, 5, 7, 8 can run in parallel after Phase 1
