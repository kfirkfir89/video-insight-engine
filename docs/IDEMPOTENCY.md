# Pipeline Idempotency Keys

Request-level dedup for `POST /api/videos`. Same inputs within the TTL window return the cached `videoSummaryId` instead of running a fresh pipeline.

## Why

Three failure modes that cost the user real money:

1. **Double-click** — user clicks Generate twice; two pipelines start.
2. **Browser retry** — network blip auto-resends; user is charged twice.
3. **Refresh-while-submitting** — user reloads before redirect; new submit fires.

Idempotency keys make these silent successes — the second submission attaches to the first.

## How it works

```
POST /api/videos
  ↓ Auth + Tier
  ↓ Validate Idempotency-Key header (optional, ≤255 printable ASCII) — HTTP 400 if malformed
  ↓ Extract youtubeId
  ↓ Compute hash = SHA-256(userId : youtubeId : PIPELINE_VERSION : providers [: client : headerValue])
  ↓ reserveHash (atomic insert of a `pending` placeholder on unique-hash index)
  ↓
  ├─ created=true (we won the race):
  │    reserveUserCost → videoService.createVideo → completeHash
  │    Return result with { cached: bool } (HTTP 201)
  │
  └─ created=false (someone got there first):
       ├─ existing.status === 'completed' + userVideo still exists
       │    → return it with { duplicate: true, cached: true }  (HTTP 200)
       │
       ├─ existing.status === 'completed' + userVideo deleted
       │    → invalidateStaleCompleted(hash, observed videoSummaryId)
       │    → retry reserveHash:
       │        ├─ created=true → fall through to normal creation flow
       │        └─ created=false → HTTP 409 IDEMPOTENCY_IN_FLIGHT (lost the retry race)
       │
       └─ existing.status === 'pending' (original still processing)
            → HTTP 409 IDEMPOTENCY_IN_FLIGHT
```

The stale-hit cleanup uses `invalidateStaleCompleted(hash, videoSummaryId)` rather than a plain `deleteOne({ hash })` so a concurrent fresh reservation cannot be accidentally deleted: the delete is scoped to the exact `(hash, status: 'completed', videoSummaryId)` triple we observed.

On `status: 'failed'` from the summarizer, `idempotencyService.invalidateByVideoSummaryId(videoSummaryId)` drops the key so the user can retry immediately rather than wait out the TTL. `completeHash` is also status-scoped (`{ hash, status: 'pending' }`) so a late completion cannot stomp a row that was already cleaned up and re-reserved.

## Hash inputs

The hash is the SHA-256 of `userId:youtubeId:PIPELINE_VERSION:providersHash`.

- **`userId`** — namespaces per user so cross-user collisions are impossible.
- **`youtubeId`** — the canonical 11-char ID (URL params stripped upstream).
- **`PIPELINE_VERSION`** — env var. **Bump this on every meaningful pipeline change** — all stale keys auto-miss.
- **`providersHash`** — stable JSON of the provider override (`default`/`fast`/`fallback`). Empty when not supplied. Two different provider configs produce two different hashes.

When a client supplies an `Idempotency-Key` header (Stripe convention), the header value is **mixed INTO** the payload (it does not replace it). The hash becomes `SHA-256(userId:youtubeId:PIPELINE_VERSION:providersHash:client:headerValue)`. This is stricter than Stripe's "same key + different params is an error" semantic — different params with the same header simply produce a different hash, so the work runs fresh. We trade the ability to dedup arbitrary payloads for the guarantee that reusing a key by mistake never returns the wrong video.

The header is validated to 1-255 printable ASCII characters (`/^[\x21-\x7E]{1,255}$/`); other values return HTTP 400 `INVALID_IDEMPOTENCY_KEY`.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `PIPELINE_VERSION` | `v1` | Canonical version string baked into every hash. Bump on prompt/schema/pipeline changes. |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` (24h) | Per-key TTL. Long enough for accidental double-submits; short enough that "I want to retry tomorrow" works. |

## When to bump `PIPELINE_VERSION`

Bump on **any** change that would change pipeline OUTPUT for the same input. Examples:

- Prompt rewrites (extraction, synthesis, enrichment, plan)
- Domain schema changes (new fields, renamed fields, type changes)
- Model version changes (e.g. switching from Sonnet 4.5 → 4.6 by default)
- Assembly rule changes that affect tab shape
- Cross-tab link rule additions

Do **NOT** bump for:

- Logging changes, observability, instrumentation
- Performance optimizations that don't change output
- Bug fixes that don't change the happy-path output
- Frontend-only changes

**Rule of thumb**: if a user re-running the same video would get a different result, bump.

### Procedure

1. Pick a new version string. Convention: `v{N}` (e.g. `v1` → `v2`). Date-suffixed (`v2-2026-05-19`) is also fine for traceability.
2. Set `PIPELINE_VERSION` in `.env` (dev) and the production environment.
3. Restart the API. The new version takes effect on the next request — no migration, no key cleanup needed (TTL handles it).
4. Old keys remain in `idempotencyKeys` until their TTL expires; they just no longer match new submissions.

## Bypass for power users

`POST /api/videos?bypassCache=true` skips the idempotency gate entirely. Use when a user explicitly wants a fresh run (admin tool, paid feature). The route's existing `bypassCache` flag handles this.

## Collection schema

`idempotencyKeys` collection, indexes:

| Index | Purpose |
|-------|---------|
| `{ hash: 1 } unique` | Hash lookup + race-safe insertion. |
| `{ expiresAt: 1 } expireAfterSeconds: 0` | TTL eviction (~60s precision). |
| `{ videoSummaryId: 1 } sparse` | Failure cascade — drop all keys for a failed summary. Sparse because pending placeholders carry no videoSummaryId. |
| `{ userId: 1, createdAt: -1 }` | Audit/debug; not on the hot path. |

## Cost protection

The gate runs **before** `costMonitorService.reserveUserCost()`. A duplicate hit:

- Does NOT reserve cost (`reserveUserCost` not called).
- Does NOT enqueue a job (`queuePublisher.publishVideoJob` not called).
- Does NOT trigger HTTP summarization (`summarizerClient.triggerSummarization` not called).
- Returns instantly from a single Mongo read.

This is enforced by integration tests in `api/src/routes/videos.routes.test.ts`.

## DoS bound

An authenticated client can produce unique hashes by varying the `Idempotency-Key` header while keeping the YouTube URL constant. Each unique hash inserts one row in `idempotencyKeys` that lives until TTL (24h default). The blast radius is bounded by:

- The `VIDEO_DAILY_LIMIT` daily quota counted by `@fastify/rate-limit` — the per-user POST budget.
- The TTL index — old rows are reaped lazily (~60s precision) after `expiresAt`.
- Per-user authentication — every insert is tied to a real account.

If you need a tighter cap, add a `count({ userId, status: 'pending' })` guard in the route before `reserveHash`. The current design treats the per-user daily limit as the gating control.

## Frontend behaviour

On `result.duplicate === true`, the frontend shows a subtle sonner toast — *"Already processed — opening existing result"* — and navigates to the existing VideoDetail page. The toast helper lives at `apps/web/src/features/video-output/lib/duplicate-toast.ts` and is invoked from `VideoIntakeForm`, `AddVideoInput`, and `BoardInlinePaste`.
