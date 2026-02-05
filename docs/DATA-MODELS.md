# Data Models

MongoDB collections and schemas.

---

## Overview

### System Cache (Shared)

| Collection | Purpose |
|------------|---------|
| `videoSummaryCache` | One summary per YouTube video |
| `systemExpansionCache` | One expansion per section/concept |

### User Data (Per-User)

| Collection | Purpose |
|------------|---------|
| `users` | Accounts |
| `folders` | Organization hierarchy |
| `userVideos` | User's video library |
| `memorizedItems` | User's knowledge collection |
| `userChats` | Conversations about memorized items |

---

# ContentBlock Types

Dynamic content blocks that LLM returns for article-like summaries. Each block has a `blockId` (UUID for stable referencing), a `type`, and optional `variant` for specialized styling.

## Block Type Reference

| Type | Purpose | Fields |
|------|---------|--------|
| `paragraph` | Prose text, explanations, transitions | `blockId`, `text`, `variant?` |
| `bullets` | Unordered lists | `blockId`, `items[]`, `variant?` |
| `numbered` | Sequential steps, processes | `blockId`, `items[]`, `variant?` |
| `do_dont` | Best practices, comparisons | `blockId`, `do[]`, `dont[]` |
| `example` | Code snippets, demonstrations | `blockId`, `title?`, `code`, `explanation?`, `variant?` |
| `callout` | Tips, warnings, important notes | `blockId`, `style` (tip/warning/note/chef_tip/security), `text`, `variant?` |
| `definition` | Key term introductions | `blockId`, `term`, `meaning` |
| `keyvalue` | Specs, costs, stats, metadata | `blockId`, `items[]` (key/value pairs), `variant?` |
| `comparison` | Side-by-side comparisons | `blockId`, `left`, `right`, `variant?` |
| `timestamp` | Video navigation links | `blockId`, `time`, `seconds`, `label` |
| `quote` | Speaker quotes, testimonials | `blockId`, `text`, `attribution?`, `timestamp?` |
| `statistic` | Metrics, data points | `blockId`, `items[]` (value/label/context/trend) |

## TypeScript Interfaces

```typescript
// ===== BASE BLOCK =====

interface BaseBlock {
  blockId: string;     // UUID - stable identifier for referencing
  type: string;
  variant?: string;
}

// ===== CONTENT BLOCKS =====

interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

interface BulletsBlock extends BaseBlock {
  type: 'bullets';
  variant?: 'ingredients' | string;  // Recipe: "ingredients"
  items: string[];
}

interface NumberedBlock extends BaseBlock {
  type: 'numbered';
  variant?: 'cooking_steps' | string;  // Recipe: "cooking_steps"
  items: string[];
}

interface DoDoNotBlock extends BaseBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

interface ExampleBlock extends BaseBlock {
  type: 'example';
  variant?: 'terminal_command' | string;  // Code: "terminal_command"
  title?: string;
  code: string;
  explanation?: string;
}

interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant?: 'chef_tip' | string;  // Recipe: "chef_tip"
  style: 'tip' | 'warning' | 'note' | 'chef_tip' | 'security';
  text: string;
}

interface DefinitionBlock extends BaseBlock {
  type: 'definition';
  term: string;
  meaning: string;
}

interface KeyValueBlock extends BaseBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

interface ComparisonBlock extends BaseBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

interface TimestampBlock extends BaseBlock {
  type: 'timestamp';
  time: string;       // "5:23"
  seconds: number;    // 323 (for video seeking)
  label: string;      // "Setting up the project"
}

interface QuoteBlock extends BaseBlock {
  type: 'quote';
  text: string;
  attribution?: string;
  timestamp?: number;
}

interface StatisticBlock extends BaseBlock {
  type: 'statistic';
  items: {
    value: string;
    label: string;
    context?: string;
    trend?: 'up' | 'down' | 'neutral';
  }[];
}

// ===== UNION TYPE =====

type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | DoDoNotBlock
  | ExampleBlock
  | CalloutBlock
  | DefinitionBlock
  | KeyValueBlock
  | ComparisonBlock
  | TimestampBlock
  | QuoteBlock
  | StatisticBlock;
```

## Variant Examples by Category

### Coding Category
```json
{"blockId": "uuid-1", "type": "example", "variant": "terminal_command", "code": "npm install", "explanation": "..."}
{"blockId": "uuid-2", "type": "comparison", "variant": "dos_donts", "left": {"label": "Do", "items": [...]}, "right": {"label": "Don't", "items": [...]}}
{"blockId": "uuid-3", "type": "timestamp", "time": "5:23", "seconds": 323, "label": "Setting up the config"}
```

### Cooking Category
```json
{"blockId": "uuid-1", "type": "keyvalue", "variant": "info", "items": [{"key": "Prep Time", "value": "15 min"}, {"key": "Servings", "value": "4"}]}
{"blockId": "uuid-2", "type": "bullets", "variant": "ingredients", "items": ["2 cups flour", "1 tsp salt"]}
{"blockId": "uuid-3", "type": "numbered", "variant": "cooking_steps", "items": ["Preheat oven to 350°F", ...]}
{"blockId": "uuid-4", "type": "callout", "variant": "chef_tip", "style": "chef_tip", "text": "Let dough rest 10 min"}
```

