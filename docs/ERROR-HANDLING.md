# Error Handling

Error codes, recovery strategies, and user messages.

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {},
  "statusCode": 400
}
```

---

## Error Codes by Category

### Authentication Errors (401)

| Code              | Message                       | When                     |
| ----------------- | ----------------------------- | ------------------------ |
| `UNAUTHORIZED`    | Authentication required       | No token provided        |
| `TOKEN_EXPIRED`   | Token has expired             | Access token expired     |
| `TOKEN_INVALID`   | Invalid token                 | Token malformed/tampered |
| `REFRESH_EXPIRED` | Session expired, please login | Refresh token expired    |

### Authorization Errors (403)

| Code           | Message           | When                      |
| -------------- | ----------------- | ------------------------- |
| `FORBIDDEN`    | Access denied     | User doesn't own resource |
| `RATE_LIMITED` | Too many requests | Rate limit exceeded       |

### Rate Limit Errors

See [docs/SECURITY.md](./SECURITY.md#rate-limiting) for implementation.

| Code           | Message           | When                |
| -------------- | ----------------- | ------------------- |
| `RATE_LIMITED` | Too many requests | Rate limit exceeded |

### Validation Errors (400)

| Code               | Message              | When                       |
| ------------------ | -------------------- | -------------------------- |
| `INVALID_URL`      | Invalid YouTube URL  | URL doesn't match patterns |
| `INVALID_EMAIL`    | Invalid email format | Email validation failed    |
| `WEAK_PASSWORD`    | Password too weak    | Doesn't meet requirements  |
| `VALIDATION_ERROR` | Validation failed    | Generic Zod error          |

### Video Processing Errors (400/422)

| Code                | Message                                  | When               |
| ------------------- | ---------------------------------------- | ------------------ |
| `NO_TRANSCRIPT`     | No transcript available for this video   | Captions disabled  |
| `VIDEO_TOO_LONG`    | Video exceeds maximum duration (3 hours) | > 180 minutes      |
| `VIDEO_TOO_SHORT`   | Video too short to summarize             | < 60 seconds       |
| `VIDEO_UNAVAILABLE` | Video is private or unavailable          | Can't access       |
| `VIDEO_RESTRICTED`  | Age-restricted video not supported       | Requires auth      |
| `LIVE_STREAM`       | Live streams not supported               | Is a live stream   |
| `PROCESSING_FAILED` | Failed to process video                  | LLM/internal error |

### Resource Errors (404)

| Code               | Message            | When                        |
| ------------------ | ------------------ | --------------------------- |
| `NOT_FOUND`        | Resource not found | Generic 404                 |
| `VIDEO_NOT_FOUND`  | Video not found    | userVideo doesn't exist     |
| `FOLDER_NOT_FOUND` | Folder not found   | folder doesn't exist        |
| `ITEM_NOT_FOUND`   | Item not found     | memorizedItem doesn't exist |

### Server Errors (500)

| Code                  | Message                         | When                  |
| --------------------- | ------------------------------- | --------------------- |
| `INTERNAL_ERROR`      | Something went wrong            | Unexpected error      |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | Dependency down       |
| `LLM_ERROR`           | AI service error                | Claude API failed     |
| `DATABASE_ERROR`      | Database error                  | MongoDB failed        |
| `SUMMARIZER_ERROR`    | Summarizer service error        | Summarizer unreachable |

---

## Video Processing Edge Cases

### Detection Flow

```
URL submitted
      │
      ▼
┌─────────────────┐
│ Validate URL    │──── Invalid ────► INVALID_URL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check cache     │──── Exists ────► Return cached
└────────┬────────┘
         │ Miss
         ▼
┌─────────────────┐
│ Fetch metadata  │──── Failed ────► VIDEO_UNAVAILABLE
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check duration  │──── > 3h ──────► VIDEO_TOO_LONG
└────────┬────────┘     < 1m ──────► VIDEO_TOO_SHORT
         │
         ▼
┌─────────────────┐
│ Check type      │──── Live ──────► LIVE_STREAM
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch transcript│──── None ──────► NO_TRANSCRIPT
└────────┬────────┘     Restricted ► VIDEO_RESTRICTED
         │
         ▼
   HTTP POST to summarizer
```

### Implementation

```typescript
// summarizer/src/services/transcript.py

async def validate_video(youtube_id: str) -> VideoValidation:
    """Validate video before processing."""

    # Fetch metadata
    try:
        metadata = await get_video_metadata(youtube_id)
    except VideoNotFoundError:
        return ValidationError("VIDEO_UNAVAILABLE")

    # Check if live
    if metadata.is_live:
        return ValidationError("LIVE_STREAM")

    # Check duration
    if metadata.duration > 180 * 60:  # 3 hours
        return ValidationError("VIDEO_TOO_LONG")
    if metadata.duration < 60:  # 1 minute
        return ValidationError("VIDEO_TOO_SHORT")

    # Check transcript
    try:
        transcript = await fetch_transcript(youtube_id)
        if not transcript:
            return ValidationError("NO_TRANSCRIPT")
    except RestrictedVideoError:
        return ValidationError("VIDEO_RESTRICTED")

    return VideoValidation(
        valid=True,
        metadata=metadata,
        transcript=transcript
    )
