# Observability

LLM observability is the project's debugging story for "this video came out wrong, why?". Aggregate cost is tracked locally in MongoDB via `usage_tracker.py`; per-call traces, prompt versions, datasets and scores live in [Langfuse](https://langfuse.com).

Everything is **best-effort**: every Langfuse call is wrapped in try/except, all helpers no-op when keys are unset, and the SDK lives behind a contextvar so concurrent pipeline runs don't contaminate each other's traces. A failed observability layer must not bring down the pipeline.

## Quick start

1. Sign up at https://cloud.langfuse.com (free tier: 50K observations/month — enough for ~500 videos/month).
2. Create two projects (`vie-dev`, `vie-prod`) and grab keys for each.
3. Add to `.env`:

   ```
   LANGFUSE_PUBLIC_KEY=pk_…
   LANGFUSE_SECRET_KEY=sk_…
   LANGFUSE_BASE_URL=https://cloud.langfuse.com
   LANGFUSE_FAITHFULNESS_SAMPLE_RATE=0.2
   ```

4. Restart the summarizer + assistant containers. Submit a video. The trace appears under **Traces** in the Langfuse UI within seconds.
5. Register prompts: `python3 scripts/register_prompts.py --commit` (idempotent — re-runs only upload changed prompts).

To run **without** Langfuse: leave the keys blank. The pipeline behaves identically.

## Trace structure

One pipeline run = one trace named `pipeline:{videoSummaryId}`, tagged with `youtubeId` and `videoSummaryId`. Each LLM call attaches as a child generation with `usage` (input/output/total/cost) and `metadata` (attempt, useFastModel, modelOverride, latencyMs).

```
Trace: pipeline:{videoSummaryId}
├── generation: classifier           model=gpt-4o-mini       tokens   cost  latency
├── generation: plan                  model=sonnet            tokens   cost  latency
├── generation: extraction            model=sonnet            tokens   cost  latency
│   └── (one generation per batch when chunked extraction kicks in)
├── generation: synthesis             model=gpt-4o-mini
├── generation: enrichment            model=haiku
├── generation: translation_*         (if non-English video)
├── score: faithfulness               0.0–1.0  (sampled, see below)
└── (assembly has no generations — pure code)
```

For the assistant, one chat session = one trace named `chat:{videoId}` keyed by `userId`/`sessionId`. Tool runs attach as named spans (`tool:concept_explain`, `tool:quiz_generator`, …) and the RAG generation is a `rag_generation` span.

### Reading a trace

In the Langfuse UI:

- **Top of trace**: total cost, total latency, model mix, tags — open this first when triaging. Trace-level `cacheHit` metadata distinguishes Redis-served fast-path runs from full pipeline runs.
- **Generations panel**: the per-stage breakdown. Sort by latency or cost to find the bottleneck.
- **Input / Output panels** of a generation: the actual prompt and response, after redaction (emails, phone-shaped runs, plus a short allowlist of token formats — see below) and truncation (50KB cap with `[TRUNCATED]` marker; original length is not encoded, on purpose).
- **Metadata**: `attempt`, `useFastModel`, `modelOverride`, `finishReason`, `latencyMs`. `attempt>1` means a retry fired. `promptVersions` maps prompt name → registry version for every prompt that was loaded inside the trace.
- **Scores**: faithfulness score plus comment "N/M grounded". Below 0.7 = quality regression suspect.

## Prompt registry

Local `.txt` files in `services/summarizer/src/prompts/**` are the source of truth at build time. `scripts/register_prompts.py` walks the tree and uploads each as a Langfuse prompt with this naming convention:

| Local path | Langfuse name |
| --- | --- |
| `prompts/base_extraction.txt` | `summarizer:base_extraction` |
| `prompts/schemas/food.txt` | `summarizer:schema:food` |
| `prompts/enrich/enrich_study.txt` | `summarizer:enrich:enrich_study` |
| `prompts/examples/learning.txt` | `summarizer:example:learning` |
| `services/assistant/src/utils/prompt_templates.py::RAG_HEADER` | `assistant:rag_header` |

Every pipeline phase loads its prompt through `load_prompt_text` (in `services/summarizer/src/services/pipeline/prompt_builder.py`), which is registry-first with file fallback. A successful registry fetch records the prompt's version in the active trace's `promptVersions` map — every subsequent generation span carries the link in its metadata so a "this batch was wrong" investigation can pin the exact prompt that ran. Paths outside `PROMPTS_DIR` bypass the registry, so ad-hoc files (tmp tests, dev fixtures) never get looked up.

The uploader (`scripts/register_prompts.py`) refuses to ship any prompt that exceeds 200 KB, is empty/whitespace-only, or matches one of the secret-token patterns it knows about (`LANGFUSE_SECRET_KEY=...`, AWS, Anthropic, OpenAI, GitHub, JWT). This is a guardrail against accidental upload of a renamed `.env` or dump file.

Updating prompts:

```bash
# Edit the .txt file locally, then sync:
python3 scripts/register_prompts.py            # dry run, no commits
python3 scripts/register_prompts.py --commit   # actually upload
```