### Reviews Category
```json
{"blockId": "uuid-1", "type": "keyvalue", "variant": "specs", "items": [{"key": "Battery", "value": "14hrs"}, {"key": "Weight", "value": "1.2kg"}]}
{"blockId": "uuid-2", "type": "comparison", "variant": "pros_cons", "left": {"label": "Pros", "items": [...]}, "right": {"label": "Cons", "items": [...]}}
```

---

# VideoContext

Metadata extracted from YouTube to enable content-aware summarization with specialized UI views.

```typescript
interface VideoContext {
  category: string;            // Detected: "coding", "cooking", "travel", "fitness", etc.
  youtubeCategory: string;     // Raw YouTube category: "Science & Technology", "Entertainment"
  tags: string[];              // Raw tags from YouTube (max 15)
  displayTags: string[];       // Cleaned for UI display (max 6)
  categoryConfidence?: number; // Detection confidence (0.0-1.0), used internally
}
```

## Category Detection

Category is detected independently using **weighted scoring** (not derived from persona):

| Signal | Weight | Description |
|--------|--------|-------------|
| Keywords (tags + hashtags) | 40% | Primary content indicator |
| YouTube category | 30% | Supportive, but unreliable alone |
| Title patterns | 15% | Pattern matching ("recipe", "tutorial", etc.) |
| Channel patterns | 15% | Known channels (jamie oliver, fireship, etc.) |

**LLM Fallback:** If confidence < 0.4, uses fast model (Haiku) for classification.

### Valid Categories

`cooking`, `coding`, `fitness`, `travel`, `education`, `podcast`, `reviews`, `gaming`, `diy`, `standard`

### Category to Persona Mapping

Persona is derived FROM category for LLM prompt selection:

| Category | Persona | Purpose |
|----------|---------|---------|
| `cooking` | `recipe` | Recipe-specific prompts |
| `coding` | `code` | Code tutorial prompts |
| `reviews` | `review` | Product review prompts |
| `podcast` | `interview` | Interview/podcast prompts |
| `fitness` | `fitness` | Workout prompts |
| `travel` | `travel` | Travel guide prompts |
| `education` | `education` | Educational prompts |
| other | `standard` | Generic prompts |

**Key Principle:** Category detection is independent of persona. A video can have category="cooking" even if persona falls back to "standard".

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

  // Video context (category + tags)
  context: {
    category: "coding" | "cooking" | "podcast" | "reviews" | "general",
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

  // Processed summary
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
      timestamp: string | null
    }]
  } | null,

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

  // Transcript storage (S3)
  rawTranscriptRef: string | null,  // S3 key: "transcripts/{youtubeId}.json"

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
  
  // Activity tracking
  lastLoginAt: Date | null,
  
  // Preferences
  preferences: {
    defaultSummarizedFolder: ObjectId | null,
    defaultMemorizedFolder: ObjectId | null,
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
```

---

## folders

Materialized path pattern for hierarchy.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  name: string,
  type: "summarized" | "memorized",   // Which tab
  
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
{ userId: 1, type: 1, path: 1 }
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

## memorizedItems

User's personal knowledge collection.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  title: string,
  folderId: ObjectId | null,
  
  // What was memorized
  sourceType: "video_chapter" | "video_concept" | "system_expansion",

  // Source reference
  source: {
    videoSummaryId: ObjectId,
    youtubeId: string,
    videoTitle: string,
    videoThumbnail: string,
    youtubeUrl: string,

    // For chapters
    startSeconds?: number,
    endSeconds?: number,
    chapterIds?: string[],
    blockIds?: string[],        // Specific content blocks referenced

    // For expansions
    expansionId?: ObjectId,

    // Cached content (independent)
    content: {
      chapters?: [{ id, timestamp, title, content, summary, bullets }],
      concept?: { name, definition },
      expansion?: string
    }
  },
  
  // User additions
  notes: string | null,
  tags: string[],
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, folderId: 1 }
{ userId: 1, "source.videoSummaryId": 1 }
{ userId: 1, tags: 1 }
{ userId: 1, createdAt: -1 }
```

---

## userChats

Conversations about memorized items.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  memorizedItemId: ObjectId,
  
  messages: [{
    role: "user" | "assistant",
    content: string,
    createdAt: Date
  }],
  
  title: string | null,
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
{ userId: 1, memorizedItemId: 1 }
{ userId: 1, updatedAt: -1 }
```

---

# Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                      SYSTEM CACHE                             │
│                                                               │
│   videoSummaryCache ──────────▶ systemExpansionCache         │
│   (one per video)              (one per chapter/concept)     │
└──────────────────────────────────────────────────────────────┘
              │                            │
              │ references                 │ references
              ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       USER DATA                               │
│                                                               │
│   userVideos ──────────────▶ memorizedItems ◀── userChats    │
│   (library)                  (collection)       (per-item)   │
│       │                           │                          │
│       └───────────────────────────┘                          │
│                    │                                         │
│                    ▼                                         │
│                folders                                       │
│          (organization)                                      │
└──────────────────────────────────────────────────────────────┘
```

---

# Data Integrity

## Delete Behaviors

| Action | Result |
|--------|--------|
| User removes video from library | userVideos deleted. Cache stays. Memorized items stay. |
| User deletes memorized item | Item deleted. Cache unaffected. |
| User deletes folder | Move contents to "Unfiled" or delete with contents |
| User account deleted | Delete all user data. Caches stay (shared). |

## Why Independence?

Memorized items copy content at creation time. They work without the source:
- User can clean up video library freely
- Memorized items are the "extracted value"
- Source reference is just for "where did I learn this?" context
