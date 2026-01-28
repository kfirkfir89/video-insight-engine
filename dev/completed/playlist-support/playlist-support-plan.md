# YouTube Playlist Support - Implementation Plan

**Last Updated**: 2026-01-28
**Status**: Ready for Implementation
**Effort**: Large (XL) - Estimated 4-5 phases across multiple services

---

## Executive Summary

Add YouTube playlist support to Video Insight Engine, allowing users to import entire playlists into a single folder while preserving the author's video ordering. This feature leverages existing infrastructure (video processing, caching, folders) with minimal new models.

**Key Design Decision**: No separate playlist model. Instead:
1. Extract playlist metadata via yt-dlp (`extract_flat` mode)
2. Auto-create a folder named after the playlist
3. Run existing `VideoService.createVideo()` for each video
4. Store playlist context in `userVideos.playlistInfo` for ordering
5. Existing cache handles deduplication automatically

---

## Current State Analysis

### What We Have
| Component | Current State | Relevant Files |
|-----------|---------------|----------------|
| Video Service | Fully functional with cache, dedup | `api/src/services/video.service.ts` |
| URL Parsing | Only extracts video ID | `api/src/utils/youtube.ts` |
| Folders | Hierarchical with ordering | `api/src/services/folder.service.ts` |
| Summarizer | 5-phase pipeline with yt-dlp | `services/summarizer/src/` |
| Frontend | Single video form | `apps/web/src/components/videos/AddVideoDialog.tsx` |
| Types | Video types defined | `packages/types/src/index.ts` |

### Gaps to Fill
1. **No playlist URL detection** - youtube.ts only extracts video IDs
2. **No mode toggle** - Frontend doesn't distinguish video vs playlist intent
3. **No playlist extraction** - Summarizer lacks playlist metadata endpoint
4. **No playlist context** - userVideos doesn't store position/playlist info
5. **No bulk import flow** - API only handles single videos

---

## Proposed Future State

### Architecture

```
User Input (URL + Mode)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: AddContentDialog with Mode Toggle                │
│  - Single Video mode: existing flow                         │
│  - Playlist mode: preview → import flow                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  API: Playlist Routes (/api/playlists)                      │
│  - POST /preview  → Extract metadata, check cache status    │
│  - POST /import   → Create folder, process all videos       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Summarizer: Playlist Extraction                            │
│  - POST /playlist/extract → yt-dlp extract_flat             │
│  - Returns: id, title, channel, videos[]                    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Database: Extended userVideos                              │
│  - playlistInfo: {playlistId, playlistTitle, position, total}│
│  - New index for playlist queries                           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Preview Flow**:
   - User enters playlist URL in Playlist mode
   - API calls summarizer's `/playlist/extract`
   - Returns: playlist metadata + cache status per video
   - User sees preview card with video list

2. **Import Flow**:
   - User confirms import (optional folder selection)
   - API creates folder (or uses selected)
   - For each video (ordered):
     - Check cache → link existing or trigger new processing
     - Create `userVideos` entry with `playlistInfo`
   - Return summary with counts

---

## Implementation Phases

### Phase 1: URL Parsing Foundation (Effort: S)
**Goal**: Robust YouTube URL parsing for videos AND playlists

**Files to Modify**:
- `api/src/utils/youtube.ts` - Add playlist extraction and URL parsing

**New Functions**:
```typescript
extractPlaylistId(url: string): string | null
parseYouTubeUrl(url: string): { videoId?, playlistId?, isPlaylistPage }
validateUrlForMode(parsed, mode: 'video' | 'playlist'): ValidationResult
```

**Acceptance Criteria**:
- [ ] Extract playlist ID from all URL formats
- [ ] Detect ambiguous URLs (video+playlist)
- [ ] Mode validation returns appropriate errors

---

### Phase 2: Types & Data Model (Effort: S)
**Goal**: Add playlist types and extend userVideos schema

**Files to Modify**:
- `packages/types/src/index.ts` - Add playlist types
- `api/src/plugins/mongodb.ts` - Add index (if applicable)

**New Types**:
```typescript
interface PlaylistInfo {
  playlistId: string;
  playlistTitle: string;
  position: number;       // 0-indexed
  totalVideos: number;
}

