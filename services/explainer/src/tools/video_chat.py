"""video_chat tool: Chat about a specific video grounded in its content."""

from string import Template

from llm_common.context import llm_video_id_var, llm_feature_var
from src.exceptions import ResourceNotFoundError
from src.repositories.base import VideoSummaryRepositoryProtocol
from src.schemas import VideoSummary
from src.services.llm import LLMService, load_prompt
from src.utils.output_type import get_output_type_label, get_output_type_hint


def _serialize_output_data(data: dict, max_items: int = 8) -> list[str]:
    """Serialize typed output data into readable text lines for LLM context."""
    lines: list[str] = []
    for key, value in data.items():
        # Skip internal/meta fields
        if key.startswith("_"):
            continue
        section_label = key.replace("_", " ").title()
        if isinstance(value, str):
            lines.append(f"\n### {section_label}")
            lines.append(value[:500])
        elif isinstance(value, list):
            lines.append(f"\n### {section_label}")
            for item in value[:max_items]:
                if isinstance(item, dict):
                    # Extract the most meaningful text from dict items
                    text = item.get("text") or item.get("title") or item.get("name") or item.get("label") or ""
                    desc = item.get("description") or item.get("detail") or item.get("definition") or ""
                    if text:
                        entry = f"- **{text}**" if desc else f"- {text}"
                        if desc:
                            entry += f": {str(desc)[:200]}"
                        lines.append(entry)
                elif isinstance(item, str):
                    lines.append(f"- {item[:200]}")
        elif isinstance(value, dict):
            lines.append(f"\n### {section_label}")
            for sub_key, sub_val in list(value.items())[:max_items]:
                if isinstance(sub_val, str):
                    lines.append(f"- **{sub_key}**: {sub_val[:200]}")
    return lines


def _build_video_context(video_summary: VideoSummary) -> str:
    """Build a context string from video summary for the LLM.

    Prefers typed output data from the intent-driven pipeline.
    Falls back to V1 chapter-based sections for backward compat.
    """
    parts = [f"# Video: {video_summary.title}"]

    # Prefer typed output data from intent-driven pipeline
    if video_summary.output_data and isinstance(video_summary.output_data, dict):
        parts.append(f"\n## Content ({video_summary.output_type.replace('_', ' ').title()})")
        parts.extend(_serialize_output_data(video_summary.output_data))
    elif video_summary.sections:
        # Fallback: V1 chapter-based content
        parts.append("\n## Chapters")
        for section in video_summary.sections:
            parts.append(f"\n### {section.title} ({section.timestamp})")
            content_items = section.content or []
            for block in content_items[:5]:
                if isinstance(block, dict):
                    block_type = block.get("type", "")
                    if block_type == "paragraph":
                        parts.append(block.get("text", ""))
                    elif block_type == "bullets":
                        for item in block.get("items", [])[:5]:
                            parts.append(f"- {item}")

    # Add concepts
    if video_summary.concepts:
        parts.append("\n## Key Concepts")
        for concept in video_summary.concepts:
            definition = concept.definition or "No definition"
            parts.append(f"- **{concept.name}**: {definition}")

    return "\n".join(parts)


async def video_chat(
    video_summary_id: str,
    user_message: str,
    chat_history: list[dict],
    video_summary_repo: VideoSummaryRepositoryProtocol,
    llm_service: LLMService,
) -> str:
    """Chat about a video, grounded in its content.

    Args:
        video_summary_id: ID of videoSummaryCache entry
        user_message: The user's question
        chat_history: Previous messages [{role, content}]
        video_summary_repo: Repository for video summaries
        llm_service: LLM service for generation

    Returns:
        Assistant response text

    Raises:
        ResourceNotFoundError: If video summary not found
    """
    # Load video summary for context
    video_summary = await video_summary_repo.find_by_id(video_summary_id)
    if not video_summary:
        raise ResourceNotFoundError("Video summary not found", resource_type="video_summary")

    # Set video ID context for LLM usage tracking
    llm_video_id_var.set(video_summary.youtubeId)
    llm_feature_var.set("explain:chat")

    # Build context from video content
    video_context = _build_video_context(video_summary)

    # Build output type context for system prompt
    output_type = video_summary.output_type
    output_type_label = get_output_type_label(output_type)
    output_type_hint = get_output_type_hint(output_type)
    output_type_context = f"This is a {output_type_label} video. {output_type_hint}."

    # Load system prompt and inject video context (safe_substitute prevents format string injection)
    system_prompt = Template(load_prompt("video_chat_system")).safe_substitute(
        video_title=video_summary.title,
        video_context=video_context,
        output_type_context=output_type_context,
    )

    # Build messages for LLM (validate roles, truncate content)
    messages = []
    for msg in chat_history:
        role = msg.get("role", "")
        if role not in ("user", "assistant"):
            continue
        messages.append({"role": role, "content": str(msg.get("content", ""))[:10000]})
    # Truncate user message as defense in depth (vie-api validates at 10K)
    messages.append({"role": "user", "content": user_message[:2000]})

    # Generate response
    return await llm_service.chat_completion(system_prompt, messages, max_tokens=1000)
