# Service: vie-summarizer

Python service that processes YouTube videos into structured summaries.

**Type:** HTTP service (FastAPI + BackgroundTasks)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Web framework + SSE streaming |
| youtube-transcript-api | Fetch transcripts |
| yt-dlp | Video metadata + chapters |
| LiteLLM | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| pymongo | MongoDB driver |
| aioboto3 | Async S3 client (transcripts + frame storage) |
| Pydantic | Validation & Settings |
| google-genai | Gemini native SDK (audio transcription) |
| structlog | Structured logging |

---

## Project Structure

```
services/summarizer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── main.py                   # FastAPI app + routes
    ├── config.py                 # Settings + model mapping
    ├── dependencies.py           # DI providers
    ├── exceptions.py             # Custom exceptions
    ├── logging_config.py         # structlog configuration
    ├── middleware.py             # Request ID middleware
    │
    ├── routes/
    │   ├── stream.py             # SSE streaming endpoint
    │   └── override.py           # Detection override endpoint
    │
    ├── services/
    │   ├── llm.py                # LLMService (call_llm + call_llm_fast)
    │   ├── llm_provider.py       # LiteLLM multi-provider abstraction
    │   ├── usage_tracker.py      # LLM usage tracking
    │   ├── override_state.py     # In-memory override state
    │   ├── status_callback.py    # Status callback
    │   │
    │   ├── pipeline/             # Plan-based summarization pipeline
    │   │   ├── classifier.py         # LLM domain+format+traits classifier (fast model, concurrent)
    │   │   ├── plan.py               # Plan stage → merged manifest+triage in single Sonnet call
    │   │   ├── triage.py             # Triage validation/fallback (TriageResult model + tab validation)
    │   │   ├── prompt_builder.py     # Schema-injection prompt builder + video_context
    │   │   ├── extractor.py          # Adaptive extraction (single/overflow/chunked) + prompt caching
    │   │   ├── extraction_quality.py # Extraction quality check + synthesis-fed retry
    │   │   ├── extraction_merger.py  # Per-domain merge + dedup for chunked extraction
    │   │   ├── enrichment.py         # Quiz/flashcards (all domains via enrichment map)
    │   │   ├── synthesis.py          # TLDR, takeaways (Sonnet, hierarchical for long)
    │   │   ├── assembly.py           # Assembly stage (extraction → component props)
    │   │   ├── post_processor.py     # Tab cleanup, celebrations, count validation
    │   │   └── pipeline_helpers.py   # SSE events, timer, data classes
    │   │
    │   ├── transcription/        # Transcript fetching & storage
    │   │   ├── transcript.py         # Transcript cleaning & formatting
    │   │   ├── transcript_fetcher.py # Multi-source fallback chain
    │   │   ├── transcript_chunker.py # Chapter-aware transcript splitting
    │   │   ├── transcript_store.py   # S3 transcript persistence
    │   │   ├── gemini_transcriber.py # Gemini Flash transcription
    │   │   └── whisper_transcriber.py # Whisper fallback
    │   │
    │   ├── media/                # Frame extraction, vision & S3 storage
    │   │   ├── scene_extractor.py    # Scene keyframe extraction (yt-dlp + FFmpeg) + smart selection
    │   │   ├── frame_scorer.py       # Frame scoring (visual, face, text, uniqueness) + selection
    │   │   ├── frame_analyzer.py     # Vision LLM analysis of top frames (scene type, content)
    │   │   ├── frame_ocr.py          # OCR on text-heavy frames (Tesseract)
    │   │   ├── frame_extractor.py    # Video frame extraction + S3 upload
    │   │   ├── image_dedup.py        # Perceptual hashing for dedup
    │   │   ├── s3_client.py          # Async S3 client
    │   │   ├── stream_url.py         # Stream URL resolution
    │   │   └── download_utils.py     # Download helpers
    │   │
    │   └── video/                # YouTube & metadata
    │       ├── youtube.py            # Video metadata (yt-dlp)
    │       ├── sponsorblock.py       # Sponsor segment detection
    │       ├── description_analyzer.py # Description analysis
    │       └── playlist.py           # Playlist extraction (yt-dlp)
    │
    ├── repositories/
    │   ├── base.py               # Repository protocols
    │   └── mongodb_repository.py # MongoDB implementation
    │
    ├── prompts/
    │   ├── plan.txt              # Plan prompt → merged manifest+triage (identity, tabs, extraction guidance)
    │   ├── triage.txt            # Triage prompt (fallback only, injects component_toolkit.txt)
    │   ├── component_toolkit.txt # Component descriptions + datasource paths (injected into plan/triage)
    │   ├── base_extraction.txt   # Schema-injection extraction template + video_context + prompt caching
    │   ├── classify.txt          # Domain+format classifier prompt (fast model, 10 domains + 17 formats)
    │   ├── chapter_detect.txt    # AI chapter detection prompt (fast model)
    │   ├── quality_rules.txt     # JSON extraction quality rules
    │   ├── enrich/               # Per-domain enrichment prompts (+ video_context + tab_goals)
    │   ├── synthesis.txt         # Synthesis prompt (+ video_context + tone matching)
    │   └── schemas/              # Domain schemas (injected into base_extraction)
    │       ├── learning.txt
    │       ├── tech.txt
    │       ├── fitness.txt
    │       ├── food.txt
    │       ├── music.txt
    │       ├── travel.txt
    │       ├── review.txt
    │       ├── project.txt
    │       ├── language.txt
    │       ├── science.txt
    │       ├── narrative.txt     # Modifier
    │       └── finance.txt       # Modifier
    │
    ├── utils/
    │   ├── json_parsing.py       # Robust JSON recovery
    │   ├── llm_retry.py          # LLM call with timeout + retry + backoff
    │   ├── worker_pool.py        # ProcessPoolExecutor for CPU-bound tasks
    │   ├── content_extractor.py  # Summary/bullet extraction
    │   ├── transcript_slicer.py  # Time-range transcript slicing
    │   ├── language_utils.py     # Language detection, RTL check, language instructions
    │   └── constants.py          # Constants
    │
    ├── shared_config/
    │   ├── __init__.py
    │   └── domain_config.py      # Reads domains.json (Docker mount or local fallback)
    │
    └── models/
        ├── schemas.py            # Pydantic models
        ├── domain_types.py       # Domain data models (Food, Travel, Music, etc.)
        ├── pipeline_types.py     # Pipeline models (PlanResult, ManifestResult, TriageResult, etc.)
        └── vie_response_v2.py    # VIEResponse v2 models (TabEntry, CrossTabLink, etc.)
```

