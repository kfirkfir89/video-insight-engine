# YouTube Playlist Support - Context

**Last Updated**: 2026-01-28

---

## Key Files Reference

### Backend - API Service

| File | Purpose | Relevant Code |
|------|---------|---------------|
| `api/src/utils/youtube.ts` | URL parsing | `extractYoutubeId()`, `isValidYoutubeUrl()` |
| `api/src/services/video.service.ts` | Video creation | `createVideo()`, cache logic |
| `api/src/services/folder.service.ts` | Folder ops | `createFolder()`, hierarchy |
| `api/src/routes/videos.routes.ts` | REST routes | POST /api/videos pattern |
| `api/src/app.ts` | Route registration | Plugin registration pattern |

### Backend - Summarizer Service

| File | Purpose | Relevant Code |
|------|---------|---------------|
| `services/summarizer/src/main.py` | FastAPI app | Endpoint registration |
| `services/summarizer/src/services/youtube.py` | yt-dlp wrapper | `extract_metadata()` |
| `services/summarizer/src/models/schemas.py` | Pydantic models | Request/response schemas |

### Frontend

| File | Purpose | Relevant Code |
|------|---------|---------------|
| `apps/web/src/components/videos/AddVideoDialog.tsx` | Video form | URL input, submission |
| `apps/web/src/api/videos.ts` | API client | `videosApi.create()` |
| `apps/web/src/hooks/use-videos.ts` | React Query | `useAddVideo()` mutation |
| `apps/web/src/hooks/use-folders.ts` | Folder hooks | `useCreateFolder()` |

### Shared Types

| File | Purpose | Relevant Types |
|------|---------|----------------|
| `packages/types/src/index.ts` | Type defs | `VideoResponse`, `ProcessingStatus` |

---

## Existing Patterns to Follow

### URL Parsing Pattern (youtube.ts)

