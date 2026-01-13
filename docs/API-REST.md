# REST API Reference

All endpoints served by `vie-api` on port 3000.

Base URL: `/api`

---

## Authentication

### POST /auth/register

Create new account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Cookies Set:**

```
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

---

### POST /auth/login

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Cookies Set:**

```
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

---

### POST /auth/refresh

Get new access token using refresh token cookie.

**Cookies Required:** `refreshToken` (HttpOnly cookie)

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Error (401):**

```json
{
  "error": "REFRESH_EXPIRED",
  "message": "Session expired, please login again",
  "statusCode": 401
}
```

---

### POST /auth/logout

Clear refresh token and end session.

**Cookies Required:** `refreshToken` (HttpOnly cookie)

**Response (200):**

```json
{
  "success": true
}
```

**Cookies Cleared:**

```
Set-Cookie: refreshToken=; HttpOnly; Path=/api/auth/refresh; Max-Age=0
```

---

### GET /auth/me

Get current user.

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**

```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "John Doe"
}
```

---

## Folders

### GET /folders

List folders by type.

**Query:** `?type=summarized|memorized`

**Response (200):**

```json
{
  "folders": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "AI Learning",
      "type": "summarized",
      "parentId": null,
      "path": "/AI Learning",
      "level": 1,
      "color": "#3B82F6",
      "icon": "folder"
    }
  ]
}
```

---

### POST /folders

Create folder.

**Request:**

```json
{
  "name": "React Tutorials",
  "type": "summarized",
  "parentId": "507f1f77bcf86cd799439012",
  "color": "#10B981",
  "icon": "code"
}
```

**Response (201):**

```json
{
  "id": "507f1f77bcf86cd799439013",
  "name": "React Tutorials",
  "type": "summarized",
  "parentId": "507f1f77bcf86cd799439012",
  "path": "/AI Learning/React Tutorials",
  "level": 2
}
```

---

### PATCH /folders/:id

Update folder.

**Request:**

```json
{
  "name": "React & Hooks",
  "parentId": null
}
```

**Response (200):** Updated folder object.

---

### DELETE /folders/:id

Delete folder. Contents moved to parent (or unfiled).

**Response:** `204 No Content`

---

## Videos

### GET /videos

List user's videos.

**Query:** `?folderId=xxx` (optional)

**Response (200):**

```json
{
  "videos": [
    {
      "id": "507f1f77bcf86cd799439014",
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "title": "React Hooks Tutorial",
      "channel": "Fireship",
      "duration": 1200,
      "thumbnailUrl": "https://img.youtube.com/...",
      "status": "completed",
      "folderId": "507f1f77bcf86cd799439013",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /videos/:id

Get video with summary.

**Response (200):**

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "youtubeId": "dQw4w9WgXcQ",
    "title": "React Hooks Tutorial",
    "status": "completed"
  },
  "summary": {
    "tldr": "Comprehensive guide to React Hooks...",
    "keyTakeaways": ["useState for state", "useEffect for side effects"],
    "sections": [
      {
        "id": "sec-001",
        "timestamp": "00:00",
        "startSeconds": 0,
        "endSeconds": 180,
        "title": "Introduction",
        "summary": "Overview of React Hooks...",
        "bullets": ["What are hooks", "Why use them"]
      }
    ],
    "concepts": [
      {
        "id": "con-001",
        "name": "useState",
        "definition": "Hook for managing state in functional components",
        "timestamp": "02:30"
      }
    ]
  }
}
```

---

### POST /videos

Submit YouTube URL for summarization.

**Request:**

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "folderId": "507f1f77bcf86cd799439013"
}
```

**Logic:**

1. Extract `youtubeId` from URL
2. Check `videoSummaryCache` for existing summary
3. If **HIT**: create `userVideo` reference, return immediately
4. If **MISS**: create cache entry, publish job, return with `status: pending`

**Response (201):**

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "youtubeId": "dQw4w9WgXcQ",
    "status": "completed",
    "title": "React Hooks Tutorial"
  },
  "cached": true
}
```

