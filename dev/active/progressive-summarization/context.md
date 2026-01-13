# Progressive Video Summarization - Context

**Last Updated:** 2026-01-12

## Key Files to Modify

### Summarizer Service (`services/summarizer/`)

| File | Purpose | Phase |
|------|---------|-------|
| `requirements.txt` | Add yt-dlp dependency | 1 |
| `src/services/youtube.py` | NEW - yt-dlp extraction | 1 |
| `src/routes/stream.py` | Main SSE streaming (major refactor) | 1, 3 |
| `src/config.py` | Add Haiku model config | 2 |
| `src/services/description_analyzer.py` | NEW - Haiku service | 2 |
| `src/prompts/description_analysis.txt` | NEW - Haiku prompt | 2 |
| `src/services/llm.py` | Add Haiku + metadata TLDR | 2, 3 |
| `src/prompts/metadata_tldr.txt` | NEW - Metadata-only TLDR prompt | 3 |
| `src/repositories/mongodb_repository.py` | Update save_result() | 4 |

### API Service (`api/`)

| File | Purpose | Phase |
|------|---------|-------|
| `src/services/video.service.ts` | Include new fields in responses | 5 |

### Frontend (`apps/web/`)

| File | Purpose | Phase |
|------|---------|-------|
| `src/hooks/use-summary-stream.ts` | Handle new SSE events | 6 |
| `src/pages/VideoDetailPage.tsx` | Progressive rendering | 6 |
| `src/components/video-detail/ChapterList.tsx` | NEW - Display chapters | 6 |
| `src/components/video-detail/ResourcesPanel.tsx` | NEW - Links/resources | 6 |
| `src/components/video-detail/VideoDetailLayout.tsx` | Add new components | 6 |

### Shared Types (`packages/types/`)

| File | Purpose | Phase |
|------|---------|-------|
| `src/index.ts` | Add Chapter, DescriptionAnalysis interfaces | 4 |

## Key Decisions

1. **yt-dlp over youtube-transcript-api**: Single call gets everything (chapters, description, transcript)
2. **Haiku for extraction**: Cheaper/faster for structured extraction tasks
3. **Sonnet for synthesis**: Needed for TLDR and section summaries
4. **Creator chapters first**: Only fall back to AI detection when needed
5. **All new fields optional**: Backward compatible with existing videos

## Existing Infrastructure

- **Webshare proxy**: Already configured in `config.py` (WEBSHARE_PROXY_USERNAME, WEBSHARE_PROXY_PASSWORD)
- **SSE streaming**: Already implemented in `stream.py`
- **Anthropic client**: Already set up in `llm.py`

## SSE Event Flow (Target)

```
1. metadata       → title, channel, thumbnail, duration (instant)
2. chapters       → creator chapters from yt-dlp (instant)
3. description_analysis → links, resources (Haiku, ~1-2 sec)
4. synthesis_complete → TLDR, keyTakeaways (Sonnet, ~2-3 sec)
5. section_ready  → each section as it completes (progressive)
6. concepts_complete → extracted concepts
7. done           → processing complete
```

## Testing Videos

- **With chapters**: Find a YouTube tutorial with creator chapters
- **Without chapters**: Standard video without chapters
- **Rich description**: Video with links, timestamps in description

## Dependencies

- `yt-dlp>=2024.1.0` - Video data extraction
- `claude-3-5-haiku-20241022` - Fast extraction model
- `claude-sonnet-4-20250514` - Existing analysis model
