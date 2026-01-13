# Progressive Video Summarization - Implementation Plan

**Last Updated:** 2026-01-12
**Status:** In Progress
**Phase:** 1 of 6

## Goal

Refactor the video summarization pipeline to deliver first content in 1-3 seconds (vs 30-60 seconds), reduce LLM costs by ~35%, and extract richer metadata using yt-dlp.

## Key Changes

1. Replace youtube-transcript-api + oEmbed with single yt-dlp call
2. Use creator's chapters instead of AI-guessing sections
3. Add Haiku model for fast description extraction
4. Parallel processing for Phase 2 tasks
5. Progressive frontend updates as data arrives

## Architecture

```
CURRENT (30-60 sec)                    TARGET (1-3 sec first content)
==================                     ============================
1. oEmbed metadata                     1. yt-dlp extraction (INSTANT)
2. youtube-transcript-api                 → Metadata, chapters, transcript
3. Quick synthesis                        → Stream to frontend immediately
4. Section detection (AI)
5. Section summaries (sequential)      2. PARALLEL (~2-5 sec)
6. Concept extraction                     A. Description analysis (Haiku)
                                          B. TLDR from metadata (Sonnet)
                                          C. First section summary

                                       3. BACKGROUND (stream as ready)
                                          Remaining sections 2-3 at a time
```

## Phases

### Phase 1: yt-dlp Integration
- Create `services/summarizer/src/services/youtube.py`
- Add yt-dlp to requirements.txt
- Update stream.py to use yt-dlp
- New SSE event: `chapters`

### Phase 2: Haiku Description Analyzer
- Create `description_analyzer.py` and prompt
- Add Haiku model config
- New SSE event: `description_analysis`

### Phase 3: Parallel Processing Pipeline
- Refactor stream.py for parallel phases
- Add `generate_metadata_tldr()` method
- New SSE event: `section_ready`

### Phase 4: Database Schema & Fallback
- Add chapters, descriptionAnalysis fields (optional)
- Implement fallback for videos without chapters

### Phase 5: API Updates
- Include new fields in video responses
- Transparent SSE proxy (minimal changes)

### Phase 6: Frontend Progressive UI
- Create ChapterList, ResourcesPanel components
- Handle new SSE events
- Progressive section rendering

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Time to first content | 30-60s | 1-3s |
| Time to TLDR | 15-20s | 2-5s |
| Cost per video | ~$0.09 | ~$0.06 |
| Section accuracy | AI-guessed | Creator-defined |

## Reference

Full detailed plan: `/home/kfir/.claude/plans/splendid-tinkering-bee.md`