```typescript
// Current pattern
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
];

export function extractYoutubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

### Video Creation Pattern (video.service.ts)

```typescript
async createVideo(
  userId: string,
  url: string,
  folderId?: string,
  bypassCache?: boolean,
  providers?: ProviderConfig
): Promise<VideoResponse> {
  // 1. Extract YouTube ID
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) throw new InvalidYouTubeUrlError();

  // 2. Check existing user video
  const existing = await this.getUserVideoByYoutubeId(userId, youtubeId, folderId);
  if (existing) return existing;

  // 3. Check/create cache entry
  let cacheEntry = await this.getCachedSummary(youtubeId);
  if (!cacheEntry || bypassCache) {
    cacheEntry = await this.createCacheEntry(youtubeId, url, bypassCache);
  }

  // 4. Create user video entry
  const userVideo = await this.createUserVideoEntry(userId, cacheEntry, folderId);

  // 5. Trigger async summarization if needed
  if (cacheEntry.status === 'pending') {
    await this.triggerSummarization(cacheEntry, providers);
  }

  return this.toVideoResponse(userVideo, cacheEntry);
}
```

### Route Registration Pattern (app.ts)

```typescript
// Register routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(videosRoutes, { prefix: '/api/videos' });
await app.register(foldersRoutes, { prefix: '/api/folders' });
// Add: await app.register(playlistsRoutes, { prefix: '/api/playlists' });
```

### Folder Creation Pattern (folder.service.ts)

```typescript
async createFolder(userId: string, name: string, parentId?: string): Promise<Folder> {
  const parent = parentId ? await this.getFolderById(userId, parentId) : null;
  const path = parent ? `${parent.path}/${name}` : `/${name}`;
  const level = parent ? parent.level + 1 : 0;

  const folder = await this.db.collection('folders').insertOne({
    userId: new ObjectId(userId),
    name,
    type: 'summarized',
    parentId: parentId ? new ObjectId(parentId) : null,
    path,
    level,
    order: await this.getNextOrder(userId, parentId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return this.toFolder(folder);
}
```

### yt-dlp Pattern (youtube.py)

```python
async def extract_metadata(video_id: str) -> VideoMetadata:
    """Extract video metadata using yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,  # Get full metadata
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}",
            download=False
        )

    return VideoMetadata(
        id=info['id'],
        title=info['title'],
        channel=info.get('channel'),
        duration=info.get('duration'),
        thumbnail=info.get('thumbnail'),
    )
```

---

## Database Schema Context

### userVideos Collection (Current)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  videoSummaryId: ObjectId,
  youtubeId: string,
  title: string | null,
  channel: string | null,
  duration: number | null,
  thumbnailUrl: string | null,
  status: string,
  folderId: ObjectId | null,
  addedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### userVideos Extension (Proposed)

```javascript
{
  // ... existing fields ...

  // NEW: Optional playlist context
  playlistInfo: {
    playlistId: string,       // "PLsDq_ElIL9Va..."
    playlistTitle: string,    // "React Tutorial Series"
    position: number,         // 0-indexed order
    totalVideos: number       // Total in playlist at import time
  } | null
}
```

### Index to Add

```javascript
// For querying all videos in a playlist
db.userVideos.createIndex(
  { userId: 1, "playlistInfo.playlistId": 1 },
  { sparse: true }  // Only index docs with playlistInfo
)
```

---

## YouTube URL Patterns Reference

### Video URLs
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/embed/dQw4w9WgXcQ
```

### Playlist URLs
```
https://www.youtube.com/playlist?list=PLsDq_ElIL9Vaz
```

### Video in Playlist URLs (Ambiguous)
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLsDq_ElIL9Vaz
https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLsDq_ElIL9Vaz&index=3
```

### Extraction Regex Patterns

```typescript
// Video ID: 11 characters alphanumeric + _ and -
const VIDEO_ID_PATTERN = /[a-zA-Z0-9_-]{11}/;

// Playlist ID: variable length, starts with PL, UU, OL, FL, etc.
const PLAYLIST_ID_PATTERN = /(?:list=)([a-zA-Z0-9_-]+)/;

// Detect playlist page vs video page
const IS_PLAYLIST_PAGE = /youtube\.com\/playlist\?/;
const IS_VIDEO_PAGE = /youtube\.com\/watch\?/;
```

---

## yt-dlp Playlist Extraction Reference

```python
# extract_flat mode for fast metadata-only extraction
ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'extract_flat': 'in_playlist',  # Don't download, just list videos
    'ignoreerrors': True,           # Skip unavailable videos
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(
        f"https://www.youtube.com/playlist?list={playlist_id}",
        download=False
    )

# Result structure:
# info = {
#     'id': 'PLsDq_ElIL9Vaz',
#     'title': 'React Tutorial Series',
#     'channel': 'Traversy Media',
#     'entries': [
#         {'id': 'abc123...', 'title': 'Video 1', 'duration': 600},
#         {'id': 'def456...', 'title': 'Video 2', 'duration': 720},
#         ...
#     ]
# }
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No playlist model | Store in userVideos | Simpler, same video in multiple playlists works |
| Position in userVideos | Not in cache | Position is user-context specific |
| Folder auto-creation | Named from playlist | Better UX, clear organization |
| Mode toggle | Required in UI | Avoids ambiguity with video+playlist URLs |
| Rate limiting | Per-video basis | Prevents abuse during bulk import |
| Max videos | Configurable (default 100) | Balance UX vs server load |

---

## Error Handling Reference

### Custom Errors (api/src/utils/errors.ts)

```typescript
// Existing
export class InvalidYouTubeUrlError extends AppError {}
export class VideoNotFoundError extends AppError {}

// To Add
export class InvalidPlaylistUrlError extends AppError {}
export class PlaylistExtractionError extends AppError {}
export class PlaylistImportError extends AppError {}
export class UrlModeMismatchError extends AppError {}
```

### Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| INVALID_PLAYLIST_URL | URL doesn't contain playlist ID | 400 |
| PLAYLIST_EXTRACTION_FAILED | yt-dlp extraction error | 502 |
| PLAYLIST_NOT_FOUND | Playlist doesn't exist or is private | 404 |
| URL_MODE_MISMATCH | URL type doesn't match selected mode | 400 |
| PLAYLIST_TOO_LARGE | Exceeds max video limit | 400 |

---

## Related Documentation

- [PLAYLIST-FEATURE-PLAN.md](../../../PLAYLIST-FEATURE-PLAN.md) - Original feature spec
- [docs/DATA-MODELS.md](../../../docs/DATA-MODELS.md) - MongoDB schemas
- [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md) - REST API patterns
- [docs/SERVICE-SUMMARIZER.md](../../../docs/SERVICE-SUMMARIZER.md) - Summarizer implementation

---

## Testing Context

### Test Files to Create

```
api/src/utils/__tests__/youtube.test.ts     # URL parsing tests
api/src/services/__tests__/playlist.test.ts # Service tests
apps/web/src/components/playlists/__tests__/ # Component tests
```

### Test Data

```typescript
// Valid playlist URLs
const VALID_PLAYLISTS = [
  'https://www.youtube.com/playlist?list=PLsDq_ElIL9Vaz',
  'https://youtube.com/playlist?list=PLsDq_ElIL9Vaz',
];

// Ambiguous URLs (video + playlist)
const AMBIGUOUS_URLS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLsDq_ElIL9Vaz',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLsDq_ElIL9Vaz&index=3',
];

// Pure video URLs
const VIDEO_ONLY_URLS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
];
```
