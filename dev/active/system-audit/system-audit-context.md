# VIE System Audit — Context

Last Updated: 2026-03-10

## Key Files

### Pre-Triage (Category Detection)
- `services/summarizer/src/prompts/detection/category_rules.json` — 11 categories, keyword/YouTube-category weighted scoring
- `services/summarizer/src/services/pipeline/triage.py` — Triage service, where mapping layer should go

### Triage & Extraction
- `services/summarizer/src/prompts/triage.txt` — Domain/tab detection prompt (8 domains, 2 modifiers)
- `services/summarizer/src/prompts/base_extraction.txt` — Main extraction prompt
- `services/summarizer/src/prompts/schemas/` — 10 schema files (8 domains + narrative + finance modifiers)
- `services/summarizer/src/services/pipeline/extractor.py` — Extraction service
- `services/summarizer/src/services/pipeline/prompt_builder.py` — Prompt assembly

### Enrichment
- `services/summarizer/src/prompts/enrich_study.txt` — Quiz + flashcard generation (learning domain)
- `services/summarizer/src/prompts/enrich_code.txt` — Cheat sheet generation (tech domain, possibly redundant)
- `services/summarizer/src/services/pipeline/enrichment.py` — Enrichment orchestration

### Synthesis
- `services/summarizer/src/prompts/synthesis.txt` — Generates tldr, keyTakeaways, masterSummary, seoDescription

### Frontend Output System
- `apps/web/src/components/video-detail/OutputRouter.tsx` — Builds VIEResponse from triage + extraction
- `apps/web/src/components/video-detail/output/ComposableOutput.tsx` — Tab routing, domain renderer dispatch
- `apps/web/src/components/video-detail/output/SectionSelector.tsx` — Tab UI (used in showcase only currently)

### Domain Renderers (9)
- `apps/web/src/components/video-detail/output/domain-renderers/LearningRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/TechRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/FitnessRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/FoodRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/MusicRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/TravelRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/ReviewRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/ProjectRenderer.tsx`
- `apps/web/src/components/video-detail/output/domain-renderers/NarrativeRenderer.tsx`

### Enrichment Components (in blocks/, should be in output/enrichment/)
- `apps/web/src/components/video-detail/blocks/FlashCard.tsx` — Used by LearningRenderer
- `apps/web/src/components/video-detail/blocks/ScenarioCard.tsx` — Used by LearningRenderer
- `apps/web/src/components/video-detail/blocks/ScoreRing.tsx` — Used by ReviewRenderer
- `apps/web/src/components/video-detail/blocks/SpotCard.tsx` — Used by TravelRenderer
- `apps/web/src/components/video-detail/blocks/index.ts` — Exports all blocks including these 4

### Types
- `packages/types/src/output-types.ts` — OutputSection (legacy), SynthesisResult
- `packages/types/src/vie-response.ts` — TabDefinition (new), VIEResponse, domain data types

### Pages
- `apps/web/src/pages/VideoDetailPage.tsx` — Main video page, synthesis used here
- `apps/web/src/pages/SharePage.tsx` — Share page, uses tldr as fallback

## Key Decisions

### Category Mapping: Option B (mapping layer)
Rather than renaming categories in category_rules.json (which would break the weighted scoring system
that uses YouTube category names), add a translation layer in triage.py. This keeps the detection
system independent from the domain naming system.

### Schema Fields: Render First, Remove Later
For the ~15 unrendered schema fields, the default action is to ADD rendering in the frontend.
Only remove fields from schemas if they genuinely add no value (e.g., timestamp linking to video
requires a video player integration we don't have yet).

### Enrichment Components: Move to output/enrichment/
These are presentation patterns (flip cards, score rings, spot cards) used by domain renderers,
not ContentBlock types dispatched by ContentBlockRenderer. Moving them clarifies the architecture:
- `blocks/` = ContentBlock types (dispatched via ContentBlockRenderer)
- `output/enrichment/` = Interactive presentation patterns (used directly by domain renderers)

### OutputSection vs TabDefinition: Keep Both (For Now)
OutputSection is used by the legacy IntentResult type. If intent detection code is fully removed,
OutputSection can be deleted. TabDefinition is the active type for the composable system.

### Cross-Domain FlashCard: Defer
Making FlashCard/ScenarioCard available to all domains requires schema + prompt + renderer changes
across the entire pipeline. This is a separate task, not part of this audit fix.

## Dependencies Between Tasks

```
Phase 1.1 (category mapping) → independent
Phase 1.2 (scenario enrichment) → independent
Phase 1.3 (enrich_code eval) → independent

Phase 2.1 (field audit) → BLOCKS Phase 2.2 and 2.3
Phase 2.2 (render fields) → requires 2.1 results
Phase 2.3 (remove fields) → requires 2.1 + 2.2 results

Phase 3.1 (move components) → independent
Phase 3.2 (cleanup OutputSection) → independent
Phase 3.3 (rename activeSection) → independent
Phase 3.4 (synthesis UI) → independent

Phase 4.1 (overview guidance) → independent
Phase 4.2 (tab labels) → independent
Phase 4.3 (cross-domain enrichment) → DEFERRED to separate task
```

## Test Impact

### Backend Tests
- `services/summarizer/tests/test_triage.py` — Add category mapping tests
- `services/summarizer/tests/test_pipeline_integration.py` — Verify enrichment output shape

### Frontend Tests
- Domain renderer tests — Add/update for newly rendered fields
- `apps/web/src/components/video-detail/blocks/__tests__/` — Move with components
- `apps/web/src/components/video-detail/output/__tests__/composable-output.test.tsx` — Update if props renamed

### E2E Tests
- `apps/web/e2e/output-layout.spec.ts` — May need updates for new rendered fields
- `apps/web/e2e/all-domains.spec.ts` — Verify all domains still work after changes
