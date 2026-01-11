"""explain_auto tool: Generate cached documentation for video sections or concepts."""

from src.config import settings
from src.exceptions import ResourceNotFoundError, ValidationError
from src.services import mongodb
from src.services.llm import generate_expansion


async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str,
) -> str:
    """Generate detailed documentation for a video section or concept.

    Results are cached in systemExpansionCache and reused across all users.

    Args:
        video_summary_id: ID of videoSummaryCache entry
        target_type: "section" or "concept"
        target_id: UUID of the section or concept

    Returns:
        Markdown documentation

    Raises:
        ResourceNotFoundError: If video summary, section, or concept not found
        ValidationError: If target_type is invalid
    """
    # 1. Check cache first
    cached = mongodb.get_expansion(video_summary_id, target_type, target_id)
    if cached:
        return cached["content"]

    # 2. Load video summary
    video_summary = mongodb.get_video_summary(video_summary_id)
    if not video_summary:
        raise ResourceNotFoundError("Video summary not found", resource_type="video_summary")

    summary = video_summary.get("summary", {})

    # 3. Find target and build context
    if target_type == "section":
        sections = summary.get("sections", [])
        target = next((s for s in sections if s["id"] == target_id), None)

        if not target:
            raise ResourceNotFoundError("Section not found", resource_type="section")

        context = {
            "video_title": video_summary.get("title", "Unknown"),
            "youtube_id": video_summary.get("youtubeId"),
            "timestamp": target.get("timestamp", "00:00"),
            "title": target.get("title", ""),
            "summary": target.get("summary", ""),
            "bullets": target.get("bullets", []),
        }
        template = "explain_section"

    elif target_type == "concept":
        concepts = summary.get("concepts", [])
        target = next((c for c in concepts if c["id"] == target_id), None)

        if not target:
            raise ResourceNotFoundError("Concept not found", resource_type="concept")

        context = {
            "video_title": video_summary.get("title", "Unknown"),
            "youtube_id": video_summary.get("youtubeId"),
            "name": target.get("name", ""),
            "definition": target.get("definition", "No definition provided"),
        }
        template = "explain_concept"

    else:
        raise ValidationError(f"Invalid target type: {target_type}")

    # 4. Generate with LLM
    content = await generate_expansion(template, context)

    # 5. Save to cache
    mongodb.save_expansion(
        video_summary_id=video_summary_id,
        target_type=target_type,
        target_id=target_id,
        context=context,
        content=content,
        model=settings.ANTHROPIC_MODEL,
    )

    return content
