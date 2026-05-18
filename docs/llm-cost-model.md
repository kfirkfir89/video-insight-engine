# LLM Cost Model

How VIE accounts for LLM token spend, including Anthropic prompt-caching credit.

## Recording

Every LiteLLM call writes one row to MongoDB `llm_usage` via
`MongoDBUsageCallback._build_record` (`packages/llm-common/src/llm_common/callback.py`).
The callback is registered as `litellm.callbacks = [callback]` on service startup
and is the single source of truth for cost — there is no manual tracking path
in the hot loop.

## Schema

`UsageRecord` (`packages/llm-common/src/llm_common/models.py`):

| Field                     | Source                                              | Notes |
|---------------------------|-----------------------------------------------------|-------|
| `model`                   | `kwargs["model"]`                                   | LiteLLM model string, e.g. `anthropic/claude-sonnet-4-6` |
| `provider`                | derived from `model`                                | `anthropic` / `openai` / `gemini` / `unknown` |
| `tokens_in`               | `response.usage.prompt_tokens`                      | Includes uncached + cache-create + cache-read |
| `tokens_out`              | `response.usage.completion_tokens`                  | |
| `cost_usd`                | `litellm.completion_cost(response)`                 | Provider-billed cost, already net of cache discount |
| `cache_creation_tokens`   | `usage.cache_creation_input_tokens`                 | Tokens that wrote into the cache this call |
| `cache_read_tokens`       | `usage.cache_read_input_tokens`                     | Tokens served from the cache this call |
| `cache_hit`               | `_hidden_params.cache_hit` or `cache_read > 0`      | Either signal triggers True |
| `cache_savings_usd`       | `compute_cache_savings_usd(model, cache_read)`      | See below |
| `feature` / `video_id`    | `llm_feature_var` / `llm_video_id_var`              | Set by call sites via context vars |
| `service`                 | callback ctor arg                                   | `summarizer` / `assistant` / etc. |
| `is_stream`               | `kwargs["stream"]`                                  | True when LiteLLM was streamed |

## Cache savings calculation

`compute_cache_savings_usd` multiplies cache-read tokens by the per-1M-token
delta between the input rate and the cached-read rate. Anthropic publishes
cached reads at ~10% of the normal input rate; for Sonnet 4.6 that's
$0.30/MTok vs $3.00/MTok.

```python
delta = rates["input"] - rates["cache_read"]
savings = (cache_read_tokens / 1_000_000) * delta
```

The rate map lives in `_CACHE_RATES_USD_PER_M`. When a model lacks a mapping,
savings are reported as `0.0` and the missing model is logged once
(`cache.rate_missing`) — under-reporting is preferred over inventing numbers.

`cost_usd` is the provider-billed cost (already net of the cache discount).
`cache_savings_usd` is what we *would* have paid had the read tokens been
billed at the full input rate, so total list-price spend ≈ `cost_usd + cache_savings_usd`.

## Where cache_control is set

`services/summarizer/src/services/llm_provider.py:162-169` — when
`cache_static` is provided and the model is Anthropic, the static prompt half
is sent as a separate system message with `cache_control: {"type": "ephemeral"}`.
LiteLLM forwards the directive to the Anthropic API.

The current cached blocks are:
- `services/summarizer/src/prompts/base_extraction.txt` (extraction)
- `services/summarizer/src/prompts/plan.txt` (plan stage)

Plus the dynamic prompt in `complete_with_messages` is appended afterward.

## How to audit

Run the audit script:

```bash
python scripts/audit_cache_credits.py                  # last 24h
python scripts/audit_cache_credits.py --hours 1        # last hour
python scripts/audit_cache_credits.py --video-id <id>  # one video
python scripts/audit_cache_credits.py --json           # machine-readable
```

Exit codes:
- `0` cache hits observed on Anthropic calls
- `1` no records in window
- `2` Anthropic calls present but zero cache hits — investigate

## Common failure modes

1. **Zero hits on Sonnet calls** — usually means the static prompt half is
   not byte-identical between calls (e.g., a timestamp or user_goal slipped
   in). Re-grep call sites for variable interpolation in cached blocks.
2. **`cache.rate_missing` log** — a model alias was added in `config.MODEL_MAP`
   without a corresponding entry in `_CACHE_RATES_USD_PER_M`. Add the
   per-1M-token rates for that model.
3. **`cost_usd = 0`** — LiteLLM doesn't know the price for a custom-named
   model (e.g. a date-stamped Anthropic preview). Map the alias to a known
   model in LiteLLM's pricing table or accept zero cost reporting until the
   model goes GA.

## Status of P1 work

- ✅ Cache fields on `UsageRecord` (creation/read tokens, hit flag, savings)
- ✅ Per-model cache rate map with miss-logging fallback
- ✅ `cache_control: ephemeral` set on extraction + plan static halves
- ✅ Audit script (`scripts/audit_cache_credits.py`)
- 📋 Live audit pending production traffic — run the script after one
      end-to-end pipeline run to confirm the second-pass call hits the cache.

## Per-user daily cap

`llm_usage` rows (Python schema) are aggregated per-user into the `userCosts`
collection by `CostMonitorService.reconcileUserDay` /
`reconcileAllUsersForDay`. The aggregate feeds two gates:

1. **POST /api/videos** — `reserveUserCost(userId, tier)` atomically increments
   the day's `totalCostUsd` by an over-estimate, then refunds-and-throws
   `DailyLimitReachedError` (HTTP 429) if the user is already past
   `COST_LIMITS_PER_TIER[tier]`. The increment-then-check pattern serializes
   concurrent submissions on the per-user/day doc — see the regression test
   `should serialize concurrent reservations on the same user/day`.
2. **GET /api/users/me/usage** — returns today's effective spend, headroom,
   and the next UTC midnight reset for the in-app usage tile.

Reconciliation runs on every terminal video status (`completed` / `failed`)
via the internal status callback, and nightly via `POST /internal/reconcile-costs`.
The terminal-status path is the canonical refund-on-failure — do not also
call `refundReservation` on failure, or the day will be double-credited.

The Node `CostMonitorService.recordUsage` writes a **different** schema
(`model`, `cost`, `createdAt`) that reconciliation does **not** read; use it
only for global cost telemetry, not for per-user attribution.

Admin grants and manual charges go through `userCostAdjustments` (signed
storage: negative = credit) — see [DATA-MODELS.md](./DATA-MODELS.md#usercostadjustments)
and [SERVICE-ADMIN.md](./SERVICE-ADMIN.md#per-user-costs-users).
