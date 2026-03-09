# Output Quality Fix — Context

Last Updated: 2026-03-09

## Key Files

### Backend (intent_detector + cached path)
- `services/summarizer/src/services/pipeline/intent_detector.py` — `_TYPE_SECTIONS` dict (lines 20-78), `_build_fallback()`, `detect_intent()`
- `services/summarizer/src/routes/stream.py` — `_stream_cached_structured()` (line 374), emits `intent_detected` at line 384-385
- `services/summarizer/src/models/output_types.py` — `OutputSection`, `IntentResult`, `validate_output()`, per-type Pydantic models

### Extraction Prompts
- `services/summarizer/src/prompts/extract_code.txt` — 51 lines, code_walkthrough
- `services/summarizer/src/prompts/extract_smart.txt` — 46 lines, explanation (default)
- `services/summarizer/src/prompts/extract_recipe.txt` — 59 lines, recipe
- `services/summarizer/src/prompts/extract_trip.txt` — 55 lines, trip_planner
- `services/summarizer/src/prompts/extract_highlights.txt` — 43 lines, highlights
- `services/summarizer/src/prompts/extract_music.txt` — 41 lines, music_guide
- `services/summarizer/src/prompts/extract_verdict.txt` — 45 lines, verdict
- `services/summarizer/src/prompts/extract_study.txt` — 42 lines, study_kit
- `services/summarizer/src/prompts/extract_workout.txt` — 68 lines, workout
- `services/summarizer/src/prompts/extract_project.txt` — 44 lines, project_guide

### Extractor Pipeline
- `services/summarizer/src/services/pipeline/extractor.py` — Adaptive extraction (single/overflow/segmented), loads prompts, injects `{accuracy_rules}`, `{sections}`, `{transcript}`
- `services/summarizer/src/utils/accuracy_rules.py` — Per-type accuracy rules injected into prompts

### Frontend Tab Components
- `apps/web/src/components/video-detail/output/output-views/CodeTabs.tsx` — handles: overview, setup, code, patterns, cheat_sheet
- `apps/web/src/components/video-detail/output/output-views/ExplanationTabs.tsx` — handles: key_points, concepts, takeaways, timestamps
- `apps/web/src/components/video-detail/output/output-views/RecipeTabs.tsx` — handles: overview, ingredients, steps, tips
- `apps/web/src/components/video-detail/output/output-views/TripTabs.tsx` — handles: trip, budget, pack
- `apps/web/src/components/video-detail/output/output-views/HighlightsTabs.tsx` — handles: speakers, highlights, topics
- `apps/web/src/components/video-detail/output/output-views/MusicTabs.tsx` — handles: credits, analysis, structure, lyrics
- `apps/web/src/components/video-detail/output/output-views/VerdictTabs.tsx` — handles: overview, pros_cons, specs, verdict
- `apps/web/src/components/video-detail/output/output-views/ProjectTabs.tsx` — handles: overview, materials, tools, steps, safety
- `apps/web/src/components/video-detail/output/output-views/WorkoutTabs.tsx` — handles: overview, exercises, timer, tips
- `apps/web/src/components/video-detail/output/output-views/StudyTabs.tsx` — handles: overview, concepts, flashcards, quiz

### Tests
- `services/summarizer/tests/test_intent_detector.py` — Line 120 expects 4 sections for code_walkthrough (should be 5)

## Tab ID Mismatch Table (Complete)

| Output Type | intent_detector sends | Frontend handles |
|---|---|---|
| code_walkthrough | overview, code, concepts, takeaways | overview, setup, code, patterns, cheat_sheet |
| trip_planner | overview, itinerary, locations, tips | trip, budget, pack |
| highlights | overview, highlights, quotes, takeaways | speakers, highlights, topics |
| music_guide | overview, analysis, takeaways | credits, analysis, structure, lyrics |
| verdict | overview, pros_cons, ratings, verdict | overview, pros_cons, specs, verdict |
| project_guide | overview, materials, steps, tips | overview, materials, tools, steps, safety |
| workout | overview, exercises, timer | overview, exercises, timer, tips |
| study_kit | overview, concepts, quiz, takeaways | overview, concepts, flashcards, quiz |
| explanation | key_points, concepts, takeaways | key_points, concepts, takeaways, timestamps |
| recipe | overview, ingredients, steps, tips | overview, ingredients, steps, tips ✅ |

## Key Decisions

1. **Frontend is source of truth** for tab IDs — update backend to match
2. **Prompts need rich guidance** — port key insights from deleted persona files (451-line chapter_summary.txt, personas/*.txt, examples/*.txt)
3. **Cached results need runtime fix** — re-apply canonical sections in `_stream_cached_structured`
4. **Prompt template variables**: `{title}`, `{duration_minutes}`, `{sections}`, `{accuracy_rules}`, `{transcript}` — format via `extractor.py:_format_prompt()`

## Dependencies

- No external dependencies — all changes are internal to summarizer service + prompts
- Frontend does NOT need changes (it already has correct switch/case handlers)
- TypeScript types in `packages/types/src/output-types.ts` already match the frontend expectations