---

## Environment Variables

```bash
# Database
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine

# LLM Provider Configuration
LLM_PROVIDER=anthropic          # anthropic, openai, or gemini
LLM_FAST_PROVIDER=              # Optional: separate provider for fast model
LLM_FALLBACK_PROVIDER=          # Optional: fallback if primary fails
LLM_MODEL=                      # Optional: override default model
LLM_FAST_MODEL=                 # Optional: override fast model
LLM_MAX_TOKENS=4096
LLM_FAST_MAX_TOKENS=2048

# Provider API Keys (set for providers you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=                 # Required if using OpenAI or Whisper
GEMINI_API_KEY=                 # Enables Gemini audio transcription (faster than Whisper)
GOOGLE_API_KEY=                 # Required if using Gemini as LLM provider

# S3 Media Storage (transcripts, frames, audio)
S3_BUCKET=vie-transcripts
S3_PRESIGNED_URL_EXPIRY=3600    # Presigned URL validity (seconds)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key      # AWS credentials
AWS_SECRET_ACCESS_KEY=your-secret
PROMPT_VERSION=v1.0             # For generation tracking

# Vector store / RAG indexing
QDRANT_HOST=vie-qdrant
QDRANT_PORT=6333
QDRANT_ENABLED=true
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2  # Drop-in alternatives must keep VECTOR_SIZE=384 (e.g. BAAI/bge-small-en-v1.5)

LOG_LEVEL=INFO
LOG_FORMAT=console              # console or json
```

---

## Vector Store Indexing (transcript + output)

After every successful pipeline run, two background tasks index the video's
content into Qdrant for the assistant to retrieve:

| Task | Source field | Phase | Content |
|---|---|---|---|
| `store_transcript_chunks` | `source="transcript"` | assembly | `chunk_transcript()` output (English text; original-language text retained in `text_original` for non-English videos) |
| `store_default_output_chunks` | `source="default_output"` | assembly (English videos) / translation (non-English videos) | Per-component chunking of the assembled tabs via `output_chunker.py` — emits one chunk per natural retrieval unit (one `keyTakeaways[i]`, one quiz question, one comparison row, etc.) |

For non-English videos, output indexing is deferred to the translation phase
so it embeds the promoted English `ctx.assembled_tabs` instead of
source-language strings — the embedding model is English-trained, and
embedding source-language tabs on it produces poor retrieval quality.

Both paths pre-delete by `(video_id, source)` before upsert (and pre-delete
runs *before* chunking, so a chunker exception still cleans up prior runs'
orphans). Output chunks from all tabs upsert in a **single batched call**
with per-chunk `tab_id` / `tab_component` metadata, instead of one
round-trip per tab. Keys are deterministic:
`sha256(f"{source}:{video_id}:{tab_id or ''}:{prop_path or ''}:{chunk_idx}")`,
with the legacy `f"{video_id}_{idx}"` format preserved for transcript-only
points (so existing pre-migration points remain addressable).

### Output chunker rules

`output_chunker.py` registers an explicit handler per component. Components
not in the registry emit zero chunks (silent fallbacks would index button
labels and IDs as embeddings, polluting retrieval). Cross-cutting rules:

- Drop chunks under 6 whitespace-separated tokens (low signal)
- Never embed code, numbers, timestamps, URLs, enum flags, raw JSON
- For the catch-all `display_section`, only flatten string values whose key
  appears in the whitelist: `text`, `description`, `summary`, `explanation`,
  `content`, `analysis`, `caption`, `label`, `instruction`, `tip`, `note`

Adding a new component to `assemblers.py` requires adding a row to
`_COMPONENT_HANDLERS` in `output_chunker.py` before that component's content
will be retrievable.

---

## Processing Pipeline (Plan-Driven)

The pipeline uses 3-6 LLM calls with a plan-first architecture:

```
 1. CONNECT via SSE
    └─▶ GET /summarize/stream/{videoSummaryId}
    └─▶ If cached: stream structured result immediately
    └─▶ If pending: start processing pipeline

 2. FETCH METADATA (yt-dlp) + DESCRIPTION ANALYSIS
    └─▶ Title, channel, thumbnail, duration, chapters
    └─▶ Category pre-detection from metadata
    └─▶ Description analysis: extract links, resources, social links
    └─▶ SSE: metadata event, description_analysis event

 3. TRANSCRIPT + FRAMES (parallel via asyncio.Queue)
    ┌─▶ TRANSCRIPT (Multi-Source Fallback Chain)
    │   └─▶ 0. S3 cached transcript (avoids all YouTube calls)
    │   └─▶ 1. yt-dlp subtitles (embedded in video metadata)
    │   └─▶ 2. youtube-transcript-api (with rate limit retry)
    │   └─▶ 3. Gemini Flash (audio transcription, ~30-90s, ~$0.04/26min)
    │   └─▶ 4. OpenAI Whisper (audio fallback, ~5-15min, ~$0.16/26min)
    │   └─▶ SSE: transcript_ready event
    │
    └─▶ FRAMES (smart frame selection, non-critical)
        └─▶ S3 cache check: skip extraction if frames already exist for this video
        └─▶ Per-video asyncio.Lock prevents duplicate concurrent extractions
        └─▶ yt-dlp downloads worst-quality video to temp file (~15-20s)
        └─▶ FFmpeg scene detection on local file (~10-15s, 20-50x realtime)
        └─▶ Smart scoring (CPU only, ~2-3s): visual interest, face detection, text density, uniqueness
        └─▶ Time-slot selection: ~25 frames evenly distributed across video duration
        └─▶ Gallery classification: top ~12 frames by score for Visual Moments tab
        └─▶ Batch parallel S3 upload (8 concurrent, only selected frames — not all detected)
        └─▶ OCR + Vision LLM analysis run in parallel:
            ├─▶ OCR: Tesseract on text-heavy frames
            └─▶ Vision: top 8 frames → Sonnet (scene_type, content, text_visible) ~$0.02-0.03
        └─▶ SSE: frames event (selected frames only — timestamps, presigned URLs, OCR text)
        └─▶ Graceful degradation: failure returns empty result, pipeline continues

 3.5 VISUAL CONTEXT INJECTION (after both parallel phases complete)
    └─▶ Injects [VISUAL at M:SS] annotations from vision LLM into transcript at correct positions
    └─▶ Injects [ON-SCREEN TEXT at M:SS] annotations from OCR for non-vision frames
    └─▶ Uses segment timestamps for precise positioning (fallback: character estimation)
    └─▶ Filters talking_head frames with no educational value
    └─▶ Deduplicates: vision frames don't also get OCR annotations
    └─▶ Toggle: FRAME_VISION_ENABLED=false skips vision (OCR-only like before)

 4. CLASSIFIER + PLAN (1-2 LLM calls)
    └─▶ Classifier (fast model): domain + format + traits classification (10 domains, 17 formats)
    │   └─▶ 10s timeout, 1 retry, ~$0.001 per video, json_mode
    │   └─▶ Overrides rule-based category_hint when confidence > 0.6
    │   └─▶ Sets content_format on PipelineContext (tutorial, commentary, reaction, etc.)
    │   └─▶ ContentTraits: 8 booleans (has_steps, has_drills, has_comparison, has_narrative,
    │   │   has_code, has_visual_demo, is_opinionated, is_list) — drives component routing in Plan
    │   └─▶ Skipped when admin override is active
    └─▶ Plan (Sonnet, 30s timeout, 2 retries, json_mode + prompt caching)
        └─▶ Single call replaces old Manifest + Triage (2 calls → 1, saves ~30-50s)
        └─▶ Analyzes: creator identity, core promise, unique angle, extraction guidance
        └─▶ Designs: contentTags, modifiers, tab layout with component toolkit
        └─▶ Item counts for extraction quality validation
        └─▶ video_context flows to all downstream phases (compact ~300 chars)
        └─▶ 10 primary tags: learning, tech, fitness, food, music, travel, review, project, language, science
        └─▶ 2 modifier tags: narrative, finance
        └─▶ Fallback: category-based mapping if confidence < 0.6
        └─▶ SSE: triage_complete, meta events

 5. ADAPTIVE EXTRACTION (1-5+ LLM calls, json_mode + prompt caching)
    └─▶ Schema-injected: base_extraction.txt + schemas/{tag}.txt per content tag
    └─▶ Prompt caching: static template (schemas/rules/instructions) cached, transcript dynamic
    └─▶ SHORT (<30 min):
    │   └─▶ <5.3K words: single extraction call
    │   └─▶ 5.3K+ words: overflow extraction (single call, dynamic timeout)
    └─▶ LONG (>30 min, with chapters):
    │   └─▶ Chapter splitting: YouTube chapters → AI detect → time-split → single fallback
    │   └─▶ Batch chapters by 50K token limit
    │   └─▶ Parallel extraction per batch (max 3 concurrent, asyncio.Semaphore)
    │   └─▶ Fast model for multi-batch, default model for single batch
    │   └─▶ Per-domain merge: dedup lists, re-number ordered items, keep richest scalars
    └─▶ Pydantic validation on all output
    └─▶ Post-extraction: count validation against plan (advisory, logs warnings)
    └─▶ SSE: extraction_progress events, then extraction_complete

 5b. EXTRACTION QUALITY CHECK (0-1 additional LLM calls)
    └─▶ Scores extraction coverage: populated tabs vs plan tabs (score 0.0-1.0)
    └─▶ Skips tabs with meta/synthesis/enrichment dataSources
    └─▶ If score < 0.6: synthesis-fed retry — runs synthesis early, builds retry prompt with evidence
    └─▶ Re-extracts and keeps the better result (higher populated count)
    └─▶ Max 1 retry, cost: ~$0.05-0.15 extra for ~10-30% of videos
    └─▶ Exception-safe: retry failure uses original extraction

 6b. EXTRACTION COUNT VALIDATION (advisory, no LLM calls)
    └─▶ Compare plan item counts vs extraction output (60% threshold)
    └─▶ Logs warnings only — does not retry
    └─▶ Exception-safe: validation failure is non-blocking

 7. ENRICHMENT (0-1 LLM calls, 45s timeout, 2 retries)
    └─▶ All domains with enrichment mapping get quiz + flashcards + scenarios
    └─▶ Domain gate via domains.json enrichment map (dynamic, not hardcoded)
    └─▶ Non-critical: failure returns None gracefully
    └─▶ SSE: enrichment_complete event (if applicable)

 8. SYNTHESIS (1 LLM call, Sonnet, 30s timeout, 2 retries)
    └─▶ TLDR, takeaways, master summary
    └─▶ Hierarchical mode for long videos (>5 chapters): chapter summaries + truncated extraction (6K chars)
    └─▶ Exception-safe: failure emits empty synthesis_complete
    └─▶ SSE: synthesis_complete event

 9. ASSEMBLY + SAVE + COMPLETE
    └─▶ Assembly: pure code (<10ms) — transforms extraction → component-addressed TabEntry[]
    └─▶ 17 assemblers in ASSEMBLER_REGISTRY (spot_explorer, moment_track, code_explorer, etc.)
    └─▶ Frame thumbnail injection: items with timestamps get thumbnailUrl from nearest S3 frame
    └─▶ Gallery tab: ~12 curated frames from gallery_frames (not all uploaded frames)
    └─▶ Cross-tab links resolved from static LINK_RULES
    └─▶ SSE: tab_ready events (progressive rendering)
    └─▶ Store result to MongoDB + Redis cache (if enabled)
    └─▶ Transcript S3 storage (background, non-blocking)
    └─▶ Qdrant chunks (if enabled): transcript embeddings (background task)
    └─▶ SSE: complete event (tabCount, processingTimeMs)
    └─▶ SSE: done event + [DONE] signal

10. TRANSLATION (non-English videos only, ~5-15s)
    └─▶ Triggered when ctx.language != "en" (detected from transcript)
    └─▶ translate_to_source() — single flat-list LLM call
    │   └─▶ Walks the assembled tree, collects every translatable prose
    │   │   string into one flat list (`_collect_strings` + `_SKIP_KEYS`
    │   │   leaf-only deny-list for structural/asset/enum keys)
    │   └─▶ One Haiku call via src/prompts/translate_flat.txt (replaces
    │   │   the deleted src/prompts/translate.txt; flat-list contract
    │   │   means the model returns a list of equal length, applied
    │   │   back into a deep copy via `_set_at_path`)
    │   └─▶ Mirror detection: rejects output if all 3 longest strings are
    │       byte-identical AND >50% of all strings are byte-identical
    │       (small-payload threshold: 33% over fewer than 10 strings).
    │       Protects against the "small model echoes input" failure mode.
    │   └─▶ `_SKIP_KEYS` denies: id, component, language, url, s3Key, code,
    │       timestamp, time, seconds, startSeconds, endSeconds, emoji,
    │       correctIndex, difficulty, mood, sets, frameCaption,
    │       frameSceneType, frameEvidence. Notably does NOT deny
    │       reps/rest/duration — the fitness schema emits prose at
    │       those keys ("30 שניות", "AMRAP", "until failure").
    └─▶ Promote English to primary on ctx.assembled_tabs / ctx.assembled_meta
    │   and stash the original-language artifact under sourceLanguage
    │   = {code, name, isRTL, tabs, meta} (tabs/meta deep-copied so a
    │   downstream mutation of ctx.assembled_tabs can't corrupt the
    │   persisted source block).
    └─▶ Whisper translate (audio → English text) feeds the Qdrant
    │   embedding path so RAG search works cross-language.
    └─▶ Owns the Redis response-cache write for non-English videos:
    │   assembly phase intentionally SKIPS the cache write when
    │   ctx.language != "en". Translation then writes the final
    │   English-primary payload (including the sourceLanguage block)
    │   to Redis. Without this split, source-language tabs would
    │   freeze into Redis for the full TTL and silently break the
    │   FE language toggle on every cache hit.
    └─▶ language_instruction injected into upstream LLM phases (plan,
    │   extraction, synthesis, enrichment) — produces source-language
    │   output that this phase then translates.
    └─▶ Non-blocking: any failure (LLM error, mirror, length mismatch)
        returns the input unchanged with no sourceLanguage key — the FE
        simply renders no language toggle.
```

