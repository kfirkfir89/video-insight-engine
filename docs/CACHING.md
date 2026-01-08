# Caching Strategy

Token optimization through system-level caching.

---

## Problem

Without caching, LLM costs multiply:

```
User A summarizes video → LLM call → $X
User B summarizes SAME video → LLM call → $X
User C summarizes SAME video → LLM call → $X

Total: $3X for identical work
```

---

## Solution

Process once, reuse forever.

| Data              | Cached? | Collection             |
| ----------------- | ------- | ---------------------- |
| Video summaries   | ✅ Yes  | `videoSummaryCache`    |
| System expansions | ✅ Yes  | `systemExpansionCache` |
| User chats        | ❌ No   | `userChats`            |

---

## Cache Flows

### Video Summary Cache

```
User submits YouTube URL
         │
         ▼
   Check videoSummaryCache
   by youtubeId
         │
    ┌────┴────┐
    │         │
   HIT      MISS
    │         │
    ▼         ▼
  Reuse    Process with LLM
  cached        │
    │           ▼
    │      Save to cache
    │           │
    └─────┬─────┘
          │
          ▼
   Create userVideo reference
```

### System Expansion Cache

```
User clicks "Explain" on section
         │
         ▼
   Check systemExpansionCache
   by videoSummaryId + targetId
         │
    ┌────┴────┐
    │         │
   HIT      MISS
    │         │
    ▼         ▼
 Return    Generate with LLM
 cached         │
    │           ▼
    │      Save to cache
    │           │
    └─────┬─────┘
          │
          ▼
    Return expansion
```

### User Chat (NOT Cached)

```
User sends message
         │
         ▼
   Load memorized item context
   Load chat history
         │
         ▼
   ALWAYS call LLM
   (personalized, contextual)
         │
         ▼
   Save to userChats
         │
         ▼
   Return response
```

---

## Cost Savings Example

Popular React tutorial, 100 users:

| Scenario      | LLM Calls | Cost     |
| ------------- | --------- | -------- |
| Without cache | 100       | $50-100  |
| With cache    | 1         | $0.50-1  |
| **Savings**   |           | **~99%** |

---

## What's Cached vs Not

### ✅ System Cache (Shared)

| Data              | Why                                  |
| ----------------- | ------------------------------------ |
| Video summaries   | Same video = same summary            |
| System expansions | Same section = same base explanation |

### ❌ User Data (Per-User)

| Data            | Why                                   |
| --------------- | ------------------------------------- |
| User chats      | Personalized conversations            |
| Memorized items | User's selection (but copies content) |
| Folders         | User organization                     |
| Notes           | Personal annotations                  |

---

## Memorized Items: Special Case

Memorized items are **user data** but **copy content** from cache:

```
User clicks "Memorize"
         │
         ▼
   Load from system cache
         │
         ▼
   COPY content into
   memorizedItem.source.content
         │
         ▼
   Save to user's collection
```

This ensures memorized items work **independently** - even if source changes.

---

## Race Condition Handling

Two users submit same video simultaneously:

1. First request: create cache entry with `status: "processing"`
2. Second request: sees "processing", waits/polls
3. First completes: saves result, `status: "completed"`
4. Second request: gets cached result

---

## Cache Invalidation

System caches are **permanent** - same video always produces same summary.

To invalidate (e.g., improved prompts):

1. Add `version` field to cache entries
2. Bump version = regenerate
3. Migrate old caches via script if needed

---

## No Redis Needed

The "cache" is just MongoDB collections. No Redis because:

- Data is permanent (no TTL)
- Full query flexibility needed
- Simpler stack
- Add Redis later if needed for rate limiting, sessions, or scaling