interface PlaylistVideo {
  videoId: string;
  title: string;
  position: number;
  duration: number | null;
  isCached: boolean;
}

interface PlaylistPreview {
  playlistId: string;
  title: string;
  channel: string;
  totalVideos: number;
  videos: PlaylistVideo[];
  cachedCount: number;
}

interface PlaylistImportResult {
  folder: { id: string; name: string };
  videos: VideoResponse[];
  cachedCount: number;
  processingCount: number;
}
```

**Database Index**:
```javascript
userVideos.createIndex({ userId: 1, "playlistInfo.playlistId": 1 })
```

---

### Phase 3: Summarizer Playlist Extraction (Effort: M)
**Goal**: Add playlist metadata extraction endpoint to summarizer

**Files to Create**:
- `services/summarizer/src/services/playlist.py` - yt-dlp extraction logic

**Files to Modify**:
- `services/summarizer/src/main.py` - Add `/playlist/extract` endpoint
- `services/summarizer/src/models/schemas.py` - Add Pydantic models

**Implementation**:
```python
# playlist.py
async def extract_playlist_data(playlist_id: str, max_videos: int = 100):
    """Extract playlist metadata using yt-dlp extract_flat mode."""
    # Fast metadata-only extraction (no download)
    # Returns: { id, title, channel, videos: [{ id, title, position, duration }] }
```

**Acceptance Criteria**:
- [ ] Extract playlist with 5 videos in <2 seconds
- [ ] Extract playlist with 50+ videos in <10 seconds
- [ ] Handle private/unavailable playlists gracefully
- [ ] Return proper error codes for failures

---

### Phase 4: Backend API & Service (Effort: L)
**Goal**: Full playlist service and routes in vie-api

**Files to Create**:
- `api/src/services/playlist.service.ts` - Business logic
- `api/src/routes/playlists.routes.ts` - REST endpoints

**Files to Modify**:
- `api/src/services/video.service.ts` - Add `playlistInfo` parameter
- `api/src/app.ts` - Register playlist routes

**Endpoints**:

```typescript
// POST /api/playlists/preview
// Input: { url: string }
// Output: PlaylistPreview