---

## Key Implementations

### LLM Service (Thin Wrapper)

```python
# src/services/llm.py
class LLMService:
    """Thin wrapper around LLMProvider. Pipeline modules use call_llm_with_retry()."""

    def __init__(self, provider: LLMProvider):
        self._provider = provider

    async def call_llm(self, prompt: str, max_tokens: int = 2000, timeout: float | None = None) -> str:
        effective_timeout = timeout or settings.LLM_TIMEOUT_SECONDS
        async with asyncio.timeout(effective_timeout):
            return await self._provider.complete(prompt, max_tokens=max_tokens, timeout=effective_timeout)
```

### LLM Retry Utility

```python
# src/utils/llm_retry.py — All pipeline stages use this instead of calling llm_service directly
async def call_llm_with_retry(
    llm_service, prompt, *, max_tokens=4096, timeout=60.0, max_retries=2, stage_name="unknown"
) -> str | None:
    """Timeout + retry + exponential backoff. Returns raw string or None (never raises)."""

# Stage-specific configurations:
# Plan:        timeout=30s,  retries=2  (Sonnet, replaces old Manifest + Triage)
# Extraction:  timeout=120s, retries=1  (dynamic timeout for overflow)
# Enrichment:  timeout=45s,  retries=2
# Synthesis:   timeout=30s,  retries=2
```

