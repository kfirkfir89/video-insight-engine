# Caching Strategy

Multi-layer caching for cost optimization and fast responses.

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

Process once, reuse forever. Three cache layers:

| Layer     | Store    | Keyed By               | Purpose                    |
| --------- | -------- | ---------------------- | -------------------------- |
| L1        | Redis    | `youtube_id`           | Full VIEResponse (fastest) |
| L2        | MongoDB  | `youtubeId` field      | Persistent video summaries |
| L3        | S3       | `youtube_id` prefix    | Extracted video frames     |

---

## Cache Flows

### Video Summary Cache (3-Layer)

```
User submits YouTube URL
         │
         ▼
   Check Redis (L1)
   by youtube_id
         │
    ┌────┴────┐
    │         │
   HIT      MISS
    │         │
    ▼         ▼
  Return   Check MongoDB (L2)
  instant  by youtubeId
  ($0.00)      │
    │     ┌────┴────┐
    │     │         │
    │    HIT      MISS
    │     │         │
    │     ▼         ▼
    │   Return   Process with LLM
    │   cached        │
    │     │           ▼
    │     │      Save to MongoDB (L2)
    │     │      Save to Redis (L1)
    │     │           │
    │     └─────┬─────┘
    │           │
    └─────┬─────┘
          │
          ▼
   Create userVideo reference
```

### S3 Frame Cache

```
Pipeline needs frames for video
         │
         ▼
   Check S3 for existing frames
   by youtube_id prefix
         │
    ┌────┴────┐
    │         │
   HIT      MISS
    │         │
    ▼         ▼
  Skip     Extract frames (FFmpeg)
  extraction  Score + select ~25
    │         Upload to S3
    │           │
    └─────┬─────┘
          │
          ▼
   Return frame URLs
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
   Load video context
   Load chat history
         │
         ▼
   ALWAYS call LLM
   (personalized, contextual)
         │
         ▼
   Return response
```

---

## Cost Savings Example

Popular React tutorial, 100 users:

| Scenario            | LLM Calls | Cost     |
| ------------------- | --------- | -------- |
| Without cache       | 100       | $50-100  |
| With MongoDB cache  | 1         | $0.50-1  |
| Redis cache hit     | 0         | $0.00    |
| **Savings**         |           | **~99%** |

With the Redis layer, cache hits skip the MongoDB query entirely for even faster response times.

---

## What's Cached vs Not

### System Cache (Shared)

| Data              | Store          | Why                                  |
| ----------------- | -------------- | ------------------------------------ |
| VIEResponse       | Redis          | Instant serve, same video = $0.00    |
| Video summaries   | MongoDB        | Persistent, same video = same output |
| System expansions | MongoDB        | Same section = same explanation      |
| Video frames      | S3             | Skip re-extraction for known videos  |

### User Data (Per-User)

| Data            | Why                                   |
| --------------- | ------------------------------------- |
| User chats      | Personalized conversations            |
| Folders         | User organization                     |
| Notes           | Personal annotations                  |

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
4. Redis entries can be flushed independently of MongoDB

---

## Redis Configuration

- **Image:** `redis:7-alpine`
- **Port:** 6379
- **Persistence:** AOF (`--appendonly yes`)
- **Connection:** `REDIS_URL=redis://vie-redis:6379`
- **Data:** Full VIEResponse JSON keyed by `youtube_id`