// POST /api/playlists/import
// Input: { url: string, folderId?: string }
// Output: PlaylistImportResult
```

**Service Methods**:
```typescript
class PlaylistService {
  preview(url: string): Promise<PlaylistPreview>
  import(userId: string, url: string, folderId?: string): Promise<PlaylistImportResult>
  getPlaylistVideos(userId: string, playlistId: string): Promise<UserVideo[]>
}
```

**Video Service Changes**:
```typescript
// Extend createVideo signature
createVideo(
  userId: string,
  url: string,
  folderId?: string,
  bypassCache?: boolean,
  providers?: ProviderConfig,
  playlistInfo?: PlaylistInfo  // NEW
): Promise<VideoResponse>
```

**Acceptance Criteria**:
- [ ] Preview returns accurate cache hit counts
- [ ] Import creates folder with playlist name
- [ ] Videos maintain correct ordering via position
- [ ] Cached videos linked instantly (no re-processing)
- [ ] Rate limiting applied per-video basis
- [ ] Partial failure handling (continue if one video fails)

---

### Phase 5: Frontend Implementation (Effort: L)
**Goal**: Mode toggle, preview UI, and import flow

**Files to Create**:
- `apps/web/src/components/playlists/PlaylistPreview.tsx` - Preview card
- `apps/web/src/components/playlists/PlaylistVideoList.tsx` - Video list
- `apps/web/src/api/playlists.ts` - API client
- `apps/web/src/hooks/use-playlists.ts` - React Query hooks

**Files to Modify**:
- `apps/web/src/components/videos/AddVideoDialog.tsx` - Add mode toggle
- `apps/web/src/components/videos/VideoGrid.tsx` - Playlist ordering support

**Components**:

1. **Mode Toggle** (in AddVideoDialog):
   - Two buttons: "Single Video" | "Playlist"
   - Default: Single Video
   - Visual indication of selected mode

2. **Playlist Preview Card**:
   - Thumbnail (first video or playlist image)
   - Title and channel
   - Video count: "23 videos (18 cached)"
   - Scrollable video list with positions
   - Folder selector (auto-named from playlist)
   - Import button

3. **Validation Errors**:
   - Mode mismatch messages
   - Clear guidance on switching modes

**Acceptance Criteria**:
- [ ] Mode toggle visible and functional
- [ ] Preview shows accurate video list with positions
- [ ] Cache status per video clearly indicated
- [ ] Folder auto-creates with playlist name
- [ ] Videos sorted by position in folder view
- [ ] Progress indication during import

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large playlists (100+) timeout | High | Medium | Implement pagination, max_videos limit |
| Rate limit exhaustion during import | High | Medium | Batch processing with delays between videos |
| yt-dlp playlist extraction failure | Medium | Low | Fallback error handling, retry logic |
| Ambiguous URL confusion | Low | High | Clear mode UI, helpful validation messages |
| Position drift on video removal | Low | Low | Store absolute position, not relative |

---

## Success Metrics

1. **Functional**: Can import playlist of 50 videos successfully
2. **Performance**: Preview loads in <3 seconds for any playlist size
3. **Accuracy**: Video positions match YouTube's ordering exactly
4. **UX**: Cache hits result in instant additions (no processing delay)
5. **Reliability**: Partial failures don't abort entire import

---

## Dependencies

### Internal
- Existing video processing pipeline
- Folder service for auto-creation
- Cache system for deduplication

### External
- yt-dlp for playlist extraction
- YouTube API quotas (if any direct API calls)

### Package Additions
None required - yt-dlp already available in summarizer

---

## Testing Strategy

### Unit Tests
- URL parsing: all YouTube URL patterns
- Mode validation: all combinations
- PlaylistInfo serialization

### Integration Tests
- Summarizer `/playlist/extract` endpoint
- API preview and import endpoints
- Video creation with playlistInfo

### E2E Tests
- Full import flow from URL to folder view
- Mode switching behavior
- Cached vs uncached video handling

---

## Open Questions

1. **Max playlist size**: Should we limit to 100 videos? 50?
2. **Rate limiting**: Per-video or per-import rate limits?
3. **Progress tracking**: SSE stream for import progress or polling?
4. **Partial imports**: Allow importing subset of playlist?
5. **Playlist updates**: Re-sync if playlist adds new videos later?

---

## File Summary

### Files to Create (4)
| File | Purpose | Phase |
|------|---------|-------|
| `api/src/routes/playlists.routes.ts` | REST endpoints | 4 |
| `api/src/services/playlist.service.ts` | Business logic | 4 |
| `services/summarizer/src/services/playlist.py` | yt-dlp extraction | 3 |
| `apps/web/src/components/playlists/PlaylistPreview.tsx` | Preview UI | 5 |

### Files to Modify (8)
| File | Changes | Phase |
|------|---------|-------|
| `api/src/utils/youtube.ts` | Add playlist URL parsing | 1 |
| `packages/types/src/index.ts` | Add playlist types | 2 |
| `services/summarizer/src/main.py` | Add `/playlist/extract` endpoint | 3 |
| `services/summarizer/src/models/schemas.py` | Add Pydantic models | 3 |
| `api/src/services/video.service.ts` | Add `playlistInfo` parameter | 4 |
| `api/src/app.ts` | Register playlist routes | 4 |
| `apps/web/src/components/videos/AddVideoDialog.tsx` | Mode toggle + validation | 5 |
| `apps/web/src/components/videos/VideoGrid.tsx` | Playlist ordering | 5 |