### Pipeline Modules

```python
# All pipeline modules follow the same pattern:
# - Accept llm_service, repository, and domain-specific args
# - Call call_llm_with_retry() for LLM interactions (not llm_service directly)
# - Return typed results (Pydantic models or dicts)

# src/services/pipeline/plan.py
async def run_plan(llm_service, transcript, video_data, ...) -> PlanResult | None
# Single Sonnet call replaces old Manifest + Triage (2 calls → 1)

# src/services/pipeline/triage.py (fallback/validation only)
# TriageResult model + tab validation when plan confidence < 0.6

# src/services/pipeline/extractor.py
async def extract(llm_service, transcript, triage, ...) -> AsyncGenerator[dict, None]

# src/services/pipeline/enrichment.py
async def enrich(llm_service, content_tag, extraction_data, ...) -> EnrichmentData | None

# src/services/pipeline/synthesis.py
async def synthesize(llm_service, extraction_text, video_title, ...) -> SynthesisResult

# src/services/pipeline/post_processor.py
def validate_extraction_counts(manifest: ManifestResult, extraction: dict) -> list[str]
```

**Model mapping (config.py):**
```python
MODEL_MAP = {
    "anthropic": {"default": "anthropic/claude-sonnet-4-6", "fast": "anthropic/claude-haiku-4-5-20251001"},
    "openai": {"default": "openai/gpt-4o", "fast": "openai/gpt-4o-mini"},
    "gemini": {"default": "gemini/gemini-2.5-flash", "fast": "gemini/gemini-2.5-flash-lite"},
}
```

---

## Content Tag System

The pipeline uses triage (LLM) to determine content tags from manifest + metadata. Each tag has a domain schema injected into a shared extraction template.

### 10 Primary Content Tags + 2 Modifiers

| ContentTag | Category Fallback | Domain Schema | Enrichment |
|------------|-------------------|---------------|------------|
| learning | education (default) | `schemas/learning.txt` | quiz, flashcards, scenarios |
| tech | coding, programming | `schemas/tech.txt` | quiz, flashcards, scenarios |
| fitness | fitness | `schemas/fitness.txt` | - |
| food | cooking | `schemas/food.txt` | - |
| music | music | `schemas/music.txt` | - |
| travel | travel | `schemas/travel.txt` | - |
| review | reviews | `schemas/review.txt` | - |
| project | diy, craft | `schemas/project.txt` | - |
| language | — | `schemas/language.txt` | - |
| science | — | `schemas/science.txt` | - |
| narrative | podcast, interview | `schemas/narrative.txt` | Modifier only |
| finance | — | `schemas/finance.txt` | Modifier only |

### SSE Event Protocol

| Event | Data |
|-------|------|
| `cached` | `{videoSummaryId}` (only for cached results) |
| `metadata` | `{title, channel, thumbnailUrl, duration}` |
| `transcript_ready` | `{duration}` |
| `sponsor_segments` | `{count, filteredDuration}` (SponsorBlock integration) |
| `description_analysis` | `{links, resources, socialLinks}` (concurrent with manifest) |
| `triage_complete` | `{contentTags, modifiers, primaryTag, tabs, confidence}` |
| `extraction_progress` | `{section, percent, batch?, of?}` — chunked path emits `batch`/`of` per batch with `section="chunked"`; rate-limited fallback batches use `section="chunked-sequential"` |
| `extraction_complete` | `{domain-keyed data}` |
| `enrichment_complete` | `{quiz?, flashcards?, scenarios?}` (learning and tech domains only) |
| `synthesis_complete` | `{tldr, keyTakeaways, masterSummary, seoDescription}` |
| `frames` | `{frames: [{index, timestamp, url, s3Key?, ocrText?}]}` (scene frames) |
| `meta` | `{VIEResponseMeta}` (assembled meta) |
| `tab_ready` | `{id, label, emoji, component, props, crossTabLinks?}` (progressive tab) |
| `complete` | `{tabCount, processingTimeMs}` (v2 completion) |
| `done` | `{videoSummaryId, cached?, phase: "done"}` (legacy + confetti trigger) |
| `[DONE]` | Terminal signal |

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Triage-first | LLM picks tags + designs tabs | More flexible than fixed output types |
| Schema injection | `base_extraction.txt` + `schemas/{tag}.txt` | One extraction prompt, domain schemas swapped in |
| Plan stage | Single Sonnet call replaces Manifest + Triage | 2 calls → 1, saves ~30-50s, better coherence |
| Plan fallback | Falls back to category-based mapping if confidence < 0.6 | Safety net when LLM plan fails or is low-confidence |
| Count validation advisory | Logs warnings at 60% threshold | Never blocks pipeline, just flags missing items |
| Legacy coercion | `field_validator(mode="before")` | Accepts old string format for travel tips and music analysis |
| Finance modifier costs-only | `costs[]` + `savingTips[]`, no budget | Primary domain owns budget structure |
| Adaptive extraction | 1-3 calls by word count | Prevents token overflow on long videos |
| Category fallback | Map video category to content tag | Safety net when triage confidence < 0.6 |
| Shared domain config | `@vie/shared` `domains.json` via Docker mount | Single source of truth for domains, tabs, gradients, categories across TS + Python |

---

## Output Schema

The pipeline stores results in two formats for backward compatibility:

### v2 Schema (current — component-addressed tabs)

