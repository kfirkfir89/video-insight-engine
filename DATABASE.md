# Video Insight Engine - Database Schema

Complete database documentation for the Video Insight Engine project.

---

## Overview

| Property | Value |
|----------|-------|
| **Database** | MongoDB 7 |
| **Collections** | 7 total |
| **Architecture** | System cache (shared) + User data (per-user) |

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM CACHE (Shared by All Users)                        │
│                                                                                  │
│  ┌──────────────────────────┐         ┌──────────────────────────┐             │
│  │   videoSummaryCache      │         │  systemExpansionCache    │             │
│  │   ════════════════════   │         │  ═══════════════════════ │             │
│  │   _id: ObjectId (PK)     │────────>│  _id: ObjectId (PK)      │             │
│  │   youtubeId: string (UK) │         │  videoSummaryId: ObjectId│             │
│  │   url: string            │         │  targetType: enum        │             │
│  │   title: string          │         │  targetId: string        │             │
│  │   channel: string?       │         │  context: object         │             │
│  │   duration: number?      │         │  content: string         │             │
│  │   thumbnailUrl: string?  │         │  status: enum            │             │
│  │   status: enum           │         │  model: string           │             │
│  │   transcript: string?    │         │  createdAt: Date         │             │
│  │   summary: object?       │         └──────────────────────────┘             │
│  │   createdAt: Date        │                                                   │
│  └──────────────────────────┘                                                   │
│              │                                                                   │
└──────────────│───────────────────────────────────────────────────────────────────┘
               │
               │ Referenced by (not cascade)
               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER DATA (Per-User Scope)                             │
│                                                                                  │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐      │
│  │      users       │      │     folders      │      │    userVideos    │      │
│  │  ══════════════  │      │  ══════════════  │      │  ══════════════  │      │
│  │  _id: ObjectId   │◄─────│  userId: ObjectId│◄─────│  userId: ObjectId│      │
│  │  email: string   │      │  name: string    │      │  videoSummaryId  │──────┘
│  │  passwordHash    │      │  type: enum      │◄─────│  folderId?       │
│  │  name: string    │      │  parentId?       │──┐   │  youtubeId       │
│  │  preferences     │      │  path: string    │  │   │  title, channel  │
│  │  usage: object   │      │  level: number   │  │   │  isFavorite      │
│  │  createdAt       │      │  createdAt       │  │   │  addedAt         │
│  └──────────────────┘      └──────────────────┘  │   └──────────────────┘
│           │                        ▲             │                              │
│           │                        │ Self-ref    │                              │
│           │                        └─────────────┘                              │
│           │                        ▲                                            │
│           │                        │                                            │
│           ▼                        │                                            │
│  ┌──────────────────┐      ┌──────┴───────────┐      ┌──────────────────┐      │
│  │    userChats     │◄─────│  memorizedItems  │      │                  │      │
│  │  ══════════════  │      │  ══════════════  │      │                  │      │
│  │  _id: ObjectId   │      │  userId: ObjectId│      │                  │      │
│  │  userId          │      │  folderId?       │──────┘                  │      │
│  │  memorizedItemId │      │  title: string   │                         │      │
│  │  messages: array │      │  sourceType: enum│                         │      │
│  │  title: string?  │      │  source: object  │ (deep copy)             │      │
│  │  createdAt       │      │  notes, tags     │                         │      │
│  └──────────────────┘      └──────────────────┘                         │      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

Legend:
  ─────>  References (FK)
  ══════  Primary fields
  ?       Nullable field
  (PK)    Primary Key
  (UK)    Unique Key
```

---

## Collections Detail

### 1. videoSummaryCache

**Purpose:** One summary per YouTube video (shared system cache, never deleted)

```typescript
{
  _id: ObjectId,

  // YouTube identification
  youtubeId: string,              // UNIQUE - "dQw4w9WgXcQ"
  url: string,

  // Metadata
  title: string,
  channel: string | null,
  duration: number | null,        // seconds
  thumbnailUrl: string | null,
  language: string | null,        // ISO 639-1

  // Processing state
  status: "pending" | "processing" | "completed" | "failed",
  errorMessage: string | null,
  errorCode: ErrorCode | null,
  retryCount: number,             // default: 0

  // Content
  transcript: string | null,
  transcriptType: "manual" | "auto-generated" | null,

  // Processed summary (null until completed)
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
      id: string,
      name: string,
      definition: string | null,
      timestamp: string | null
    }]
  } | null,

  // Cache metadata
  version: number,
  processedAt: Date | null,
  processingTimeMs: number | null,

  // Cost tracking
  tokenUsage: {
    input: number,
    output: number,
    cost: number                  // USD
  } | null,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
| Fields | Type | Purpose |
|--------|------|---------|
| `youtubeId` | UNIQUE | Prevent duplicate cache entries |
| `status` | Regular | Filter by processing state |

---

### 2. systemExpansionCache

