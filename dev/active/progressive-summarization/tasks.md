# Progressive Video Summarization - Tasks

**Last Updated:** 2026-01-12
**Status:** Implementation Complete - Pending E2E Testing

## Phase 1: yt-dlp Integration

- [x] Add yt-dlp to `services/summarizer/requirements.txt`
- [x] Create `services/summarizer/src/services/youtube.py` with `extract_video_data()`
- [x] Configure Webshare proxy in yt-dlp options
- [x] Update `stream.py` Phase 1 to use yt-dlp instead of oEmbed
- [x] Update `stream.py` Phase 2 to use yt-dlp subtitles instead of youtube-transcript-api
- [x] Add `chapters` SSE event after metadata
- [ ] Test with video that has creator chapters
- [ ] Test with video without chapters (verify fallback path)

## Phase 2: Haiku Description Analyzer

- [x] Add `ANTHROPIC_HAIKU_MODEL` to `config.py`
- [x] Create `services/summarizer/src/prompts/description_analysis.txt`
- [x] Create `services/summarizer/src/services/description_analyzer.py`
- [x] Add Haiku client method to `llm.py` (uses existing client)
- [x] Integrate description analysis into `stream.py`
- [x] Add `description_analysis` SSE event
- [ ] Test with rich description (links, resources)
- [ ] Test with empty/minimal description

## Phase 3: Parallel Processing Pipeline

- [x] Create `services/summarizer/src/prompts/metadata_tldr.txt`
- [x] Add `generate_metadata_tldr()` to `llm.py`
- [x] Refactor `stream.py` for parallel Phase 2
- [x] Use `asyncio.as_completed()` for parallel tasks
- [x] Add batched section processing (2-3 at a time)
- [x] Add `section_ready` SSE event with index
- [ ] Test parallel execution timing
- [ ] Test error isolation (one failure doesn't break others)

## Phase 4: Database Schema & Fallback

- [x] Update `mongodb_repository.py` save_result() for new fields
- [x] Add TypeScript interfaces to `packages/types/src/index.ts`
- [ ] Document new fields in `docs/DATA-MODELS.md`
- [x] Implement fallback: AI section detection (existing code path)
- [ ] Test backward compatibility with existing videos

## Phase 5: API Updates

- [x] Update `video.service.ts` to include new fields in responses
- [x] Verify SSE proxy passes new events correctly (transparent proxy)
- [ ] Test cached video responses include new fields

## Phase 6: Frontend Progressive UI

- [x] Add Chapter, DescriptionAnalysis types to StreamState
- [x] Add `chapters` event handler to `use-summary-stream.ts`
- [x] Add `description_analysis` event handler
- [x] Add `section_ready` event handler
- [x] Create `ChapterList.tsx` component
- [x] Create `ResourcesPanel.tsx` component
- [x] Update `VideoDetailLayout.tsx` with new components
- [ ] Test progressive rendering (chapters appear first)
- [ ] Test section status tracking

## Verification (Pending)

- [ ] E2E: Video with creator chapters shows instant chapters
- [ ] E2E: Video without chapters falls back correctly
- [ ] E2E: Resources panel populates for rich descriptions
- [ ] E2E: Time to first content < 3 seconds
- [ ] E2E: Full processing completes without errors

## Files Created/Modified

### Created
- `services/summarizer/src/services/youtube.py` - yt-dlp extraction service
- `services/summarizer/src/services/description_analyzer.py` - Haiku description analysis
- `services/summarizer/src/prompts/description_analysis.txt` - Haiku prompt
- `services/summarizer/src/prompts/metadata_tldr.txt` - Metadata TLDR prompt
- `apps/web/src/components/video-detail/ChapterList.tsx` - Chapter list component
- `apps/web/src/components/video-detail/ResourcesPanel.tsx` - Resources panel component

### Modified
- `services/summarizer/requirements.txt` - Added yt-dlp dependency
- `services/summarizer/src/config.py` - Added Haiku model config
- `services/summarizer/src/routes/stream.py` - Major refactor for progressive architecture
- `services/summarizer/src/services/llm.py` - Added generate_metadata_tldr()
- `services/summarizer/src/repositories/mongodb_repository.py` - Added new fields
- `packages/types/src/index.ts` - Added Chapter, DescriptionAnalysis, SSE event types
- `api/src/services/video.service.ts` - Added new fields to response
- `apps/web/src/hooks/use-summary-stream.ts` - Added new event handlers
- `apps/web/src/components/video-detail/VideoDetailLayout.tsx` - Integrated new components
- `apps/web/src/components/video-detail/index.ts` - Added exports
- `apps/web/src/pages/VideoDetailPage.tsx` - Pass new streaming state props
