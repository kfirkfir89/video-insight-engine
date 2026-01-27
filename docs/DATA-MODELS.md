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

Dynamic content blocks that LLM returns for article-like summaries. Each block has a `type` and optional `variant` for specialized styling.

## Block Type Reference

| Type | Purpose | Fields |
|------|---------|--------|
| `paragraph` | Prose text, explanations, transitions | `text`, `variant?` |
| `bullets` | Unordered lists | `items[]`, `variant?` |
| `numbered` | Sequential steps, processes | `items[]`, `variant?` |
| `do_dont` | Best practices, comparisons | `do[]`, `dont[]` |
| `example` | Code snippets, demonstrations | `title?`, `code`, `explanation?`, `variant?` |
| `callout` | Tips, warnings, important notes | `style` (tip/warning/note), `text`, `variant?` |
| `definition` | Key term introductions | `term`, `meaning` |
| `keyvalue` | Specs, costs, stats, metadata | `items[]` (key/value pairs), `variant?` |
| `comparison` | Side-by-side comparisons | `left`, `right`, `variant?` |
| `timestamp` | Video navigation links | `time`, `seconds`, `label` |

## TypeScript Interfaces

```typescript
// ===== BASE BLOCKS (Original 7) =====

interface ParagraphBlock {
  type: 'paragraph';
  variant?: string;
  text: string;
}

interface BulletsBlock {
  type: 'bullets';
  variant?: 'ingredients' | string;  // Recipe: "ingredients"
  items: string[];
}

interface NumberedBlock {
  type: 'numbered';
  variant?: 'cooking_steps' | string;  // Recipe: "cooking_steps"
  items: string[];
}

interface DoDoNotBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

interface ExampleBlock {
  type: 'example';
  variant?: 'terminal_command' | string;  // Code: "terminal_command"
  title?: string;
  code: string;
  explanation?: string;
}

interface CalloutBlock {
  type: 'callout';
  variant?: 'chef_tip' | string;  // Recipe: "chef_tip"
  style: 'tip' | 'warning' | 'note';
  text: string;
}

interface DefinitionBlock {
  type: 'definition';
  term: string;
  meaning: string;
}

// ===== NEW BLOCKS (3 additions) =====

interface KeyValueBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

interface ComparisonBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

interface TimestampBlock {
  type: 'timestamp';
  time: string;       // "5:23"
  seconds: number;    // 323 (for video seeking)
  label: string;      // "Setting up the project"
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
  | TimestampBlock;
```

## Variant Examples by Persona

### Code Persona
```json
{"type": "example", "variant": "terminal_command", "code": "npm install", "explanation": "..."}
{"type": "comparison", "variant": "dos_donts", "left": {"label": "Do", "items": [...]}, "right": {"label": "Don't", "items": [...]}}
{"type": "timestamp", "time": "5:23", "seconds": 323, "label": "Setting up the config"}
```

### Recipe Persona
```json
{"type": "keyvalue", "variant": "info", "items": [{"key": "Prep Time", "value": "15 min"}, {"key": "Servings", "value": "4"}]}
{"type": "bullets", "variant": "ingredients", "items": ["2 cups flour", "1 tsp salt"]}
{"type": "numbered", "variant": "cooking_steps", "items": ["Preheat oven to 350°F", ...]}
{"type": "callout", "variant": "chef_tip", "style": "tip", "text": "Let dough rest 10 min"}
```

### Review Persona
```json
{"type": "keyvalue", "variant": "specs", "items": [{"key": "Battery", "value": "14hrs"}, {"key": "Weight", "value": "1.2kg"}]}
{"type": "comparison", "variant": "pros_cons", "left": {"label": "Pros", "items": [...]}, "right": {"label": "Cons", "items": [...]}}
```

---

# VideoContext

Metadata extracted from YouTube to enable content-aware summarization with specialized UI views.

```typescript
interface VideoContext {
  youtubeCategory: string;     // "Science & Technology" - for LLM context
  persona: 'code' | 'recipe' | 'standard' | 'tech' | 'educational';
  tags: string[];              // Raw tags from YouTube (max 15)
  displayTags: string[];       // Cleaned for UI display (max 6)
}
```

## Persona Detection

Persona is determined from YouTube metadata (NOT LLM), using category + keyword matching:

| Category | Keywords Matched | Persona |
|----------|-----------------|---------|
| Science & Technology | programming, coding, react, python... | `code` |
| Science & Technology | (no code keywords) | `tech` |
| Howto & Style | recipe, cooking, food, chef... | `recipe` |
| Education | (any) | `educational` |
| (other) | (any) | `standard` |

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

  // Video context (persona + tags)
  context: {
    youtubeCategory: string,
    persona: "code" | "recipe" | "standard" | "tech" | "educational",
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

    sections: [{
      id: string,                 // UUID
      timestamp: string,          // "03:45"
      startSeconds: number,
      endSeconds: number,
      title: string,
      content: ContentBlock[],    // Dynamic content blocks
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

One entry per section/concept expansion. Shared across all users.

```javascript
{
  _id: ObjectId,
  
  // Target reference
  videoSummaryId: ObjectId,
  targetType: "section" | "concept",
  targetId: string,               // UUID
  
  // Context (cached from source)
  context: {
    videoTitle: string,
    youtubeId: string,
    // For sections:
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
  sourceType: "video_section" | "video_concept" | "system_expansion",
  
  // Source reference
  source: {
    videoSummaryId: ObjectId,
    youtubeId: string,
    videoTitle: string,
    videoThumbnail: string,
    youtubeUrl: string,
    
    // For sections
    startSeconds?: number,
    endSeconds?: number,
    sectionIds?: string[],
    
    // For expansions
    expansionId?: ObjectId,
    
    // Cached content (independent)
    content: {
      sections?: [{ id, timestamp, title, summary, bullets }],
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
│   (one per video)              (one per section/concept)     │
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