Or if processing:

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "youtubeId": "dQw4w9WgXcQ",
    "status": "pending"
  },
  "cached": false
}
```

---

### DELETE /videos/:id

Remove video from user's library.

**Note:** Only removes `userVideo` reference. Cache and memorized items unaffected.

**Response:** `204 No Content`

---

## Explain

### GET /explain/:videoSummaryId/:targetType/:targetId

Get expansion for section or concept.

**Parameters:**

- `videoSummaryId`: ID of videoSummaryCache entry
- `targetType`: `section` or `concept`
- `targetId`: UUID of section or concept

**Logic:** Calls MCP `explain_auto` tool on vie-explainer.

**Response (200):**

```json
{
  "expansion": "# useState Hook\n\nThe useState hook is...",
  "cached": true
}
```

---

### POST /explain/chat

Send chat message about memorized item.

**Request:**

```json
{
  "memorizedItemId": "507f1f77bcf86cd799439030",
  "message": "Can you explain this with an example?",
  "chatId": "507f1f77bcf86cd799439040"
}
```

**Logic:** Calls MCP `explain_chat` tool on vie-explainer.

**Response (200):**

```json
{
  "response": "Sure! Here's a practical example...",
  "chatId": "507f1f77bcf86cd799439040"
}
```

---

### POST /explain/chat/stream

Stream chat response via Server-Sent Events (SSE).

**Request:**

```json
{
  "memorizedItemId": "507f1f77bcf86cd799439030",
  "message": "Can you explain this with an example?",
  "chatId": "507f1f77bcf86cd799439040"
}
```

**Response (SSE stream):**

```
Content-Type: text/event-stream

data: {"token": "Sure", "chatId": "507f1f77bcf86cd799439040"}

data: {"token": "!", "chatId": "507f1f77bcf86cd799439040"}

data: {"token": " Here's", "chatId": "507f1f77bcf86cd799439040"}

data: [DONE]
```

**Usage:** For real-time streaming responses in the UI. Each token is delivered as it's generated by the LLM, providing a ChatGPT-like experience.

---

## Memorize

### GET /memorize

List memorized items.

**Query:** `?folderId=xxx` (optional)

**Response (200):**

```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439030",
      "title": "React Hooks Fundamentals",
      "sourceType": "video_section",
      "source": {
        "videoTitle": "React Hooks Tutorial",
        "youtubeUrl": "https://youtube.com/watch?v=xxx&t=120"
      },
      "folderId": "507f1f77bcf86cd799439013",
      "tags": ["react", "hooks"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /memorize/:id

Get memorized item with full content.

**Response (200):**

```json
{
  "item": {
    "id": "507f1f77bcf86cd799439030",
    "title": "React Hooks Fundamentals",
    "sourceType": "video_section",
    "source": {
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "videoTitle": "React Hooks Tutorial",
      "videoThumbnail": "https://img.youtube.com/...",
      "youtubeUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ&t=120",
      "startSeconds": 120,
      "endSeconds": 480,
      "content": {
        "sections": [
          {
            "id": "sec-001",
            "timestamp": "02:00",
            "title": "useState Basics",
            "summary": "...",
            "bullets": ["..."]
          }
        ]
      }
    },
    "notes": "Remember to always include dependencies...",
    "tags": ["react", "hooks"]
  }
}
```

---

### POST /memorize

Create memorized item.

**Request:**

```json
{
  "title": "React Hooks Fundamentals",
  "sourceType": "video_section",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "sectionIds": ["sec-001", "sec-002"],
  "startSeconds": 120,
  "endSeconds": 480,
  "folderId": "507f1f77bcf86cd799439013",
  "tags": ["react", "hooks"]
}
```

Or for concept:

```json
{
  "title": "Understanding useState",
  "sourceType": "video_concept",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "conceptId": "con-001"
}
```

Or for expansion:

```json
{
  "title": "Deep Dive: useState",
  "sourceType": "system_expansion",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "expansionId": "507f1f77bcf86cd799439050"
}
```

**Response (201):** Created item with cached content.

---

### PATCH /memorize/:id

Update memorized item.

**Request:**

```json
{
  "title": "React Hooks - Complete Guide",
  "notes": "Updated notes...",
  "tags": ["react", "hooks", "state"],
  "folderId": "507f1f77bcf86cd799439014"
}
```

**Response (200):** Updated item.

---

### DELETE /memorize/:id

Delete memorized item.

**Response:** `204 No Content`

---

### GET /memorize/:id/chats

List chats for memorized item.

**Response (200):**

```json
{
  "chats": [
    {
      "id": "507f1f77bcf86cd799439040",
      "title": "Understanding hooks",
      "messageCount": 5,
      "updatedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "NOT_FOUND",
  "message": "Video not found",
  "statusCode": 404
}
```

Common error codes:

- `400` - Bad Request (validation)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error
