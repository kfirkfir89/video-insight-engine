"""explain_auto tool: Generate cached documentation for video sections or concepts."""

from llm_common.context import llm_video_id_var, llm_feature_var
from src.config import settings
from src.exceptions import ResourceNotFoundError, ValidationError
from src.repositories.base import ExpansionRepositoryProtocol, VideoSummaryRepositoryProtocol
from src.services.llm import LLMService
from src.utils.content_extractor import extract_summary_from_content, extract_bullets_from_content
from src.utils.output_type import get_output_type_label, get_output_type_hint


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

    # Set video ID context for LLM usage tracking
    llm_video_id_var.set(video_summary.youtubeId)
    llm_feature_var.set(f"explain:{target_type}")

    # Resolve output type label and framing hint
    output_type = video_summary.output_type
    output_type_label = get_output_type_label(output_type)
    output_type_hint = get_output_type_hint(output_type)

    # 4. Find target and build context
    if target_type == "section":
        # Try V1 sections first, then typed output data sections
        target = next((s for s in video_summary.sections if s.id == target_id), None)

        if target:
            # V1: section with content blocks
            content = target.content or []
            summary = extract_summary_from_content(content)
            bullets = extract_bullets_from_content(content)
            section_title = target.title
            section_timestamp = target.timestamp
        elif video_summary.output_data and isinstance(video_summary.output_data, dict):
            # Intent-driven pipeline: section ID maps to a key in output_data
            section_data = video_summary.output_data.get(target_id)
            if section_data is None:
                raise ResourceNotFoundError("Section not found", resource_type="section")
            # Build summary/bullets from typed output section
            section_title = target_id.replace("_", " ").title()
            section_timestamp = "00:00"
            if isinstance(section_data, str):
                summary = section_data[:500]
                bullets = []
            elif isinstance(section_data, list):
                summary = ""
                bullets = []
                for item in section_data[:10]:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("title") or item.get("name") or str(item)
                        bullets.append(str(text)[:200])
                    elif isinstance(item, str):
                        bullets.append(item[:200])
            elif isinstance(section_data, dict):
                summary = section_data.get("description", "") or section_data.get("text", "")
                bullets = []
            else:
                summary = str(section_data)[:500]
                bullets = []
        else:
            raise ResourceNotFoundError("Section not found", resource_type="section")

        context = {
            "video_title": video_summary.title,
            "youtube_id": video_summary.youtubeId,
            "timestamp": section_timestamp,
            "title": section_title,
            "summary": summary,
            "bullets": bullets,
            "output_type_label": output_type_label,
            "output_type_hint": output_type_hint,
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
            "output_type_label": output_type_label,
            "output_type_hint": output_type_hint,
        }
        template = "explain_concept"

    # 5. Generate with LLM (per-type token limits: concept=800, section=1500)
    max_tokens = 800 if target_type == "concept" else 1500
    content = await llm_service.generate_expansion(template, context, max_tokens=max_tokens)

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
