"""explain_auto tool: Generate cached documentation for video sections or concepts."""

from src.config import settings
from src.exceptions import ResourceNotFoundError, ValidationError
from src.repositories.base import ExpansionRepositoryProtocol, VideoSummaryRepositoryProtocol
from src.services.llm import LLMService


async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str,
    video_summary_repo: VideoSummaryRepositoryProtocol,
    expansion_repo: ExpansionRepositoryProtocol,
    llm_service: LLMService,
) -> str:
    """Generate detailed documentation for a video section or concept.

    Results are cached in systemExpansionCache and reused across all users.

    Args:
        video_summary_id: ID of videoSummaryCache entry
        target_type: "section" or "concept"
        target_id: UUID of the section or concept
        video_summary_repo: Repository for video summaries
        expansion_repo: Repository for expansion cache
        llm_service: LLM service for generation

    Returns:
        Markdown documentation

    Raises:
        ResourceNotFoundError: If video summary, section, or concept not found
        ValidationError: If target_type is invalid
    """
    # 1. Validate target_type early
    if target_type not in ["section", "concept"]:
        raise ValidationError(f"Invalid target type: {target_type}")

    # 2. Check cache first
    cached = await expansion_repo.find_by_target(video_summary_id, target_type, target_id)
    if cached:
        return cached.content

    # 3. Load video summary
    video_summary = await video_summary_repo.find_by_id(video_summary_id)
    if not video_summary:
        raise ResourceNotFoundError("Video summary not found", resource_type="video_summary")

    # 4. Find target and build context
    if target_type == "section":
        target = next((s for s in video_summary.sections if s.id == target_id), None)
        if not target:
            raise ResourceNotFoundError("Section not found", resource_type="section")

        context = {
            "video_title": video_summary.title,
            "youtube_id": video_summary.youtubeId,
            "timestamp": target.timestamp,
            "title": target.title,
            "summary": target.summary,
            "bullets": target.bullets,
        }
        template = "explain_section"

    else:  # target_type == "concept"
        target = next((c for c in video_summary.concepts if c.id == target_id), None)
        if not target:
            raise ResourceNotFoundError("Concept not found", resource_type="concept")

        context = {
            "video_title": video_summary.title,
            "youtube_id": video_summary.youtubeId,
            "name": target.name,
            "definition": target.definition or "No definition provided",
        }
        template = "explain_concept"

    # 5. Generate with LLM
    content = await llm_service.generate_expansion(template, context)

    # 6. Save to cache
    await expansion_repo.save(
        video_summary_id=video_summary_id,
        target_type=target_type,
        target_id=target_id,
        context=context,
        content=content,
        model=settings.llm_model,
    )

    return content
