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
  
  // Processing state
  status: "pending" | "processing" | "completed" | "failed",
  errorMessage: string | null,
  errorCode: string | null,       // "NO_TRANSCRIPT", "VIDEO_TOO_LONG", etc.
  retryCount: number,             // Default: 0
  
  // Content
  transcript: string | null,
  transcriptType: "manual" | "auto-generated" | null,
  
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
      summary: string,
      bullets: string[]
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