```python
# MongoDB document structure (after pipeline completes):
{
    # v1 fields (still written for backward compat)
    "triage": {
        "contentTags": ["learning"],       # 1-2 primary content tags
        "modifiers": [],                    # 0-2 modifier tags (narrative, finance)
        "primaryTag": "learning",           # First content tag
        "tabs": [                           # LLM-designed tab layout
            {"id": "key_points", "label": "Key Points", "emoji": "💡", "dataSource": "learning.keyPoints"},
            {"id": "concepts", "label": "Core Concepts", "emoji": "🧠", "dataSource": "learning.concepts"}
        ],
        "confidence": 0.95
    },
    "output": { ... },                      # Domain-keyed extraction data
    "enrichment": { ... },                  # Quiz, flashcards, scenarios (all enrichment-mapped domains)
    "synthesis": {
        "tldr": "...",
        "keyTakeaways": ["..."],
        "masterSummary": "...",
        "seoDescription": "..."
    },

    # v2 fields (assembly stage output — used by frontend)
    "assembledMeta": {
        "videoId": "...",
        "videoTitle": "...",
        "creator": "...",
        "contentTags": ["learning"],
        "modifiers": [],
        "primaryTag": "learning",
        "userGoal": "...",
        "tldr": "...",
        "keyTakeaways": [...],
        "masterSummary": "...",
        "seoDescription": "..."
    },
    "assembledTabs": [                      # Component-addressed tabs
        {
            "id": "key_points",
            "label": "Key Points",
            "emoji": "💡",
            "component": "key_points",      # Maps to COMPONENT_REGISTRY on frontend
            "props": {                      # Pre-resolved props for the component
                "items": [...]
            },
            "crossTabLinks": [
                {"targetTab": "concepts", "label": "Related Concepts"}
            ]
        }
    ]
}
```

### Frontend Meta Resolution

The API builds a clean response using `meta-builder.ts`:
1. New shape: `doc.meta` (has `contentTags` directly)
2. Legacy v2: `doc.assembledMeta` + `doc.synthesis`
3. Oldest: `doc.triage` + `doc.synthesis`

### Security: Field Allowlist

`save_structured_result()` in `mongodb_repository.py` uses a field allowlist (`_ALLOWED_RESULT_KEYS`) to prevent arbitrary field injection into MongoDB documents.

See `src/models/domain_types.py` for domain data models, `src/models/pipeline_types.py` for pipeline types, and `src/models/vie_response_v2.py` for assembly output models.

---

## Transcript Fallback Chain

The summarizer uses a multi-source fallback chain to maximize transcript availability:

```
┌─────────────────────────────────────────────────────────┐
│                  TRANSCRIPT SOURCES                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  0. S3 Cached Transcript                               │
│     └─▶ Avoids all YouTube calls                       │
│     └─▶ Source: "s3" (cached-{original_source})        │
│                         │                               │
│                         ▼                               │
│  1. yt-dlp Subtitles                                   │
│     └─▶ Extracted during video metadata fetch           │
│     └─▶ Source: "ytdlp"                                │
│                         │                               │
│                         ▼                               │
│  2. youtube-transcript-api                             │
│     └─▶ With rate limit retry (tenacity)               │
│     └─▶ 3 attempts, exponential backoff (4-30s)        │
│     └─▶ Source: "api" or "proxy"                       │
│                         │                               │
│                         ▼                               │
│  3. Gemini Flash (if GEMINI_API_KEY set)               │
│     └─▶ Download raw audio via yt-dlp (no conversion)  │
│     └─▶ Upload to Gemini File API (google-genai SDK)   │
│     └─▶ Transcribe with generate_content()             │
│     └─▶ ~30-90s, ~$0.04 per 26-min video              │
│     └─▶ Music-aware prompt when category=music         │
│     └─▶ Source: "gemini"                               │
│                         │                               │
│                         ▼                               │
│  4. OpenAI Whisper (if enabled)                        │
│     └─▶ Download audio + convert to MP3 (FFmpeg)       │
│     └─▶ Chunk large files (>24MB) with pydub           │
│     └─▶ Transcribe with Whisper API                    │
│     └─▶ ~5-15min, ~$0.16 per 26-min video             │
│     └─▶ Max 60 minutes                                 │
│     └─▶ Source: "whisper"                              │
│                         │                               │
│                         ▼                               │
│  5. Metadata Fallback (music category only)            │
│     └─▶ Builds text from title, channel, description,  │
│         tags, and chapter titles                        │
│     └─▶ Only triggers when category == "music"         │
│     └─▶ Non-music videos still raise TranscriptError   │
│     └─▶ Skips sponsor filtering + AI chapter detection │
│     └─▶ Source: "metadata"                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration

```bash
# Gemini transcription (preferred audio fallback)
GEMINI_API_KEY=...      # Enables Gemini Flash transcription

