"""Description analyzer service using Claude Haiku for fast extraction.

This module extracts structured data from YouTube video descriptions:
- Links (GitHub, docs, articles, tools)
- Resources (courses, books, named materials)
- Related videos (YouTube links mentioned)
- Timestamps (manual chapter markers)
- Social links (creator's profiles)
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


@dataclass
class DescriptionLink:
    """A link extracted from the description."""
    url: str
    type: str  # github, documentation, article, tool, course, other
    label: str


@dataclass
class Resource:
    """A named resource from the description."""
    name: str
    url: str


@dataclass
class RelatedVideo:
    """A related YouTube video mentioned in description."""
    title: str
    url: str


@dataclass
class Timestamp:
    """A timestamp/chapter marker from description."""
    time: str  # "0:00" format
    label: str


@dataclass
class SocialLink:
    """A social media link from description."""
    platform: str  # twitter, discord, github, linkedin, patreon, other
    url: str


@dataclass
class DescriptionAnalysis:
    """Complete analysis of a video description."""
    links: list[DescriptionLink] = field(default_factory=list)
    resources: list[Resource] = field(default_factory=list)
    related_videos: list[RelatedVideo] = field(default_factory=list)
    timestamps: list[Timestamp] = field(default_factory=list)
    social_links: list[SocialLink] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "links": [{"url": l.url, "type": l.type, "label": l.label} for l in self.links],
            "resources": [{"name": r.name, "url": r.url} for r in self.resources],
            "relatedVideos": [{"title": v.title, "url": v.url} for v in self.related_videos],
            "timestamps": [{"time": t.time, "label": t.label} for t in self.timestamps],
            "socialLinks": [{"platform": s.platform, "url": s.url} for s in self.social_links],
        }

    @property
    def has_content(self) -> bool:
        """Check if any content was extracted."""
        return bool(
            self.links or self.resources or self.related_videos or
            self.timestamps or self.social_links
        )


def _parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response text.

    Returns empty dict on failure, but logs detailed error for debugging.
    """
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start < 0 or end <= start:
            logger.warning(f"No JSON object found in response (length={len(text)})")
            return {}
        return json.loads(text[start:end])
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON response: {e}, text preview: {text[:200]}...")
    return {}


def _analyze_description_sync(description: str, client: anthropic.Anthropic) -> DescriptionAnalysis:
    """Analyze description synchronously using Haiku."""
    if not description or len(description.strip()) < 20:
        logger.debug("Description too short for analysis")
        return DescriptionAnalysis()

    # Limit description length to avoid token limits
    max_chars = 5000
    if len(description) > max_chars:
        description = description[:max_chars] + "..."

    try:
        prompt_template = load_prompt("description_analysis")
        prompt = prompt_template.format(description=description)

        response = client.messages.create(
            model=settings.ANTHROPIC_HAIKU_MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        result_text = response.content[0].text
        data = _parse_json_response(result_text)

        # Parse into dataclasses
        analysis = DescriptionAnalysis(
            links=[
                DescriptionLink(url=l.get("url", ""), type=l.get("type", "other"), label=l.get("label", ""))
                for l in data.get("links", [])
                if l.get("url")
            ],
            resources=[
                Resource(name=r.get("name", ""), url=r.get("url", ""))
                for r in data.get("resources", [])
                if r.get("name") and r.get("url")
            ],
            related_videos=[
                RelatedVideo(title=v.get("title", ""), url=v.get("url", ""))
                for v in data.get("relatedVideos", [])
                if v.get("url")
            ],
            timestamps=[
                Timestamp(time=t.get("time", ""), label=t.get("label", ""))
                for t in data.get("timestamps", [])
                if t.get("time") and t.get("label")
            ],
            social_links=[
                SocialLink(platform=s.get("platform", "other"), url=s.get("url", ""))
                for s in data.get("socialLinks", [])
                if s.get("url")
            ],
        )

        logger.info(
            f"Description analysis complete: {len(analysis.links)} links, "
            f"{len(analysis.resources)} resources, {len(analysis.related_videos)} videos, "
            f"{len(analysis.timestamps)} timestamps, {len(analysis.social_links)} social"
        )

        return analysis

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error during description analysis: {e}")
        return DescriptionAnalysis()
    except Exception as e:
        logger.error(f"Error analyzing description: {e}")
        return DescriptionAnalysis()


async def analyze_description(
    description: str,
    client: anthropic.Anthropic | None = None
) -> DescriptionAnalysis:
    """
    Analyze a video description to extract structured data using Claude Haiku.

    This is a fast extraction (~1-2 seconds) that runs in parallel with other
    summarization tasks.

    Args:
        description: The full video description text
        client: Optional Anthropic client (creates one if not provided)

    Returns:
        DescriptionAnalysis with extracted links, resources, timestamps, etc.

    Example:
        analysis = await analyze_description(video_data.description)
        if analysis.has_content:
            print(f"Found {len(analysis.links)} links")
    """
    if client is None:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    return await asyncio.to_thread(_analyze_description_sync, description, client)
