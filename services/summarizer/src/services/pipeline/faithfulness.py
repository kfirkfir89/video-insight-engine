"""LLM-as-Judge faithfulness check.

Samples a deterministic subset of extracted items, asks a Haiku-tier LLM
whether each claim is supported by the transcript, and logs an aggregate
score onto the active Langfuse trace.

Design notes
------------
- **Non-blocking by contract.** The judge runs as a fire-and-forget task
  attached to the pipeline trace. Failures are logged at debug level — the
  user-facing video output is never delayed by a faithfulness check.
- **Deterministic sampling.** The sample seed is derived from the
  ``youtube_id`` so the same video always gets the same items checked.
  That keeps day-to-day variance attributable to model drift rather than
  random sampling noise.
- **Cheap.** Haiku-tier judge, 20% sample, capped at 6 items per video.
  Per-video cost ~$0.005.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from dataclasses import dataclass
from typing import Any

from src.config import settings
from src.services.llm import LLMService
from src.services.observability import log_score

logger = logging.getLogger(__name__)


_MAX_SAMPLES_PER_VIDEO = 6
_JUDGE_TIMEOUT_SECONDS = 20.0
# Transcript window passed to the judge LLM (call_llm_fast path).
#
# Sized for the default fast tier — Anthropic Haiku-4.5, 200K-token context;
# 80K chars ≈ 20K tokens leaves ample room for the judge prompt + claim.
# The previous 12K budget meant videos longer than ~12 minutes only showed
# the judge their opening, so claims from later chapters were never in-window
# and the judge always returned `false`.
#
# WARNING for operators: this constant is coupled to the judge model's
# context window. If LLM_FAST_MODEL or a per-stage faithfulness override
# routes the judge through a smaller-context model (e.g. an 8K-context
# legacy model), this budget will overflow the model's prompt limit and
# every judge call will error out. The diagnostic log in
# `run_faithfulness_check` emits `truncated=True` when the input transcript
# exceeds the budget; watch for that signal when swapping models.
_TRANSCRIPT_BUDGET_CHARS = 80_000
_CLAIM_BUDGET_CHARS = 400


_JUDGE_PROMPT = (
    "You are a fact-checker. Given a transcript excerpt and an extracted claim, "
    "decide whether the claim is supported by the transcript.\n\n"
    "Reply in this exact JSON format:\n"
    '{{"grounded": true|false, "evidence": "quoted span ≤25 words or empty"}}\n\n'
    "Be strict: \"grounded\" must be true only if the transcript explicitly "
    "states the claim. Paraphrases are fine; inferences are not.\n\n"
    "TRANSCRIPT:\n{transcript}\n\n"
    "CLAIM:\n{claim}\n"
)


@dataclass(frozen=True)
class FaithfulnessReport:
    """Aggregate result for one pipeline run."""

    sample_size: int
    grounded_count: int
    score: float  # 0.0–1.0, fraction grounded

    @property
    def passed(self) -> bool:
        return self.score >= 0.7


# ─── Claim flattening ───────────────────────────────────────────────────
def _flatten_claims(extraction_data: dict[str, Any]) -> list[str]:
    """Pull short string claims out of an extraction blob.

    Walks the nested dict, collecting strings under known leaf fields
    ("text", "description", "definition", "name") that look meaningful
    (≥20 chars, ≤_CLAIM_BUDGET_CHARS). Skips empty strings and obvious
    boilerplate.
    """
    keep_keys = {"text", "description", "definition", "name", "summary", "claim"}
    out: list[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in keep_keys and isinstance(v, str):
                    cleaned = v.strip()
                    if 20 <= len(cleaned) <= _CLAIM_BUDGET_CHARS:
                        out.append(cleaned)
                else:
                    _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(extraction_data)
    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for c in out:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def _sample_claims(claims: list[str], rate: float, youtube_id: str) -> list[str]:
    """Deterministic sample of claims at the given rate, capped per video."""
    if rate <= 0 or not claims:
        return []
    rng = random.Random(youtube_id)
    pick_count = min(_MAX_SAMPLES_PER_VIDEO, max(1, int(round(len(claims) * rate))))
    return rng.sample(claims, k=min(pick_count, len(claims)))


# ─── Judging ────────────────────────────────────────────────────────────
def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n[truncated]"


def _parse_judge_response(raw: str) -> bool | None:
    """Return ``True`` if grounded, ``False`` if not, ``None`` if unparseable."""
    if not raw:
        return None
    # Find the first {...} block — judge output is occasionally wrapped in prose.
    match = re.search(r"\{[^{}]*\}", raw, flags=re.DOTALL)
    payload = match.group(0) if match else raw
    try:
        data = json.loads(payload)
    except (json.JSONDecodeError, TypeError):
        return None
    grounded = data.get("grounded")
    if isinstance(grounded, bool):
        return grounded
    if isinstance(grounded, str):
        return grounded.lower() == "true"
    return None


async def _judge_one(llm_service: LLMService, transcript: str, claim: str) -> bool | None:
    """Ask the judge about one claim. Returns ``None`` on judge failure."""
    from src.utils.llm_retry import call_llm_with_retry

    prompt = _JUDGE_PROMPT.format(
        transcript=_truncate(transcript, _TRANSCRIPT_BUDGET_CHARS),
        claim=_truncate(claim, _CLAIM_BUDGET_CHARS),
    )
    try:
        raw = await call_llm_with_retry(
            llm_service, prompt,
            max_tokens=256,
            timeout=_JUDGE_TIMEOUT_SECONDS,
            max_retries=1,
            stage_name="faithfulness",
            use_fast_model=True,
            json_mode=True,
        )
    except Exception as exc:  # noqa: BLE001 — judge errors must not crash pipeline
        logger.debug("Faithfulness judge call failed: %s", exc)
        return None
    verdict = _parse_judge_response(raw or "")
    # DEBUG-level: per-claim raw bodies are noisy at 6 lines per video and
    # carry transcript-derived text that shouldn't routinely ship to log
    # aggregators. The one-line run summary (in run_faithfulness_check) is
    # the production-visible signal; enable DEBUG locally to dig into a
    # specific run.
    logger.debug(
        "[faithfulness] claim=%r verdict=%s raw=%r",
        claim[:120], verdict, (raw or "")[:200],
    )
    return verdict


# ─── Orchestrator ───────────────────────────────────────────────────────
async def run_faithfulness_check(
    *,
    llm_service: LLMService,
    transcript: str,
    extraction_data: dict[str, Any],
    youtube_id: str,
    sample_rate: float | None = None,
) -> FaithfulnessReport | None:
    """Score the extraction against the transcript, log to Langfuse.

    Returns the aggregate report (handy for the pipeline summary log) or
    ``None`` when sampling is disabled / nothing to score. Never raises.
    """
    rate = sample_rate if sample_rate is not None else settings.LANGFUSE_FAITHFULNESS_SAMPLE_RATE
    if rate <= 0:
        return None

    claims = _flatten_claims(extraction_data)
    sample = _sample_claims(claims, rate, youtube_id)
    if not sample:
        logger.debug("Faithfulness: no claims to sample for %s", youtube_id)
        return None

    transcript_len = len(transcript)
    transcript_truncated = transcript_len > _TRANSCRIPT_BUDGET_CHARS
    logger.info(
        "[faithfulness] video=%s claims_total=%d sample_size=%d "
        "transcript_chars=%d window_chars=%d truncated=%s",
        youtube_id, len(claims), len(sample),
        transcript_len,
        min(transcript_len, _TRANSCRIPT_BUDGET_CHARS),
        transcript_truncated,
    )

    # ``return_exceptions=True`` so one unexpected raise inside ``_judge_one``
    # (e.g. a transport error escaping ``call_llm_with_retry``) only loses that
    # one verdict — never the whole sampling run.
    results = await asyncio.gather(
        *(_judge_one(llm_service, transcript, c) for c in sample),
        return_exceptions=True,
    )
    judged = [r for r in results if isinstance(r, bool)]
    if not judged:
        logger.debug("Faithfulness: judge produced no usable verdicts for %s", youtube_id)
        return None

    grounded_count = sum(1 for v in judged if v is True)
    score = grounded_count / len(judged)
    report = FaithfulnessReport(
        sample_size=len(judged),
        grounded_count=grounded_count,
        score=round(score, 3),
    )

    log_score(
        "faithfulness",
        report.score,
        comment=f"{report.grounded_count}/{report.sample_size} grounded "
                f"({len(sample) - len(judged)} judge errors)",
    )
    if not report.passed:
        logger.warning(
            "Low faithfulness score for %s: %.2f (%d/%d grounded)",
            youtube_id, report.score, report.grounded_count, report.sample_size,
        )
    return report
