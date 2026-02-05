"""YouTube video data extraction using yt-dlp.

This module provides a single-call extraction of all video data:
- Metadata (title, channel, duration, thumbnail)
- Chapters (creator-defined timestamps)
- Description (full text)
- Subtitles/captions with timestamps
- Video context (category, persona, tags)

Category detection uses weighted scoring:
- Keywords (tags + hashtags): 40%
- YouTube category: 30%
- Title patterns: 15%
- Channel patterns: 15%
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol, TypedDict, runtime_checkable

import tenacity
import yt_dlp  # type: ignore[import-untyped]

from src.config import settings
from src.models.schemas import ErrorCode
from src.exceptions import TranscriptError

logger = logging.getLogger(__name__)

# Path to detection rules
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Valid category values (matches frontend VideoCategory)
VALID_CATEGORIES: frozenset[str] = frozenset([
    'cooking', 'coding', 'fitness', 'travel', 'education',
    'podcast', 'reviews', 'gaming', 'diy', 'standard'
])


@runtime_checkable
class FastLLMProvider(Protocol):
    """Protocol for LLM providers that support fast classification.

    Used for type-safe LLM provider injection in classify_category_with_llm.
    """

    async def complete_fast(
        self,
        prompt: str,
        max_tokens: int = 50,
        timeout: float = 5.0,
    ) -> str:
        """Generate quick completion using fast model."""
        ...


# -----------------------------------------------------------------------------
# Video Context Extraction
# -----------------------------------------------------------------------------

class PersonaConfig(TypedDict):
    """Configuration for a single persona detection rule."""
    keywords: list[str]
    categories: list[str]


class PersonaRules(TypedDict):
    """Structure of persona_rules.json."""
    personas: dict[str, PersonaConfig]
    default_persona: str


class CategoryKeywords(TypedDict):
    """Keywords config for category detection."""
    primary: list[str]
    secondary: list[str]


class YouTubeCategories(TypedDict):
    """YouTube categories config for category detection."""
    primary: list[str]
    secondary: list[str]


class CategoryConfig(TypedDict):
    """Configuration for a single category detection rule."""
    keywords: CategoryKeywords
    youtube_categories: YouTubeCategories
    channel_patterns: list[str]
    title_patterns: list[str]


class DetectionConfig(TypedDict):
    """Detection configuration."""
    llm_fallback_threshold: float
    weights: dict[str, float]


class CategoryRules(TypedDict):
    """Structure of category_rules.json."""
    version: str
    detection_config: DetectionConfig
    categories: dict[str, CategoryConfig]
    default_category: str


@lru_cache(maxsize=1)
def _load_persona_rules() -> PersonaRules:
    """Load persona detection rules from JSON file.

    Returns:
        Dict with 'personas' containing keyword/category rules,
        and 'default_persona' for fallback.

    Note:
        Results are cached to avoid repeated disk reads.
    """
    path = PROMPTS_DIR / "detection" / "persona_rules.json"
    return json.loads(path.read_text())


@lru_cache(maxsize=1)
def _load_category_rules() -> CategoryRules:
    """Load category detection rules from JSON file.

    Returns:
        Dict with 'categories' containing weighted scoring rules,
        'detection_config' for thresholds and weights,
        and 'default_category' for fallback.

    Raises:
        ValueError: If required keys are missing from the config file.

    Note:
        Results are cached to avoid repeated disk reads.
    """
    path = PROMPTS_DIR / "detection" / "category_rules.json"
    data = json.loads(path.read_text())

    # Schema validation - check required top-level keys
    required_keys = {"categories", "default_category", "detection_config"}
    missing_keys = required_keys - set(data.keys())
    if missing_keys:
        raise ValueError(f"Invalid category_rules.json: missing required keys {missing_keys}")

    # Validate detection_config structure
    detection_config = data.get("detection_config", {})
    if "weights" not in detection_config:
        raise ValueError("Invalid category_rules.json: detection_config.weights is required")

    weights = detection_config.get("weights", {})
    required_weights = {"keywords", "youtube_category", "title", "channel"}
    missing_weights = required_weights - set(weights.keys())
    if missing_weights:
        raise ValueError(f"Invalid category_rules.json: missing weights {missing_weights}")

    return data


@dataclass
class VideoContext:
    """Context information extracted from video metadata.

    Category and persona are SEPARATE concerns:
    - category: Video's actual subject (cooking, coding, travel) - for frontend views
    - persona: Which LLM prompts to use - can fallback without affecting category

    Attributes:
        youtube_category: Raw YouTube category (e.g., "Science & Technology")
        category: Detected content category (e.g., "cooking", "coding", "standard")
        persona: LLM persona for summarization ("code", "recipe", "standard")
        tags: Raw tags from video metadata
        display_tags: Cleaned, deduplicated tags for UI display (max 6)
        category_confidence: Confidence score from detection (0.0-1.0)
    """
    youtube_category: str | None
    category: str  # "cooking", "coding", "travel", etc.
    persona: str  # "code", "recipe", "standard", etc.
    tags: list[str]
    display_tags: list[str]
    category_confidence: float = 1.0


def _extract_hashtags(description: str) -> list[str]:
    """Extract hashtags from video description.

    Args:
        description: The video description text

    Returns:
        List of hashtags (without the # symbol), lowercased
    """
    if not description:
        return []
    return re.findall(r'#(\w+)', description.lower())


def _detect_category(
    youtube_category: str | None,
    tags: list[str],
    hashtags: list[str],
    channel: str | None = None,
    title: str | None = None,
) -> tuple[str, float]:
    """Detect video category using weighted scoring.

    Scoring weights (from category_rules.json):
    - Keywords (tags + hashtags): 40%
    - YouTube category: 30%
    - Title patterns: 15%
    - Channel patterns: 15%

    Args:
        youtube_category: YouTube category name (e.g., "Entertainment")
        tags: Video tags from metadata
        hashtags: Hashtags extracted from description
        channel: Channel name (optional, for pattern matching)
        title: Video title (optional, for pattern matching)

    Returns:
        Tuple of (category, confidence_score)
        - category: detected category ('cooking', 'coding', 'standard', etc.)
        - confidence: 0.0 to 1.0
    """
    rules = _load_category_rules()
    weights = rules.get("detection_config", {}).get("weights", {})

    # Normalize weights
    keyword_weight = weights.get("keywords", 0.40)
    yt_category_weight = weights.get("youtube_category", 0.30)
    title_weight = weights.get("title", 0.15)
    channel_weight = weights.get("channel", 0.15)

    # Combine tags and hashtags for keyword matching
    all_terms = set(t.lower() for t in tags) | set(hashtags)
    title_lower = (title or "").lower()
    channel_lower = (channel or "").lower()

    # Score each category
    category_scores: dict[str, float] = {}

    for cat_name, config in rules.get("categories", {}).items():
        score = 0.0

        # 1. Keyword scoring (weight: 0.40)
        keywords = config.get("keywords", {})
        primary_keywords = set(k.lower() for k in keywords.get("primary", []))
        secondary_keywords = set(k.lower() for k in keywords.get("secondary", []))

        primary_matches = len(all_terms & primary_keywords)
        secondary_matches = len(all_terms & secondary_keywords)

        if primary_keywords or secondary_keywords:
            max_possible = len(primary_keywords) + len(secondary_keywords) * 0.5
            keyword_score = (primary_matches + secondary_matches * 0.5) / max_possible if max_possible > 0 else 0
            score += min(keyword_score, 1.0) * keyword_weight

        # 2. YouTube category scoring (weight: 0.30)
        if youtube_category:
            yt_cats = config.get("youtube_categories", {})
            primary_cats = yt_cats.get("primary", [])
            secondary_cats = yt_cats.get("secondary", [])

            if youtube_category in primary_cats:
                score += yt_category_weight
            elif youtube_category in secondary_cats:
                score += yt_category_weight * 0.5

        # 3. Title pattern matching (weight: 0.15)
        # Limit title length to prevent ReDoS attacks
        title_patterns = config.get("title_patterns", [])
        title_safe = title_lower[:500] if title_lower else ""
        if title_safe and title_patterns:
            for pattern in title_patterns:
                try:
                    if re.search(pattern, title_safe):
                        score += title_weight
                        break
                except re.error:
                    logger.warning(f"Invalid regex pattern in category rules: {pattern}")
                    continue

        # 4. Channel pattern matching (weight: 0.15)
        channel_patterns = config.get("channel_patterns", [])
        if channel_lower and channel_patterns:
            for pattern in channel_patterns:
                if pattern.lower() in channel_lower:
                    score += channel_weight
                    break

        category_scores[cat_name] = score

    # Find best category
    if not category_scores:
        return rules.get("default_category", "standard"), 0.0

    best_category = max(category_scores, key=category_scores.get)  # type: ignore[arg-type]
    best_score = category_scores[best_category]

    # If score is too low, return standard
    if best_score < 0.1:
        return rules.get("default_category", "standard"), best_score

    return best_category, best_score


def _select_persona(category: str) -> str:
    """Select LLM persona based on detected category.

    The persona determines which prompt templates and examples are used
    for summarization. Category is the user-facing classification,
    persona is the internal LLM configuration.

    Args:
        category: Detected video category ('cooking', 'coding', etc.)

    Returns:
        Persona string for LLM prompts ('recipe', 'code', 'standard', etc.)
    """
    # Map category to persona
    category_to_persona = {
        'cooking': 'recipe',
        'coding': 'code',
        'podcast': 'interview',
        'reviews': 'review',
        'fitness': 'fitness',
        'travel': 'travel',
        'education': 'education',
        'gaming': 'standard',  # No gaming-specific persona yet
        'diy': 'standard',     # No DIY-specific persona yet
    }
    return category_to_persona.get(category, 'standard')


async def classify_category_with_llm(
    title: str,
    channel: str,
    tags: list[str],
    description: str,
    llm_provider: FastLLMProvider,
) -> str:
    """Use LLM fast model to classify video category when rule-based scoring is uncertain.

    Called only when rule-based confidence < threshold (0.4).
    Uses fast/cheap model (e.g., Haiku) with ~1-2s latency.

    Args:
        title: Video title
        channel: Channel name
        tags: Video tags
        description: Video description (truncated)
        llm_provider: LLMProvider instance for making the call

    Returns:
        Detected category ('cooking', 'coding', 'travel', etc.)
        Falls back to 'standard' on error or invalid response.
    """
    # Build concise classification prompt
    tags_str = ", ".join(tags[:15]) if tags else "none"
    desc_truncated = (description[:500] + "...") if len(description) > 500 else description

    prompt = f"""Classify this YouTube video into exactly ONE category.

Title: {title[:200]}
Channel: {channel[:100] if channel else 'Unknown'}
Tags: {tags_str}
Description: {desc_truncated}

Categories (pick ONE):
- cooking: Recipes, cooking tutorials, food preparation
- coding: Programming tutorials, software development
- fitness: Workouts, exercise routines, gym content
- travel: Travel vlogs, destination guides
- education: Educational content, lectures, explainers
- podcast: Interviews, conversations, podcasts
- reviews: Product reviews, unboxing, comparisons
- gaming: Gameplay, walkthroughs, gaming content
- diy: DIY projects, crafts, building
- standard: None of the above

Respond with ONLY the category name, nothing else."""

    try:
        response = await llm_provider.complete_fast(prompt, max_tokens=20, timeout=5.0)
        category = response.strip().lower()

        # Validate response
        if category in VALID_CATEGORIES:
            logger.info(f"LLM classified category: {category}")
            return category

        logger.warning(f"LLM returned invalid category '{category}', falling back to standard")
        return "standard"

    except Exception as e:
        logger.warning(f"LLM category classification failed: {e}, falling back to standard")
        return "standard"


def get_llm_fallback_threshold() -> float:
    """Get the confidence threshold for LLM fallback.

    Returns:
        Threshold value (default 0.4). If category detection confidence
        is below this, LLM fallback should be triggered.
    """
    rules = _load_category_rules()
    return rules.get("detection_config", {}).get("llm_fallback_threshold", 0.4)


def _determine_persona(
    category: str | None,
    tags: list[str],
    hashtags: list[str],
) -> str:
    """DEPRECATED: Use _detect_category() + _select_persona() instead.

    This function uses AND logic which fails when YouTube category
    doesn't match even if keywords are strong.

    Kept for backward compatibility with tests.
    """
    rules = _load_persona_rules()

    # Combine tags and hashtags for keyword matching
    all_terms = set(t.lower() for t in tags) | set(hashtags)

    # Check each persona defined in rules
    for persona_name, config in rules.get("personas", {}).items():
        keywords = set(config.get("keywords", []))
        categories = set(config.get("categories", []))

        # Must be in matching category AND have matching keywords
        is_matching_category = category in categories if category else False
        has_matching_keywords = bool(all_terms & keywords)

        if is_matching_category and has_matching_keywords:
            return persona_name

    # Default to standard persona
    return rules.get("default_persona", "standard")


def _build_display_tags(
    tags: list[str],
    hashtags: list[str],
    max_tags: int = 6,
    min_length: int = 3,
) -> list[str]:
    """Build cleaned, deduplicated display tags for UI.

    Merges video tags and hashtags, removes duplicates, filters by length,
    and limits to a reasonable number for display.

    Args:
        tags: Video tags from metadata
        hashtags: Hashtags extracted from description
        max_tags: Maximum number of tags to return (default 6)
        min_length: Minimum character length for tags (default 3)

    Returns:
        List of cleaned display tags, limited to max_tags
    """
    # Normalize and deduplicate
    seen: set[str] = set()
    display_tags: list[str] = []

    # Process tags first (they're usually more relevant)
    for tag in tags:
        normalized = tag.lower().strip()
        if len(normalized) >= min_length and normalized not in seen:
            seen.add(normalized)
            # Keep original casing for display
            display_tags.append(tag.strip())

    # Then add hashtags that aren't duplicates
    for hashtag in hashtags:
        normalized = hashtag.lower().strip()
        if len(normalized) >= min_length and normalized not in seen:
            seen.add(normalized)
            # Capitalize first letter for display consistency
            display_tags.append(hashtag.capitalize())

    return display_tags[:max_tags]


def extract_video_context(
    info: dict[str, Any],
    description: str,
    channel: str | None = None,
    title: str | None = None,
) -> VideoContext:
    """Extract video context from yt-dlp info dict.

    Uses weighted scoring to detect category independently from persona.
    Category detection is more lenient (OR-like) while persona selection
    is a simple mapping.

    Args:
        info: The yt-dlp info dictionary
        description: Video description text (for hashtag extraction)
        channel: Channel name (optional, improves detection accuracy)
        title: Video title (optional, improves detection accuracy)

    Returns:
        VideoContext with category, persona, and tags
    """
    # Extract category (yt-dlp returns categories as a list)
    categories = info.get('categories', [])
    youtube_category = categories[0] if categories else None

    # Extract tags
    tags = info.get('tags', []) or []

    # Extract hashtags from description
    hashtags = _extract_hashtags(description)

    # Get channel and title from info if not provided
    if channel is None:
        channel = info.get('uploader') or info.get('channel')
    if title is None:
        title = info.get('title')

    # Detect category using weighted scoring (NEW)
    category, confidence = _detect_category(
        youtube_category=youtube_category,
        tags=tags,
        hashtags=hashtags,
        channel=channel,
        title=title,
    )

    # Select persona based on detected category (NEW)
    persona = _select_persona(category)

    # Build display tags
    display_tags = _build_display_tags(tags, hashtags)

    logger.info(
        f"Video context: category={category} (confidence={confidence:.2f}), "
        f"persona={persona}, youtube_category={youtube_category}, "
        f"tags_count={len(tags)}, hashtags_count={len(hashtags)}"
    )

    return VideoContext(
        youtube_category=youtube_category,
        category=category,
        persona=persona,
        tags=tags,
        display_tags=display_tags,
        category_confidence=confidence,
    )


# -----------------------------------------------------------------------------
# Video Data Classes
# -----------------------------------------------------------------------------

@dataclass
class Chapter:
    """A chapter/section from the video."""
    start_time: float  # seconds
    end_time: float    # seconds
    title: str


@dataclass
class SubtitleSegment:
    """A single subtitle/caption segment."""
    text: str
    start: float      # seconds
    duration: float   # seconds


@dataclass
class VideoData:
    """Complete video data extracted from yt-dlp.

    Attributes:
        video_id: YouTube video ID
        title: Video title
        channel: Channel/uploader name
        duration: Video duration in seconds
        thumbnail_url: URL to video thumbnail
        description: Full video description text
        chapters: Creator-defined chapters with timestamps
        subtitles: Subtitle segments with timestamps
        upload_date: Upload date in YYYYMMDD format
        context: Video context with category, persona, and tags
    """
    video_id: str
    title: str
    channel: str
    duration: int                            # exact seconds
    thumbnail_url: str | None
    description: str
    chapters: list[Chapter] = field(default_factory=list)
    subtitles: list[SubtitleSegment] = field(default_factory=list)
    upload_date: str | None = None           # YYYYMMDD format
    context: VideoContext | None = None      # Phase 1: Video context extraction

    @property
    def has_chapters(self) -> bool:
        """Check if video has creator-defined chapters."""
        return len(self.chapters) > 0

    @property
    def transcript_text(self) -> str:
        """Get full transcript as plain text."""
        return " ".join(seg.text for seg in self.subtitles)

    def get_chapter_transcript(self, chapter_index: int) -> str:
        """Get transcript text for a specific chapter."""
        if chapter_index < 0 or chapter_index >= len(self.chapters):
            return ""

        chapter = self.chapters[chapter_index]
        segments = [
            seg for seg in self.subtitles
            if chapter.start_time <= seg.start < chapter.end_time
        ]
        return " ".join(seg.text for seg in segments)


def _build_yt_dlp_opts(use_proxy: bool = False) -> dict[str, Any]:
    """Build yt-dlp options with optional proxy configuration.

    Args:
        use_proxy: Whether to use Webshare proxy (default False for direct connection)
    """
    opts: dict[str, Any] = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        # Subtitle options
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en', 'en-US', 'en-GB'],
        'subtitlesformat': 'json3',  # Best format for parsing
    }

    # Configure Webshare proxy only if requested and credentials available
    if use_proxy and settings.WEBSHARE_PROXY_USERNAME and settings.WEBSHARE_PROXY_PASSWORD:
        proxy_url = (
            f"http://{settings.WEBSHARE_PROXY_USERNAME}:"
            f"{settings.WEBSHARE_PROXY_PASSWORD}@p.webshare.io:80"
        )
        opts['proxy'] = proxy_url
        logger.debug("Using Webshare proxy for yt-dlp")

    return opts


def _parse_chapters(info: dict[str, Any]) -> list[Chapter]:
    """Parse chapters from yt-dlp info dict."""
    chapters = []
    raw_chapters = info.get('chapters') or []

    for ch in raw_chapters:
        start = ch.get('start_time', 0)
        end = ch.get('end_time', start)
        title = ch.get('title', 'Untitled')

        chapters.append(Chapter(
            start_time=float(start),
            end_time=float(end),
            title=title.strip(),
        ))

    return chapters

def _fetch_subtitles_from_url(url: str) -> list[SubtitleSegment]:
    """Fetch and parse subtitles from a URL (json3 format)."""
    import json
    from urllib.request import urlopen, Request

    segments: list[SubtitleSegment] = []

    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))

        # json3 format has 'events' array
        events = data.get('events', [])

        for event in events:
            # Skip non-speech events
            if 'segs' not in event:
                continue

            start_ms = event.get('tStartMs', 0)
            duration_ms = event.get('dDurationMs', 0)

            # Combine segment texts
            text_parts = []
            for seg in event.get('segs', []):
                if 'utf8' in seg:
                    text_parts.append(seg['utf8'])

            text = ''.join(text_parts).strip()
            if text and text != '\n':
                segments.append(SubtitleSegment(
                    text=text,
                    start=start_ms / 1000.0,
                    duration=duration_ms / 1000.0,
                ))

    except Exception as e:
        logger.warning(f"Failed to fetch subtitles from URL: {e}")

    return segments


def _clean_subtitle_text(text: str) -> str:
    """Clean subtitle text by removing artifacts."""
    # Remove common artifacts
    text = re.sub(r'\[Music\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[Applause\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[Laughter\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'♪.*?♪', '', text)  # Music notes

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


# Issue #15: Retry logic for transient yt-dlp failures
@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=2, max=10),
    retry=tenacity.retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    before_sleep=lambda retry_state: logger.warning(
        f"yt-dlp extraction retry {retry_state.attempt_number} after error: {retry_state.outcome.exception()}"
    ),
)
def _extract_with_retry(url: str, opts: dict[str, Any]) -> dict[str, Any] | None:
    """Extract video info with retry logic for transient failures."""
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _extract_video_data_sync(video_id: str) -> VideoData:
    """
    Extract video data using yt-dlp (synchronous).

    This function extracts all available video metadata in a single call:
    - Title, channel, duration, thumbnail
    - Creator-defined chapters
    - Full description text
    - Subtitles with timestamps
    - Video context (category, persona, tags)

    Args:
        video_id: YouTube video ID

    Returns:
        VideoData with all extracted information

    Raises:
        TranscriptError: If video is unavailable or extraction fails
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    # Issue #15: Try direct connection first with retry, fallback to proxy if needed
    info = None
    last_error = None

    for use_proxy in [False, True]:
        opts = _build_yt_dlp_opts(use_proxy=use_proxy)
        try:
            info = _extract_with_retry(url, opts)
            if info:
                if use_proxy:
                    logger.info(f"Video {video_id}: extracted via proxy")
                break
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            # If already using proxy or error is not proxy-related, continue to next attempt
            if use_proxy or 'proxy' not in error_msg:
                continue
            # Error might be proxy-related, will retry with proxy on next iteration
            logger.debug(f"Direct connection failed, trying proxy: {e}")

    if not info:
        if last_error:
            raise last_error
        raise TranscriptError(
            "Failed to extract video information",
            ErrorCode.VIDEO_UNAVAILABLE
        )

    # Check for live streams
    if info.get('is_live'):
        raise TranscriptError(
            "Live streams are not supported",
            ErrorCode.LIVE_STREAM
        )

    # Extract basic metadata
    title = info.get('title', 'Unknown Title')
    channel = info.get('uploader') or info.get('channel') or 'Unknown Channel'
    duration = int(info.get('duration') or 0)
    description = info.get('description') or ''
    upload_date = info.get('upload_date')

    # Get best thumbnail
    thumbnails = info.get('thumbnails', [])
    thumbnail_url = None
    if thumbnails:
        # Prefer maxresdefault or high quality
        for thumb in reversed(thumbnails):  # Usually sorted by quality
            if thumb.get('url'):
                thumbnail_url = thumb['url']
                break

    # If no thumbnail found, use standard YouTube thumbnail URL
    if not thumbnail_url:
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

    # Parse chapters
    chapters = _parse_chapters(info)
    logger.info(f"Video {video_id}: found {len(chapters)} chapters")

    # Parse subtitles - try to get from json3 format
    subtitles: list[SubtitleSegment] = []

    # Check automatic captions first, then manual
    auto_captions = info.get('automatic_captions', {})
    manual_captions = info.get('subtitles', {})

    subtitle_url = None
    for lang in ['en', 'en-US', 'en-GB']:
        for captions in [manual_captions, auto_captions]:
            if lang in captions:
                for fmt in captions[lang]:
                    if fmt.get('ext') == 'json3' and fmt.get('url'):
                        subtitle_url = fmt['url']
                        break
                if subtitle_url:
                    break
        if subtitle_url:
            break

    if subtitle_url:
        subtitles = _fetch_subtitles_from_url(subtitle_url)
        # Clean subtitle text
        for seg in subtitles:
            seg.text = _clean_subtitle_text(seg.text)
        logger.info(f"Video {video_id}: extracted {len(subtitles)} subtitle segments")
    else:
        logger.warning(f"Video {video_id}: no subtitles URL found")

    # Phase 1: Extract video context (category, persona, tags)
    context = extract_video_context(info, description)
    logger.info(f"Video {video_id}: persona={context.persona}, tags={len(context.display_tags)}")

    return VideoData(
        video_id=video_id,
        title=title,
        channel=channel,
        duration=duration,
        thumbnail_url=thumbnail_url,
        description=description,
        chapters=chapters,
        subtitles=subtitles,
        upload_date=upload_date,
        context=context,
    )


async def extract_video_data(video_id: str) -> VideoData:
    """
    Extract video data using yt-dlp (async wrapper).

    Runs the blocking yt-dlp call in a thread pool to avoid
    blocking the event loop.

    This function extracts all available video metadata in a single call:
    - Title, channel, duration (exact seconds), thumbnail
    - Creator-defined chapters (timestamps + titles)
    - Full description text
    - Subtitles/captions with timestamps
    - Video context (category, persona, tags)

    Args:
        video_id: YouTube video ID

    Returns:
        VideoData with all extracted information

    Raises:
        TranscriptError: If video is unavailable or extraction fails

    Example:
        video_data = await extract_video_data("dQw4w9WgXcQ")
        # video_data.title -> "Rick Astley - Never Gonna Give You Up"
        # video_data.duration -> 212 (seconds)
        # video_data.has_chapters -> True
        # video_data.chapters[0].start_time -> 0
        # video_data.chapters[0].title -> "Intro"
    """
    return await asyncio.to_thread(_extract_video_data_sync, video_id)