**Purpose:** Cached AI expansions for sections/concepts (shared, never deleted)

```typescript
{
  _id: ObjectId,

  // Target reference
  videoSummaryId: ObjectId,
  targetType: "section" | "concept",
  targetId: string,               // UUID from section or concept

  // Context (cached from source)
  context: {
    videoTitle: string,
    youtubeId: string,
    timestamp?: string,           // For sections
    title?: string,
    summary?: string,
    bullets?: string[],
    name?: string,                // For concepts
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
| Fields | Type | Purpose |
|--------|------|---------|
| `videoSummaryId, targetType, targetId` | UNIQUE | Composite uniqueness |
| `status` | Regular | Filter by state |

---

### 3. users

**Purpose:** User accounts and preferences

```typescript
{
  _id: ObjectId,

  email: string,                  // UNIQUE, lowercase
  passwordHash: string,           // bcrypt (cost 12)
  name: string,

  lastLoginAt: Date | null,

  preferences: {
    defaultSummarizedFolder: ObjectId | null,
    defaultMemorizedFolder: ObjectId | null,
    theme: "light" | "dark" | "system"
  },

  usage: {
    videosThisMonth: number,
    videosResetAt: Date
  },

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
| Fields | Type | Purpose |
|--------|------|---------|
| `email` | UNIQUE | Login/registration |

---

### 4. folders

**Purpose:** Hierarchical organization (Materialized Path pattern)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,

  name: string,
  type: "summarized" | "memorized",

  // Hierarchy
  parentId: ObjectId | null,      // null = root
  path: string,                   // "/AI Learning/LLMs"
  level: number,                  // 1 = root

  // Display
  color: string | null,           // Hex color
  icon: string | null,
  order: number,                  // Sibling ordering

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
| Fields | Type | Purpose |
|--------|------|---------|
| `userId, type, path` | Regular | List by type |
| `userId, parentId` | Regular | Find children |

**Path Pattern:**
```
Root:       "/AI Learning"
Child:      "/AI Learning/LLMs"
Grandchild: "/AI Learning/LLMs/Transformers"
```

---

### 5. userVideos

**Purpose:** User's video library (denormalized metadata)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,

  // Reference to cache
  videoSummaryId: ObjectId,

  // Denormalized (copied at creation)
  youtubeId: string,
  title: string,
  channel: string | null,
  duration: number | null,
  thumbnailUrl: string | null,
  status: string,                 // Synced via $lookup

  // User-specific
  folderId: ObjectId | null,
  notes: string | null,
  isFavorite: boolean,

  addedAt: Date,
  lastViewedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
| Fields | Type | Purpose |
|--------|------|---------|
| `userId, videoSummaryId` | UNIQUE | One per user |
| `userId, folderId` | Regular | List in folder |
| `userId, createdAt` | Regular (DESC) | Sort by date |

---

### 6. memorizedItems

**Purpose:** User's knowledge collection (deep copy, independent of source)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,

  title: string,
  folderId: ObjectId | null,

  sourceType: "video_section" | "video_concept" | "system_expansion",

  // Independent copy (works without source)
  source: {
    videoSummaryId: ObjectId,
    youtubeId: string,
    videoTitle: string,
    videoThumbnail: string,
    youtubeUrl: string,

    startSeconds?: number,
    endSeconds?: number,
    sectionIds?: string[],
    expansionId?: ObjectId,

    content: {
      sections?: [{
        id: string,
        timestamp: string,
        title: string,
        summary: string,
        bullets: string[]
      }],
      concept?: {
        name: string,
        definition: string | null
      },
      expansion?: string
    }
  },

  notes: string | null,
  tags: string[],

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
| Fields | Type | Purpose |
|--------|------|---------|
| `userId, folderId` | Regular | List in folder |
| `userId, source.videoSummaryId` | Regular | Find by source |
| `userId, tags` | Regular | Filter by tags |
| `userId, createdAt` | Regular (DESC) | Sort by date |

---

### 7. userChats

**Purpose:** AI conversations per memorized item

```typescript
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
| Fields | Type | Purpose |
|--------|------|---------|
| `userId, memorizedItemId` | Regular | Find chats for item |
| `userId, updatedAt` | Regular (DESC) | Recent chats |

---

## Enums & Constants

### ProcessingStatus
```typescript
type ProcessingStatus = "pending" | "processing" | "completed" | "failed"
```

### ErrorCode
```typescript
type ErrorCode =
  | "NO_TRANSCRIPT"
  | "VIDEO_TOO_LONG"
  | "VIDEO_TOO_SHORT"
  | "VIDEO_UNAVAILABLE"
  | "VIDEO_RESTRICTED"
  | "LIVE_STREAM"
  | "LLM_ERROR"
  | "UNKNOWN_ERROR"
```

### FolderType
```typescript
type FolderType = "summarized" | "memorized"
```

### SourceType
```typescript
type SourceType = "video_section" | "video_concept" | "system_expansion"
```

---

## Relationships & Foreign Keys

```
┌─────────────────────┬─────────────────────┬───────────────────────┬──────────────┐
│ Source Collection   │ Field               │ Target Collection     │ On Delete    │
├─────────────────────┼─────────────────────┼───────────────────────┼──────────────┤
│ userVideos          │ userId              │ users._id             │ CASCADE      │
│ userVideos          │ videoSummaryId      │ videoSummaryCache._id │ NO ACTION    │
│ userVideos          │ folderId            │ folders._id           │ SET NULL     │
├─────────────────────┼─────────────────────┼───────────────────────┼──────────────┤
│ folders             │ userId              │ users._id             │ CASCADE      │
│ folders             │ parentId            │ folders._id           │ CASCADE      │
├─────────────────────┼─────────────────────┼───────────────────────┼──────────────┤
│ memorizedItems      │ userId              │ users._id             │ CASCADE      │
│ memorizedItems      │ folderId            │ folders._id           │ SET NULL     │
│ memorizedItems      │ source.videoSummary │ videoSummaryCache._id │ NO ACTION    │
├─────────────────────┼─────────────────────┼───────────────────────┼──────────────┤
│ userChats           │ userId              │ users._id             │ CASCADE      │
│ userChats           │ memorizedItemId     │ memorizedItems._id    │ CASCADE      │
├─────────────────────┼─────────────────────┼───────────────────────┼──────────────┤
│ systemExpansionCache│ videoSummaryId      │ videoSummaryCache._id │ NO ACTION    │
└─────────────────────┴─────────────────────┴───────────────────────┴──────────────┘
```

---

## Cascade Delete Behavior

### When User is Deleted
- `userVideos` - All deleted
- `memorizedItems` - All deleted
- `userChats` - All deleted
- `folders` - All deleted
- `videoSummaryCache` - NOT deleted (shared)
- `systemExpansionCache` - NOT deleted (shared)

### When Folder is Deleted
- Child folders - Cascade deleted
- `userVideos` in folder - Moved to root OR deleted
- `memorizedItems` in folder - Moved to root OR deleted

### When MemorizedItem is Deleted
- `userChats` - Cascade deleted
- Source video - NOT affected

---

## Denormalization Strategy

### System Cache → User Data

| Pattern | Collections | What's Copied | Why |
|---------|-------------|---------------|-----|
| Copy-on-Create | videoSummaryCache → userVideos | title, channel, thumbnailUrl | Fast list views |
| Deep Copy | videoSummaryCache → memorizedItems | Full section/concept content | Independent of source |
| $lookup Join | videoSummaryCache ← userVideos | status | Real-time state |

---

## Query Patterns

### Video List with Status
```javascript
db.userVideos.aggregate([
  { $match: { userId: ObjectId("...") } },
  { $lookup: {
      from: "videoSummaryCache",
      localField: "videoSummaryId",
      foreignField: "_id",
      as: "cache"
    }
  },
  { $unwind: { path: "$cache", preserveNullAndEmptyArrays: true } }
])
```

### Folder Descendants
```javascript
db.folders.aggregate([
  { $match: { _id: parentFolderId } },
  { $graphLookup: {
      from: "folders",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "parentId",
      as: "descendants"
    }
  }
])
```

---

## Document Size Estimates

| Collection | Avg Size | Notes |
|------------|----------|-------|
| videoSummaryCache | 50-200 KB | Depends on transcript length |
| systemExpansionCache | 10-50 KB | Markdown content |
| users | 1 KB | Minimal |
| folders | 1 KB | Hierarchy only |
| userVideos | 2-5 KB | Denormalized metadata |
| memorizedItems | 5-30 KB | Depends on content |
| userChats | 10-500 KB | Depends on conversation |

---

## Key Design Decisions

| Decision | Implementation | Rationale |
|----------|----------------|-----------|
| Shared Cache | One `videoSummaryCache` per video | Save LLM costs, consistent summaries |
| Denormalization | Copy metadata to userVideos | Fast reads without joins |
| Deep Copy | Full content in memorizedItems | Items work independently |
| Materialized Paths | `path` field in folders | Efficient hierarchy queries |
| No Redis (MVP) | MongoDB only | Simplicity first |
| Hard Deletes | No soft delete flag | Data truly removed |

---

## File Locations

**API Services:**
- `api/src/services/video.service.ts`
- `api/src/services/memorize.service.ts`
- `api/src/services/folder.service.ts`
- `api/src/services/auth.service.ts`

**Python Services:**
- `services/summarizer/src/repositories/mongodb_repository.py`
- `services/explainer/src/services/mongodb.py`

**Type Definitions:**
- `packages/types/src/index.ts`
- `services/summarizer/src/models/schemas.py`

**Documentation:**
- `docs/DATA-MODELS.md` (source of truth)