A new version is created only when content differs from the latest registered version.

## Faithfulness judge

After extraction completes, a fire-and-forget task samples 20% of extracted items (capped at 6 per video, deterministic by `youtubeId`) and asks a Haiku-tier LLM "is this claim supported by the transcript?". The aggregate `grounded / total` ratio is logged as a Langfuse score named `faithfulness`.

The check is **informational only** — it never blocks the pipeline or fails a video. Use the Langfuse dashboards to track drift over time. A run below 0.7 is logged at warning level but otherwise ignored.

Tuning:

- `LANGFUSE_FAITHFULNESS_SAMPLE_RATE=0` disables the judge entirely.
- `LANGFUSE_FAITHFULNESS_SAMPLE_RATE=1.0` checks every claim (capped at 6/video). Useful when debugging a quality regression.
- Cost: ~$0.005 per video at the default rate.

## Golden dataset + eval

`dev/golden-dataset/videos.yaml` lists 20 hand-curated videos with expected tabs, components, and key content terms. Two scripts work with it:

```bash
# One-time: upload the dataset to Langfuse for visual diffing
python3 scripts/build_golden_dataset.py --dataset-name vie-golden-v1

# Per-release: run the pipeline against every entry and score the output
python3 scripts/run_eval.py --output reports/ --fail-under 0.7
```

Scoring (`scripts/run_eval.py`):

- **tab_count_score** (×0.2) — within ±1 of expected
- **component_coverage** (×0.4) — every required component appears
- **content_coverage** (×0.3) — ≥80% of expected terms appear in assembled tabs
- **empty tabs** (×0.1) — every assembled tab has populated required lists

The reports land under `reports/eval-{timestamp}.csv` + `.md`. The CI-friendly `--fail-under` flag exits non-zero when the average drops below the threshold.

Dry-run mode (`--dry-run`) substitutes a perfect-response stub for the live pipeline, so the scoring code path can be smoke-tested without making any network calls. Used by the test suite.

## Operational watch-outs