# Whisper fallback settings
WHISPER_ENABLED=true
WHISPER_MAX_DURATION_MINUTES=60
OPENAI_API_KEY=sk-...  # Required for Whisper
```

---

## Chunked Extraction (Long Videos >30 min)

Videos longer than 30 minutes use a chapter-aware, batched extraction pipeline for better quality and reliability.

### Pipeline Flow

```
SHORT (<30 min):   Current pipeline unchanged (single/overflow extraction)
MEDIUM (30-120m):  Chapter split → 1-2 batch extraction calls → merge
LONG (2+ hours):   Chapter split → 2-5 batch calls → hierarchical synthesis → merge
```

### Chapter Splitting (`transcript_chunker.py`)

Fallback chain for splitting transcripts into chapters:
1. **YouTube chapters** — highest quality, from yt-dlp `video_data.chapters`
2. **AI chapter detection** — fast model LLM call with `chapter_detect.txt` prompt
3. **Time-based splitting** — ~5-minute segments when no chapters available
4. **Single chunk fallback** — treat entire transcript as one chunk (current behavior)

### Batched Extraction (`extractor.py`)

- Groups chapters into batches of ≤50K tokens (`batch_chapters()`)
- Parallel extraction per batch with `asyncio.Semaphore(EXTRACTION_PARALLEL_BATCHES)` (default 2)
- Single-batch chunked input is force-split into `EXTRACTION_FORCE_SPLIT_CHUNKS` sub-batches (default 4) so parallelism still engages on long single-chapter videos; falls back to overflow only when the split also yields one chunk
- Force-split bypasses `batch_chapters()`: `_resolve_strategy` returns `one_chunk_per_batch=True` and `_chunked_extraction` builds `batches=[[c] for c in chunks]` so the sub-batches don't re-collapse under `MAX_TOKENS_PER_BATCH`
- **Batch-aware prompt** (Phase 6): each batch's prompt carries a `<batch_partial_context>` block built by `_build_batch_context(batch_idx, total_batches, batch, full_duration_seconds)`. The block tells the model it sees only a slice of the video, overrides the base prompt's "no empty arrays" / density rules for partial transcripts, and explicitly instructs `Return EMPTY arrays for fields not present in your segment — other batches cover them`. The placeholder `{batch_context}` lives inside the `<transcript>` block (after the cache-split marker), so per-batch context never invalidates the Anthropic prompt cache
- Per-batch progress streamed via `asyncio.Queue` → SSE `extraction_progress` with `batch`/`of`
- Rate-limit aware: batches whose LLM call raises `RateLimitError` / `ServiceUnavailableError` propagate up (via `call_llm_with_retry(propagate_rate_limit=True)`) and are queued for a sequential second pass with `_RATE_LIMIT_BACKOFF_SECONDS = 2.0`; sequential events carry `section="chunked-sequential"` so the UI can surface the fallback. Sequential retries inherit the same `batch_context` so the prompt stays consistent across attempts
- First-pass model controlled by `EXTRACTION_USE_FAST_FIRST` (default off); synthesis-fed retry always escalates back to the primary model via `force_primary_model=True`
- Chapter headers injected into transcript for better context

> **Phase 6 rationale (2026-05-14):** v6 verification on `K-mA3MZ_EzU` showed parallel batches scored 0.40 on the merged extraction (below `RETRY_SCORE_THRESHOLD=0.6`) because each batch saw a 1/4 transcript slice but was told via `<completeness>` to extract for the full 108-min video — so empty `steps[]` from a batch that genuinely had no steps in its slice looked like a coverage gap. The synthesis-fed retry then re-ran all 4 batches, doubling extraction cost ($0.41 → $0.92). The Phase 6 `<batch_partial_context>` block targets the root cause: the model is now explicitly told its input is partial and `DO NOT pad fields to meet "no empty array" or density quotas`, so the merged extraction reflects true field-presence and the retry only fires on genuine quality misses.

### Extraction Merger (`extraction_merger.py`)

Per-domain merge logic for combining batch results:
- **Identity-based dedup** — name, label, term (case-insensitive)
- **Ordered list re-numbering** — step, order, number fields
- **Longest scalar selection** — keeps richest description/text
- **Recursive dict merge** — deep merge of nested structures

### Hierarchical Synthesis

For videos with >5 chapters, synthesis uses chapter summaries + truncated extraction (6K chars) instead of raw extraction data.

### Fast Model Routing

Model routing by stage:
- Plan: Sonnet (primary model, 30s timeout, 2 retries) — replaces old Manifest + Triage
- Classifier: fast model (10s timeout, 1 retry)
- Synthesis: `use_fast_model=True` (30s timeout)
- Enrichment: `use_fast_model=True`
- Frame vision (`frame_analyzer.analyze_frames_with_vision`): **primary (Sonnet)**. Originally routed to fast in Phase 1B / P3, reverted 2026-05-14 after a 5-frame spot-check (`scripts/spotcheck_frame_vision.py`) found `openai/gpt-4o-mini` was only ~20% cheaper *and* hallucinated OCR on dense-text frames
- AI chapter detection (`transcript_chunker._detect_chapters_with_ai`): `use_fast_model=True`, scoped under its own `llm_feature_var.set("summarize:chapter_detect")` context so cost is attributed correctly in `llm_usage` (was previously absorbed by the outer `summarize:extraction` tag)
- Extraction first pass: gated on `EXTRACTION_USE_FAST_FIRST` (default off → primary). Synthesis-fed retry passes `force_primary_model=True` to always escalate.

### Prompt Safety Net (`llm_retry.py`)

Hard character limit per model before every LLM call:
- Anthropic: 600K chars, OpenAI: 380K chars, Gemini: 3M chars
- Warning log when truncation triggers
- Prevents context overflow even without chunking

### Configuration (`config.py`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `CHUNKED_EXTRACTION_THRESHOLD` | 900 (15 min) | Duration threshold for chunked path |
| `MAX_TOKENS_PER_BATCH` | 50000 | Max tokens per extraction batch |
| `CHAPTER_BATCH_SIZE` | 3 | Chapters per batch target |
| `EXTRACTION_PARALLEL_BATCHES` | 2 | Semaphore bound for parallel chunked batches |
| `EXTRACTION_FORCE_SPLIT_CHUNKS` | 4 | Sub-batches when chunked input collapses to 1 batch |
| `EXTRACTION_USE_FAST_FIRST` | False | Route extraction first pass to fast model (gated rollout, primary still used on retry) |

### Key Files

| File | Purpose |
|------|---------|
| `src/services/transcription/transcript_chunker.py` | Chapter splitting with fallback chain |
| `src/services/pipeline/extraction_merger.py` | Per-domain merge + dedup |
| `src/prompts/chapter_detect.txt` | AI chapter detection prompt |
| `src/utils/llm_retry.py` | Fast model routing + prompt truncation |

---

## S3 Media Storage

All media (transcripts, frames, future audio) is stored in a unified S3 bucket (`vie-transcripts`).

### Architecture

```
vie-transcripts (S3 bucket)
└── videos/{youtube_id}/
    ├── transcript.json       ← processed transcript
    └── frames/
        └── {timestamp}.jpg   ← extracted video frames
