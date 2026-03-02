"""video_chat tool: Chat about a specific video grounded in its content."""

from string import Template

from llm_common.context import llm_video_id_var, llm_feature_var
from src.exceptions import ResourceNotFoundError
from src.repositories.base import VideoSummaryRepositoryProtocol
from src.schemas import VideoSummary
from src.services.llm import LLMService, load_prompt


def _build_video_context(video_summary: VideoSummary) -> str:
    """Build a context string from video summary for the LLM."""
    parts = [f"# Video: {video_summary.title}"]

    # Add chapter summaries
    if video_summary.sections:
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

    # Load system prompt and inject video context (safe_substitute prevents format string injection)
    system_prompt = Template(load_prompt("video_chat_system")).safe_substitute(
        video_title=video_summary.title,
        video_context=video_context,
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