- **Third-party data flow**: enabling Langfuse ships prompts and outputs to whatever host `LANGFUSE_BASE_URL` points at (cloud.langfuse.com by default). Treat that flow like any other external dependency.
- **Redaction model**: `langfuse_client.redact_pii` strips a short fixed list of patterns — emails, long phone-shaped digit runs, JWTs (`eyJ...`), AWS access-key IDs (`AKIA…`/`ASIA…`/…), Anthropic keys (`sk-ant-…`), OpenAI keys (`sk-…`), GitHub PATs (`ghp_/ghu_/ghs_/gho_/ghr_…`), and `Bearer <token>` headers. Names, addresses, account numbers and free-form PII are **not** detected. If your compliance posture needs more, extend the pattern list in one place and re-run the test suite. The same redactor runs recursively over Anthropic structured content blocks (frame-vision OCR text included).
- **User-id propagation**: by default the internal user id is forwarded on the trace (helpful for support debugging). Set `LANGFUSE_USER_ID_MODE=hash` to forward a deterministic 16-char SHA-256 derivative instead (combine with `LANGFUSE_USER_ID_HASH_SALT` so a leaked trace export isn't trivially correlatable), or `LANGFUSE_USER_ID_MODE=omit` to strip the id entirely.
- **Payload size**: prompts/outputs are truncated at 50KB before upload (`truncate_payload`). The truncation marker is a fixed string — the original length is deliberately not encoded so a downstream viewer can't infer pre-redaction size from the trace.
- **Free-tier ceiling**: 50K observations/month covers ~500 pipeline runs/month at current span density. If you exceed it, either drop to per-stage tracing (skip per-batch extraction spans) or upgrade to a paid tier.
- **SDK absent**: `import langfuse` failures are tolerated — the layer silently no-ops. This keeps trimmed CI images functional without the heavy SDK.
- **Async lifecycle**: the SDK's `flush()` runs inside `asyncio.to_thread` to avoid blocking the event loop. Don't replace this with a direct sync call.
- **Cache-hit observability**: Redis-served fast paths still open a trace (with `cacheHit=true` metadata) so dashboards count them. Without this, fast-path traffic would be invisible and dashboards would under-count real request volume.
- **Eval URL allowlist**: `scripts/run_eval.py` rejects URLs whose host isn't on the YouTube allowlist — protects against the eval being repointed at an internal host via a PR.

## File layout

```
services/summarizer/src/services/observability/
├── __init__.py              # public API re-exports
└── langfuse_client.py       # init, pipeline_trace, log_generation, log_score, redact_pii, fetch_prompt

services/assistant/src/services/observability/
├── __init__.py              # public API (adds session_trace, span)
└── langfuse_client.py       # mirror of summarizer's client + assistant-specific helpers

services/summarizer/src/services/pipeline/faithfulness.py   # LLM-as-Judge
scripts/register_prompts.py        # sync .txt → Langfuse
scripts/build_golden_dataset.py    # upload videos.yaml → Langfuse dataset
scripts/run_eval.py                # run pipeline on golden + score
dev/golden-dataset/videos.yaml     # 20 curated entries
```

## Request tracing & Sentry

Every HTTP request to the API gets a UUID v4 stamped on the `x-request-id` response header. That id flows end-to-end:

- **API → frontend**: header echoed on every response (set in `api/src/plugins/request-id.ts`).
- **API → RabbitMQ**: `requestId` field on the queue payload (`api/src/services/queue-topology.ts`).
- **API → summarizer HTTP fallback**: `X-Request-ID` header on `triggerSummarization` (`api/src/services/summarizer-client.ts`).
- **API → assistant**: `X-Request-ID` header on `/chat` and `/action` (`api/src/services/assistant-client.ts`).
- **Worker**: the runner binds `request_id`, `video_summary_id`, `youtube_id`, `user_id`, `attempt` to structlog contextvars before driving the pipeline. Every log line and Langfuse trace tag inside the pipeline carries them automatically.
- **Assistant**: `add_request_context_middleware` reads the header (or generates one) and binds it on contextvars.

### Log line shape

JSON logs in every service carry, at minimum:

```json
{
  "timestamp": "2026-05-20T10:30:00.000Z",
  "level": "info",
  "service": "vie-api | vie-summarizer | vie-summarizer-worker | vie-assistant",
  "requestId": "<uuid>",
  "userId": "<optional>",
  "videoSummaryId": "<optional>",
  "stage": "<optional>",
  "msg": "<event name>"
}
```

The `service` field is stamped by a structlog processor (or pino `base`) so log aggregators can filter without callers having to mention it. Other fields appear only when bound on contextvars (Python) or attached to `req.log` (Node).

### Cross-system lookup

Given a `request-id`:

| Where | How |
|-------|-----|
| API pino logs | `grep '"requestId":"<id>"'` in service stdout (or your log aggregator) |
| Summarizer / assistant structlog | same — the id is on every line via contextvars |
| Worker structlog | same — bound on entry, cleared on exit |
| Langfuse trace | search traces by tag `requestId:<id>` |
| Sentry event | search events by tag `requestId:<id>` |

Or run `./scripts/find-request.sh <request-id>` from the repo root — it greps docker logs across all three services in parallel.

### Sentry init

`@sentry/node` is installed in the API; `sentry-sdk[fastapi]` in summarizer + assistant. All three services share the same env contract:

```
SENTRY_DSN=                       # empty -> SDK no-ops
SENTRY_ENVIRONMENT=production     # defaults to NODE_ENV / ENVIRONMENT
SENTRY_RELEASE=                   # usually the deploy SHA
SENTRY_TRACES_SAMPLE_RATE=0.1     # 0.0–1.0; 0 disables performance traces
```

The shared `llm_common.sentry_init` module hosts the Python init + `before_send` PII filter; the Node side has the same logic in `api/src/plugins/sentry.ts`. Both:

- Strip sensitive headers: `Authorization`, `Cookie`, `Set-Cookie`, `X-Internal-Secret`, `X-Admin-Key`, `X-CSRF-Token`, `X-API-Key`, `Proxy-Authorization`.
- Scrub URL query strings for credential params (`token`, `access_token`, `refresh_token`, `id_token`, `code`, `state`, `api_key`, `apikey`, `key`, `password`, `secret`) on `request.url`, `request.query_string`, and the `route` tag. Needed because the WebSocket upgrade path puts the JWT in `?token=`.
- Drop `user.email`, and drop `user.id` / `user.username` if either embeds an email.
- Recurse the email redactor over `request.data`, `extra`, `contexts`, `breadcrumbs[*].data`, and `exception.values[*].value` (so a logger that includes a body or stack message can't leak addresses).
- Promote the `request_id` contextvar / `req.id` to a Sentry tag named `requestId`.

The `X-Request-ID` header is validated on both sides — `^[A-Za-z0-9_-]{8,128}$`. Forged headers (newline injection, control chars, semicolons) fall through to a fresh UUID so they cannot pollute log lines or Sentry tag space.

Worker DLQ failures fire one Sentry event per dead-lettered job — retries don't (alert noise).

The API's `onError` hook only captures errors whose effective status is ≥500. Status is resolved via `effectiveStatusCode` across three shapes: Fastify-native `.statusCode` (rate limit, schema validation), project `AppError` subclasses (`NotFoundError`, `ValidationError`, etc.) via `.status`, and `ZodError` thrown by route-boundary `.parse()` calls (always 400). Without all three checks, expected client outcomes would land in Sentry as 500-class noise.

## Related docs

- [llm-cost-model.md](./llm-cost-model.md) — local cost ledger (complement, not replacement)
- [CROSS-CUTTING.md](./CROSS-CUTTING.md) — request-id propagation; Langfuse `traceId` aligns with the Sentry transaction id by design
- [SERVICE-SUMMARIZER.md](./SERVICE-SUMMARIZER.md) — pipeline phases that the trace structure mirrors
