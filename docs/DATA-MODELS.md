# Data Models

MongoDB collections and schemas.

---

## Overview

### System Cache (Shared)

| Collection | Purpose |
|------------|---------|
| `videoSummaryCache` | One summary per YouTube video (MongoDB + Redis cache layer) |
| `systemExpansionCache` | One expansion per section/concept |

### User Data (Per-User)

| Collection | Purpose |
|------------|---------|
| `users` | Accounts |
| `folders` | Organization hierarchy |
| `userVideos` | User's video library |

---

## Legacy: ContentBlock Types (Removed)

The block-based content system was replaced by the composable output system (v2) with component-addressed tabs. See the `assembledTabs` field in videoSummaryCache for the current data shape.

---

# Content Tag System (v2)

The triage pipeline determines content tags from video metadata and transcript manifest. Tags drive schema selection, tab layout, and enrichment.

### 10 Primary Content Tags + 2 Modifiers

| ContentTag | Domain Schema | Enrichment |
|------------|---------------|------------|
| `learning` | `schemas/learning.txt` | quiz, flashcards, scenarios |
| `tech` | `schemas/tech.txt` | quiz, flashcards, scenarios |
| `fitness` | `schemas/fitness.txt` | - |
| `food` | `schemas/food.txt` | - |
| `music` | `schemas/music.txt` | - |
| `travel` | `schemas/travel.txt` | - |
| `review` | `schemas/review.txt` | - |
| `project` | `schemas/project.txt` | - |
| `language` | `schemas/language.txt` | - |
| `science` | `schemas/science.txt` | - |
| `narrative` | `schemas/narrative.txt` | Modifier only |
| `finance` | `schemas/finance.txt` | Modifier only |

### Legacy: VideoContext

Still present in older documents for backward compatibility:

```typescript
interface VideoContext {
  category: string;            // Detected category (used as triage fallback)
  youtubeCategory: string;     // Raw YouTube category
  tags: string[];              // Raw tags from YouTube
  displayTags: string[];       // Cleaned for UI display
  categoryConfidence?: number; // Detection confidence
}
```

Category serves as a fallback when triage confidence < 0.6. The triage LLM now determines content tags directly from manifest + metadata.

---

# System Cache Collections

## videoSummaryCache

One entry per YouTube video. Shared across all users.