```

### User-Facing Messages

| Error             | User Message                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------- |
| NO_TRANSCRIPT     | "This video doesn't have captions. We can only summarize videos with available transcripts." |
| VIDEO_TOO_LONG    | "This video is over 3 hours. Please try a shorter video."                                    |
| VIDEO_TOO_SHORT   | "This video is too short to summarize meaningfully."                                         |
| VIDEO_UNAVAILABLE | "This video is private or has been removed."                                                 |
| VIDEO_RESTRICTED  | "Age-restricted videos aren't supported."                                                    |
| LIVE_STREAM       | "Live streams can't be summarized. Please wait until the stream ends."                       |

---

## Retry Strategy

### Automatic Retries (Internal)

```python
# summarizer retry config
RETRY_CONFIG = {
    "max_retries": 3,
    "backoff": [5, 15, 60],  # seconds
    "retryable_errors": [
        "LLM_ERROR",        # Claude API timeout
        "DATABASE_ERROR",   # MongoDB connection
        "NETWORK_ERROR",    # Transcript fetch
    ],
}
```

```python
# services/summarizer/src/services/summarizer.py

async def run_summarization(
    video_summary_id: str,
    youtube_id: str,
    url: str,
    user_id: str,
):
    """Process with retry logic."""

    for attempt in range(RETRY_CONFIG["max_retries"]):
        try:
            result = await summarize_video(youtube_id)
            return result

        except RetryableError as e:
            if attempt < RETRY_CONFIG["max_retries"] - 1:
                delay = RETRY_CONFIG["backoff"][attempt]
                logger.warning(f"Retry {attempt + 1}, waiting {delay}s")
                await asyncio.sleep(delay)
            else:
                # Max retries reached - mark as failed
                await update_status(video_summary_id, "failed", error=str(e))
                raise
```

### Manual Retry (User-Initiated)

```
POST /api/videos/:id/retry
```

Available when:

- Status is `failed`
- Error is retryable (not INVALID_URL, VIDEO_TOO_LONG, etc.)
- Within 24 hours of failure

Response:

```json
{
  "video": {
    "id": "...",
    "status": "pending",
    "retryCount": 1
  }
}
```

Implementation:

```typescript
// api/src/routes/videos.routes.ts

fastify.post("/videos/:id/retry", async (req, reply) => {
  const video = await findUserVideo(req.params.id, req.user.id);

  if (!video) {
    return reply.code(404).send({ error: "VIDEO_NOT_FOUND" });
  }

  // Check if retryable
  const nonRetryableErrors = [
    "INVALID_URL",
    "VIDEO_TOO_LONG",
    "VIDEO_TOO_SHORT",
    "NO_TRANSCRIPT",
    "VIDEO_RESTRICTED",
    "LIVE_STREAM",
  ];

  if (video.status !== "failed") {
    return reply.code(400).send({
      error: "INVALID_STATE",
      message: "Video is not in failed state",
    });
  }

  if (nonRetryableErrors.includes(video.errorCode)) {
    return reply.code(400).send({
      error: "NOT_RETRYABLE",
      message: "This error cannot be retried",
    });
  }

  // Reset and re-trigger
  await updateVideoCache(video.videoSummaryId, {
    status: "pending",
    errorMessage: null,
    errorCode: null,
    retryCount: video.retryCount + 1,
  });

  // Trigger summarizer via HTTP
  await triggerSummarization({
    videoSummaryId: video.videoSummaryId,
    youtubeId: video.youtubeId,
    url: video.url,
    userId: req.user.id,
  });

  return {
    video: {
      id: video._id,
      status: "pending",
      retryCount: video.retryCount + 1,
    },
  };
});
```

---

## Failed Jobs Tracking

Failed jobs after max retries are tracked in MongoDB:

```python
# services/summarizer/src/services/mongodb.py

async def mark_job_failed(
    video_summary_id: str,
    error_code: str,
    error_message: str,
    attempts: int,
):
    """Mark job as failed after max retries."""
    await db.videoSummaryCache.update_one(
        {"_id": ObjectId(video_summary_id)},
        {
            "$set": {
                "status": "failed",
                "errorCode": error_code,
                "errorMessage": error_message,
                "attempts": attempts,
                "failedAt": datetime.utcnow(),
            }
        }
    )