```

```
┌─────────────────────────────────────────────────────────┐
│                 S3 MEDIA STORAGE                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Store Raw Transcript                                │
│     └─▶ S3 key: "videos/{youtubeId}/transcript.json"   │
│     └─▶ Legacy fallback: "transcripts/{youtubeId}.json"│
│     └─▶ Contains: segments, source, language, fetchedAt│
│                                                         │
│  2. Upload Video Frames                                 │
│     └─▶ S3 key: "videos/{youtubeId}/frames/{ts}.jpg"   │
│     └─▶ Parallel upload via asyncio.gather              │
│     └─▶ S3 exists check skips duplicates                │
│     └─▶ Blocks store s3_key (permanent) in MongoDB     │
│                                                         │
│  3. Serve via Presigned URLs                            │
│     └─▶ Generated at response time (sync, local signing)│
│     └─▶ Default expiry: 1 hour (S3_PRESIGNED_URL_EXPIRY)│
│     └─▶ Cached results refresh URLs before emitting    │
│                                                         │
│  4. Track Generation Metadata                           │
│     └─▶ model: LLM used for summarization              │
│     └─▶ promptVersion: for tracking prompt changes     │
│     └─▶ generatedAt: ISO timestamp                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Single bucket | `vie-transcripts` for all media | Simpler ops, per-video folder isolation |
| Presigned URLs | All access via signed URLs | Security: private bucket, time-limited access |
| `s3_key` in MongoDB | Store key, not URL | URLs change (expiry), key is permanent |
| Sync presigning | No async for URL generation | Local crypto operation (HMAC-SHA256), no network call |
| Lazy S3 initialization | aioboto3 imported on first use | Container starts without S3 dependency |
| Graceful degradation | S3 failure doesn't block summarization | Core functionality works without S3 |

### Migration Scripts

**Transcript key migration** (legacy → new path):

```bash
# Dry run (preview what would be migrated)
python scripts/migrate-s3-keys.py --dry-run

# Run migration
python scripts/migrate-s3-keys.py --batch-size 10

# Migrate and delete old keys
python scripts/migrate-s3-keys.py --delete-old
```

**Backfill raw transcripts** for existing videos:

```bash
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --dry-run
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --batch-size 100
```

---

## Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Run FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Commands

```bash
# Run server
uvicorn src.main:app --host 0.0.0.0 --port 8000

# Development with auto-reload
uvicorn src.main:app --reload --port 8000

# Run tests
pip install -e ".[dev]"
pytest
```

---

## API Reference

### POST /summarize

Trigger video summarization (async).

**Request:**
```json
{
  "videoSummaryId": "507f1f77bcf86cd799439011",
  "youtubeId": "dQw4w9WgXcQ",
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "userId": "507f1f77bcf86cd799439012"
}
```

**Response (202 Accepted):**
```json
{
  "status": "accepted",
  "videoSummaryId": "507f1f77bcf86cd799439011"
}
```

### POST /playlist/extract

Extract playlist metadata using yt-dlp (fast, no video download).

**Request:**
```json
{
  "playlist_id": "PLxxx",
  "max_videos": 100
}
```

**Response:**
```json
{
  "playlist_id": "PLxxx",
  "title": "React Tutorial Series",
  "channel": "Fireship",
  "thumbnail_url": "https://img.youtube.com/...",
  "total_videos": 15,
  "videos": [
    {
      "video_id": "dQw4w9WgXcQ",
      "title": "React Hooks",
      "position": 0,
      "duration": 1200,
      "thumbnail_url": "https://img.youtube.com/..."
    }
  ]
}
```

**Error Codes:**
- `404`: Playlist not found or private
- `500`: yt-dlp extraction failed

### POST /regenerate/{video_summary_id}

Trigger regeneration of an existing video summary.

**Request:**
```json
{
  "force": false  // Optional: set true to re-fetch from YouTube if S3 unavailable
}
```

**Response (200 OK):**
```json
{
  "status": "ready",
  "video_summary_id": "507f1f77bcf86cd799439011",
  "message": "Video summary ready for regeneration. Connect to streaming endpoint to process.",
  "has_raw_transcript": true,
  "generation": {
    "model": "anthropic/claude-sonnet-4-6",
    "promptVersion": "v1.0",
    "generatedAt": "2026-02-05T10:30:00Z"
  }
}
```

**Error Codes:**
- `400`: Invalid video summary ID format
- `404`: Video summary not found

### POST /override/{video_summary_id}

Override detected category during active pipeline processing. Affects remaining chapters only.

**Request:**
```json
{
  "category": "fitness"
}
```

**Response (200):**
```json
{
  "category": "fitness",
  "outputType": "workout",
  "outputTypeLabel": "Workout Plan",
  "persona": "fitness"
}
```

**Error Codes:**
- `422`: Invalid category (returns list of valid categories)
- `503`: Override capacity reached

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "summarizer",
  "model": "anthropic/claude-sonnet-4-6",
  "database": "connected",
  "s3": "healthy"
}
```