```javascript
{
  _id: ObjectId,

  // YouTube identification
  youtubeId: string,              // "dQw4w9WgXcQ" - UNIQUE
  url: string,

  // Metadata
  title: string,
  channel: string | null,
  duration: number | null,        // seconds
  thumbnailUrl: string | null,
  language: string | null,        // ISO 639-1 ("en", "es", etc.)

  // Video context (classification + tags)
  // Note: Now includes contentTags/primaryTag from plan stage.
  // The legacy `category` field is kept for backward compat but
  // contentTags is the authoritative classification source.
  context: {
    category: string,                // Legacy category (fallback only)
    contentTags: string[],           // From plan stage: ["learning", "tech"]
    primaryTag: string,              // First content tag
    youtubeCategory: string,
    tags: string[],
    displayTags: string[]
  } | null,

  // Processing state
  status: "pending" | "processing" | "completed" | "failed",
  errorMessage: string | null,
  errorCode: string | null,       // "NO_TRANSCRIPT", "VIDEO_TOO_LONG", etc.
  retryCount: number,             // Default: 0

  // Content
  transcript: string | null,
  transcriptType: "manual" | "auto-generated" | null,

  // Transcript system fields
  transcriptSource: "ytdlp" | "api" | "proxy" | "whisper" | null,
  transcriptSegments: [{
    text: string,
    startMs: number,           // Milliseconds
    endMs: number
  }] | null,

  // Processed summary (legacy v1 format — kept for backward compat,
  // new pipeline populates assembledMeta/assembledTabs instead)
  summary: {
    tldr: string,
    keyTakeaways: string[],

    chapters: [{
      id: string,                 // UUID
      timestamp: string,          // "03:45"
      startSeconds: number,
      endSeconds: number,
      title: string,
      originalTitle: string,      // Creator's original chapter title (if any)
      generatedTitle?: string,    // AI-generated title (if different)
      isCreatorChapter: boolean,  // True if from YouTube chapters
      content: ContentBlock[],    // Dynamic content blocks with blockId
      transcript: string | null,  // Sliced transcript text for this chapter
      summary: string,            // Legacy: kept for backward compat
      bullets: string[]           // Legacy: kept for backward compat
    }],

    concepts: [{
      id: string,                 // UUID
      name: string,
      definition: string | null,
      timestamp: string | null,
      chapterIndex: number | null, // Per-chapter assignment
      aliases: string[]            // LLM-provided short forms for matching
    }]
  } | null,

  // ─── Pipeline v2 fields (triage-based) ───

  // Triage result
  triage: {
    contentTags: string[],          // ["learning", "tech"]
    modifiers: string[],            // ["narrative", "finance"]
    primaryTag: string,             // First content tag
    tabs: [{                        // LLM-designed tab layout
      id: string,
      label: string,
      emoji: string,
      dataSource: string            // e.g., "learning.keyPoints"
    }],
    confidence: number
  } | null,

  // Domain-keyed extraction data
  output: Record<string, unknown> | null,

  // Enrichment (quiz, flashcards, scenarios)
  enrichment: Record<string, unknown> | null,

  // Synthesis (TLDR, takeaways, master summary)
  synthesis: {
    tldr: string,
    keyTakeaways: string[],
    masterSummary: string,
    seoDescription: string
  } | null,

  // Multi-language support (non-English videos only)
  language: string | null,              // ISO 639-1 code ("en", "he", "ar", etc.)
  isRTL: boolean | null,               // Whether language is right-to-left
  synthesis_en: {                       // English translation of synthesis (non-English only)
    tldr: string,
    keyTakeaways: string[],
    masterSummary: string
  } | null,
  tabs_en: TabEntry[] | null,           // English-translated tabs (non-English only)

  // v2 Assembly output (component-addressed tabs)
  assembledMeta: {
    videoId: string,
    videoTitle: string,
    creator: string,
    contentTags: string[],
    modifiers: string[],
    primaryTag: string,
    userGoal: string,
    tldr: string,
    keyTakeaways: string[],
    masterSummary: string,
    seoDescription: string,
    language: string,           // ISO 639-1 code
    isRTL: boolean              // Whether language is RTL
  } | null,

  assembledTabs: [{
    id: string,                     // e.g., "key_points"
    label: string,                  // e.g., "Key Points"
    emoji: string,                  // e.g., "💡"
    component: string,              // Maps to COMPONENT_REGISTRY on frontend
    props: Record<string, unknown>, // Pre-resolved props for the component
    crossTabLinks?: [{              // Cross-tab navigation links
      targetTab: string,
      label: string
    }]
  }] | null,

  // Share metadata (v1.4)
  shareSlug: string | null,         // nanoid 10-char URL-safe slug (unique when set)
  sharedAt: Date | null,            // When shared
  viewsCount: number,               // Default: 0
  likesCount: number,               // Default: 0
  likedIps: string[],               // Hashed IPs for dedup

  // Expiration (v1.4) — TTL index fires on non-null Date
  expiresAt: Date | null,           // null = never expires (pro/team), Date = will be removed

  // Cache metadata
  version: number,
  processedAt: Date | null,
  processingTimeMs: number | null,  // How long it took

  // Cost tracking
  tokenUsage: {
    input: number,
    output: number,
    cost: number                    // USD
  } | null,
  totalTokens: number,              // Sum of input + output tokens (v1.4)

  // S3 media storage
  rawTranscriptRef: string | null,  // S3 key: "videos/{youtubeId}/transcript.json"

  // Generation metadata (for regeneration)
  generation: {
    model: string,                  // LLM model used
    promptVersion: string,          // Prompt version (e.g., "v1.0")
    generatedAt: string             // ISO 8601 timestamp
  } | null,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ youtubeId: 1 }    // unique
{ status: 1 }
{ outputType: 1 }                   // v1.4 — filter by output type
{ shareSlug: 1 }                    // v1.4 — unique sparse (only indexed when non-null)
{ expiresAt: 1 }                    // v1.4 — TTL index (expireAfterSeconds: 0)
```

---

## systemExpansionCache

One entry per chapter/concept expansion. Shared across all users.

```javascript
{
  _id: ObjectId,

  // Target reference
  videoSummaryId: ObjectId,
  targetType: "chapter" | "concept",
  targetId: string,               // UUID (or blockId for content blocks)

  // Context (cached from source)
  context: {
    videoTitle: string,
    youtubeId: string,
    // For chapters:
    timestamp?: string,
    title?: string,
    summary?: string,
    bullets?: string[],
    // For concepts:
    name?: string,
    definition?: string
  },
  
  // Generated content
  content: string,                // Markdown
  
  // Metadata
  status: "pending" | "processing" | "completed" | "failed",
  version: number,
  model: string,
  generatedAt: Date | null,
  createdAt: Date
}
```

**Indexes:**
```javascript
{ videoSummaryId: 1, targetType: 1, targetId: 1 }  // unique
{ status: 1 }
```

---

# User Data Collections