```

Failed job record:

```json
{
  "_id": "507f1f77bcf86cd799439020",
  "youtubeId": "dQw4w9WgXcQ",
  "status": "failed",
  "errorCode": "LLM_ERROR",
  "errorMessage": "Rate limit exceeded",
  "attempts": 3,
  "failedAt": "2024-01-15T10:00:00Z"
}
```

### Monitoring Failed Jobs

```python
# Query failed jobs
async def get_failed_jobs_count() -> int:
    return await db.videoSummaryCache.count_documents({
        "status": "failed",
        "failedAt": {"$gte": datetime.utcnow() - timedelta(hours=24)}
    })

# Alert if too many failures
if await get_failed_jobs_count() > 10:
    await send_alert("More than 10 failed jobs in last 24h")
```

---

## LLM Error Handling

### Claude API Errors

| Error                 | Action               |
| --------------------- | -------------------- |
| Rate limit (429)      | Retry with backoff   |
| Server error (500)    | Retry with backoff   |
| Invalid request (400) | Log, fail job        |
| Auth error (401)      | Alert, fail all jobs |

### Fallback Strategy

```python
# summarizer/src/services/llm.py

LLM_CONFIG = {
    'primary': 'claude-sonnet-4-20250514',
    'fallback': 'claude-3-haiku-20240307',  # Cheaper, for retries
    'max_retries': 3
}

async def call_llm(prompt: str, attempt: int = 1):
    """Call Claude with fallback."""

    model = LLM_CONFIG['primary'] if attempt <= 2 else LLM_CONFIG['fallback']

    try:
        return await anthropic.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
    except RateLimitError:
        if attempt < LLM_CONFIG['max_retries']:
            await asyncio.sleep(BACKOFF[attempt])
            return await call_llm(prompt, attempt + 1)
        raise
    except ServerError:
        if attempt < LLM_CONFIG['max_retries']:
            await asyncio.sleep(BACKOFF[attempt])
            return await call_llm(prompt, attempt + 1)
        raise
```

---

## Frontend Error Handling

### API Client

```typescript
// web/src/api/client.ts

class ApiClient {
  private token: string | null = null;

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include", // For cookies
      headers: {
        "Content-Type": "application/json",
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
    });

    if (res.status === 401) {
      // Try refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request(endpoint, options); // Retry
      }
      // Redirect to login
      window.location.href = "/login";
      throw new Error("Session expired");
    }

    if (!res.ok) {
      const error = await res.json();
      throw new ApiError(error.error, error.message, res.status);
    }

    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const { accessToken } = await res.json();
        this.token = accessToken;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
```

### User Notifications

```typescript
// web/src/utils/errors.ts

const ERROR_MESSAGES: Record<string, string> = {
  // Video errors
  NO_TRANSCRIPT: "This video doesn't have captions available.",
  VIDEO_TOO_LONG: "Video is too long (max 3 hours).",
  VIDEO_TOO_SHORT: "Video is too short to summarize.",
  VIDEO_UNAVAILABLE: "This video is private or unavailable.",
  VIDEO_RESTRICTED: "Age-restricted videos aren't supported.",
  LIVE_STREAM: "Live streams can't be summarized yet.",

  // Auth errors
  UNAUTHORIZED: "Please log in to continue.",
  TOKEN_EXPIRED: "Your session expired. Please log in again.",

  // Rate limit
  RATE_LIMITED: "Too many requests. Please wait a moment.",

  // Default
  default: "Something went wrong. Please try again.",
};

export function handleError(error: ApiError) {
  const message = ERROR_MESSAGES[error.code] || ERROR_MESSAGES.default;
  toast.error(message);
}
```

---

## Monitoring Errors

### Error Logging

```typescript
// api/src/utils/logger.ts

export function logError(error: Error, context: object) {
  logger.error({
    error: {
      code: error.code || "UNKNOWN",
      message: error.message,
      stack: error.stack,
    },
    context: {
      userId: context.userId,
      endpoint: context.endpoint,
      method: context.method,
      requestId: context.requestId,
    },
    timestamp: new Date().toISOString(),
  });
}
```

### Alert Thresholds

| Metric               | Threshold | Action |
| -------------------- | --------- | ------ |
| Error rate > 5%      | 5 min     | Alert  |
| LLM errors > 10/min  | Immediate | Alert  |
| Failed jobs > 20%    | 1 hour    | Alert  |
| Failed jobs > 10/24h | Immediate | Alert  |

---

## Error Handling Checklist

Before deploying:

- [ ] All API endpoints return consistent error format
- [ ] Validation errors include field-level details
- [ ] Rate limit responses include Retry-After header
- [ ] Frontend handles 401 with token refresh
- [ ] Video edge cases detected before processing
- [ ] Retry logic with exponential backoff
- [ ] Failed jobs tracked in MongoDB
- [ ] Error logging with request context
- [ ] Alerts configured for critical thresholds
