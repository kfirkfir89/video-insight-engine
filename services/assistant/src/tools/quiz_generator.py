"""Quiz generator tool — creates quiz questions from video content."""

from __future__ import annotations

import json

from src.config import settings
from src.exceptions import LLMError
from src.logging_config import get_logger
from src.repositories.video_repository import VideoContext
from src.services.llm_provider import LLMProvider

logger = get_logger(__name__)

_QUIZ_SYSTEM_PROMPT = """\
You are a quiz generator. Create multiple-choice questions based on the video content.

Video: {title} by {creator}

Summary:
{summary}

Key takeaways:
{takeaways}

Generate {num_questions} quiz questions{topic_clause}.

Respond with ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct"
    }}
  ]
}}"""

_DEFAULT_NUM_QUESTIONS = 5
_MAX_QUESTIONS = 10
_MAX_SUMMARY_CHARS = 3000


class QuizGeneratorTool:
    """Generate quiz questions from video content."""

    name = "quiz_generator"
    description = "Generate quiz questions from video content"

    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    async def execute(self, params: dict, context: dict) -> dict:
        """Generate quiz questions using the fast LLM model.

        Args:
            params: Optional ``topic`` (str) and ``num_questions`` (int, default 5).
            context: Must contain ``video_ctx`` (VideoContext).

        Returns:
            Dict with ``questions`` list.
        """
        topic: str | None = params.get("topic")
        num_questions = min(
            params.get("num_questions", _DEFAULT_NUM_QUESTIONS),
            _MAX_QUESTIONS,
        )
        video_ctx: VideoContext = context["video_ctx"]

        logger.info(
            "quiz_generate_start",
            topic=topic,
            num_questions=num_questions,
        )

        topic_clause = f" about '{topic}'" if topic else ""
        summary = video_ctx.summary[:_MAX_SUMMARY_CHARS]
        takeaways = "\n".join(f"- {t}" for t in video_ctx.takeaways) or "(none)"

        system_prompt = _QUIZ_SYSTEM_PROMPT.format(
            title=video_ctx.title,
            creator=video_ctx.creator or "Unknown",
            summary=summary,
            takeaways=takeaways,
            num_questions=num_questions,
            topic_clause=topic_clause,
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Generate the quiz now."},
        ]

        # Use a fast model for quiz generation
        fast_llm = LLMProvider(
            model=settings.llm_fast_model,
            fallback_models=settings.llm_fallback_models,
        )

        try:
            raw = await fast_llm.complete_with_messages(
                messages=messages,
                max_tokens=2000,
                span_name="tool:quiz_generator",
            )
        except LLMError:
            logger.exception("quiz_generate_llm_failed")
            raise

        questions = _parse_quiz_response(raw)

        logger.info("quiz_generate_complete", question_count=len(questions))
        return {"questions": questions}


def _parse_quiz_response(raw: str) -> list[dict]:
    """Parse LLM JSON response into validated quiz questions."""
    try:
        data = json.loads(raw)
        questions = data.get("questions", [])
        return [_validate_question(q) for q in questions if _is_valid_question(q)]
    except (json.JSONDecodeError, KeyError, TypeError):
        logger.warning("quiz_parse_failed", raw_preview=raw[:200])
        return []


def _is_valid_question(q: dict) -> bool:
    """Check that a question dict has all required fields."""
    return (
        isinstance(q, dict)
        and isinstance(q.get("question"), str)
        and isinstance(q.get("options"), list)
        and len(q["options"]) >= 2
        and isinstance(q.get("correct_index"), int)
        and 0 <= q["correct_index"] < len(q["options"])
    )


def _validate_question(q: dict) -> dict:
    """Normalize a question dict to the expected shape."""
    return {
        "question": q["question"],
        "options": [str(o) for o in q["options"]],
        "correct_index": q["correct_index"],
        "explanation": q.get("explanation", ""),
    }