## users

```javascript
{
  _id: ObjectId,
  
  email: string,                  // unique
  passwordHash: string,           // bcrypt
  name: string,

  // Tier (v1.4) — free, pro, team
  tier: "free" | "pro" | "team",  // Default: "free"

  // Activity tracking
  lastLoginAt: Date | null,

  // Preferences
  preferences: {
    defaultFolder: ObjectId | null,
    theme: "light" | "dark" | "system"
  },

  // Usage limits (for rate limiting)
  usage: {
    videosThisMonth: number,
    videosResetAt: Date           // First of month
  },

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ email: 1 }  // unique
{ tier: 1 }   // v1.4 — filter/aggregate by tier
```

---

## folders

Materialized path pattern for hierarchy.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  name: string,

  // Hierarchy
  parentId: ObjectId | null,          // null = root
  path: string,                       // "/AI Learning/LLMs"
  level: number,                      // 1 = root
  
  // Display
  color: string | null,
  icon: string | null,
  order: number,
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, path: 1 }
{ userId: 1, parentId: 1 }
```

---

## userVideos

User's video library. References shared cache.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  // Reference to cache
  videoSummaryId: ObjectId,
  
  // Denormalized for display (copied from cache)
  youtubeId: string,
  title: string,
  channel: string | null,
  duration: number | null,
  thumbnailUrl: string | null,
  status: string,                 // Synced from cache
  
  // User-specific
  folderId: ObjectId | null,
  notes: string | null,
  isFavorite: boolean,            // Quick access

  // Playlist context (optional - set when imported via playlist)
  playlistInfo: {
    playlistId: string,           // YouTube playlist ID
    playlistTitle: string,        // Playlist title at import time
    position: number,             // 0-indexed position in playlist
    totalVideos: number           // Total videos at import time
  } | null,

  // Timestamps
  addedAt: Date,                  // When user added this video
  lastViewedAt: Date | null,      // Last time user opened it
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, videoSummaryId: 1 }  // unique per user
{ userId: 1, folderId: 1 }
{ userId: 1, createdAt: -1 }
```

---

## userCosts

Per-user daily LLM cost aggregate. Powers the per-user reservation gate
(`POST /videos`) and the in-app usage tile.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  date: string,                   // UTC `YYYY-MM-DD`
  totalCostUsd: number,           // Sum of per-call LLM cost, denormalized from llm_usage
  videoCount: number,             // Owned by reservation path: +1 on reserve, -1 on refund
  creditAdjustmentUsd: number,    // Admin adjustments. Negative = credit, positive = manual charge
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, date: 1 }  // unique — enables atomic upsert under contention
{ date: 1 }             // supports admin aggregates over a trailing window
```

**Reconciliation:** `totalCostUsd` is rewritten from `llm_usage` (Python
schema: `user_id` + `cost_usd` + `timestamp`) on every terminal video status
and by the nightly `POST /internal/reconcile-costs` cron. `videoCount` is
preserved across reconciles because it tracks reservations, not real spend.

---

## userCostAdjustments

Audit log for admin grant-credit and manual-charge actions.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  date: string,                   // UTC `YYYY-MM-DD` — adjustments are day-scoped
  amountUsd: number,              // Signed. Negative = credit (lowers spend), positive = manual charge
  reason: string,                 // 1–500 chars
  adminId: ObjectId,              // Self-attested from request body (admin service is shared-key auth)
  createdAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, createdAt: -1 }
{ adminId: 1, createdAt: -1 }
```

**Signed-storage convention:** the canonical contract across Node + Python is
`amountUsd < 0 → credit`. The admin HTTP boundary accepts a user-friendly
"positive = grant" input and inverts the sign before storage — see
`services/admin/src/routes/users.py:230-291`.

---

# Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                      SYSTEM CACHE                             │
│                                                               │
│   videoSummaryCache ──────────▶ systemExpansionCache         │
│   (one per video)              (one per chapter/concept)     │
└──────────────────────────────────────────────────────────────┘
              │
              │ references
              ▼
┌──────────────────────────────────────────────────────────────┐
│                       USER DATA                               │
│                                                               │
│   userVideos ─────────────────────────────────────────────   │
│   (library)                                                  │
│       │                                                      │
│       ▼                                                      │
│   folders                                                    │
│   (organization)                                             │
└──────────────────────────────────────────────────────────────┘
```

---

# Data Integrity

## Delete Behaviors

| Action | Result |
|--------|--------|
| User removes video from library | userVideos deleted. Cache stays. |
| User deletes folder | Move contents to "Unfiled" or delete with contents |
| User account deleted | Delete all user data. Caches stay (shared). |
