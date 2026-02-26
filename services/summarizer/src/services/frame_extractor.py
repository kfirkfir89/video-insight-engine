"""Extract video frames at specific timestamps using ffmpeg.

Used to populate visual blocks with actual video frames instead of the
generic YouTube thumbnail. ffmpeg is already available in the Docker image.

Architecture:
- Stream URL fetching is in src.services.stream_url (yt-dlp --get-url)
- extract_frame(): ffmpeg -ss (fast seek) to grab a single JPEG frame -> bytes
- extract_frames_for_blocks(): orchestrates extract -> S3 upload -> presigned URL

Security:
- YouTube IDs are validated against a strict regex (^[a-zA-Z0-9_-]{11}$)
- Timestamps are clamped to [0, 86400] to reject hallucinated LLM values
"""

import asyncio
import logging
import os
import tempfile
from dataclasses import dataclass

from src.config import settings
from src.services.s3_client import s3_client
from src.services.stream_url import get_video_stream_url
from src.utils.constants import YOUTUBE_ID_RE

logger = logging.getLogger(__name__)

# Optional image dedup dependency (requires Pillow)
try:
    from src.services.image_dedup import compute_ahash, is_duplicate, is_mostly_black
    _HAS_IMAGE_DEDUP = True
except ImportError:
    _HAS_IMAGE_DEDUP = False


def _frame_s3_key(youtube_id: str, timestamp_seconds: int) -> str:
    """Generate S3 key for a video frame."""
    return f"videos/{youtube_id}/frames/{timestamp_seconds}.jpg"


@dataclass
class FrameExtractionResult:
    """Result of a single frame extraction attempt."""

    idx: int
    ts: int
    frame_bytes: bytes | None
    cached_in_s3: bool = False
    frame_idx: int | None = None  # None = single-frame, int = index in frames[]


_MAX_CONCURRENT_EXTRACTIONS = 3


_MIN_FRAME_BYTES = 5 * 1024  # 5KB — black/blank frames are typically <3KB
_MAX_TIMESTAMP_SECONDS = 86400  # 24 hours — reject absurd LLM-generated values
_TOTAL_EXTRACTION_TIMEOUT = 120.0  # 2 minutes for all frames in a chapter


async def extract_frame(
    video_url: str,
    timestamp_seconds: int,
) -> bytes | None:
    """Extract a single JPEG frame at the given timestamp using ffmpeg.

    Uses -ss before -i for fast protocol-level seeking (~1-3s per frame).
    Writes to a temporary file and returns bytes. Temp file is always cleaned up.

    Returns frame bytes on success, None on failure.
    """
    if timestamp_seconds < 0 or timestamp_seconds > _MAX_TIMESTAMP_SECONDS:
        logger.warning("Timestamp out of bounds (%d), skipping frame extraction", timestamp_seconds)
        return None

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".jpg")
    os.close(tmp_fd)

    try:
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-ss", str(timestamp_seconds),
                "-i", video_url,
                "-vframes", "1",
                "-q:v", "2",
                "-y",
                tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except Exception as e:
            logger.warning("Frame extraction error at %ds: %s", timestamp_seconds, e)
            return None

        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()  # drain pipes
            logger.warning("ffmpeg timed out extracting frame at %ds", timestamp_seconds)
            return None

        if proc.returncode == 0 and os.path.exists(tmp_path):
            size = os.path.getsize(tmp_path)
            if size > 0:
                if size < _MIN_FRAME_BYTES:
                    logger.debug("Frame at %ds too small (%d bytes), likely blank", timestamp_seconds, size)
                    return None
                with open(tmp_path, "rb") as f:
                    frame_bytes = f.read()
                logger.debug("Extracted frame at %ds (%.1fKB)", timestamp_seconds, size / 1024)
                return frame_bytes

        logger.warning(
            "ffmpeg failed for ts=%ds (rc=%s): %s",
            timestamp_seconds, proc.returncode, stderr.decode()[-200:] if stderr else "no output",
        )
        return None
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def _upload_frame(s3_key: str, frame_bytes: bytes) -> str | None:
    """Upload frame bytes to S3.

    Returns the s3_key on success, None on failure.
    """
    try:
        await s3_client.put_bytes(s3_key, frame_bytes, content_type="image/jpeg")
        return s3_key
    except Exception as e:
        logger.warning("Failed to upload frame to S3 (%s): %s", s3_key, e)
        return None


def _compute_frame_hash(frame_bytes: bytes) -> int | None:
    """Compute perceptual hash for a frame. Returns None on failure."""
    if not _HAS_IMAGE_DEDUP:
        return None
    try:
        return compute_ahash(frame_bytes)
    except Exception as e:
        logger.debug("Frame hash computation failed: %s", e)
        return None


def _check_dedup(
    frame_bytes: bytes,
    s3_key: str,
    frame_hashes: dict[int, str],
    precomputed_hash: int | None = None,
) -> str | None:
    """Check perceptual hash against known frames. Returns existing s3_key if duplicate."""
    if not _HAS_IMAGE_DEDUP:
        return None
    try:
        h = precomputed_hash if precomputed_hash is not None else _compute_frame_hash(frame_bytes)
        if h is None:
            return None
        for known_hash, known_key in frame_hashes.items():
            if is_duplicate(h, known_hash):
                return known_key
        frame_hashes[h] = s3_key
    except Exception as e:
        logger.debug("Frame dedup check failed for %s: %s", s3_key, e)
    return None


def _spread_clustered_timestamps(
    jobs: list[tuple[int, int | None, int]],
    chapter_start: int | None,
    chapter_end: int | None,
    min_spacing: int,
) -> list[tuple[int, int | None, int]]:
    """Redistribute timestamps when multi-frame block timestamps are clustered.

    Groups multi-frame jobs by block index and checks if their timestamps span
    less than min_spacing * (n-1). If so, redistributes evenly across the
    chapter range with a 10% inset from boundaries.

    Single-frame blocks pass through unchanged.
    """
    if chapter_start is None or chapter_end is None:
        return jobs
    if chapter_end <= chapter_start:
        return jobs

    # Group multi-frame jobs by block index
    block_jobs: dict[int, list[int]] = {}  # block_idx -> [job indices]
    for ji, (block_idx, frame_idx, _ts) in enumerate(jobs):
        if frame_idx is not None:
            block_jobs.setdefault(block_idx, []).append(ji)

    result = list(jobs)

    for block_idx, job_indices in block_jobs.items():
        if len(job_indices) < 2:
            continue

        timestamps = [jobs[ji][2] for ji in job_indices]
        spread = max(timestamps) - min(timestamps)
        required_spread = min_spacing * (len(timestamps) - 1)

        if spread >= required_spread:
            continue

        # Timestamps are clustered — redistribute evenly with 10% inset
        chapter_len = chapter_end - chapter_start
        inset = int(chapter_len * 0.1)
        range_start = chapter_start + inset
        range_end = chapter_end - inset

        if range_end <= range_start:
            range_start = chapter_start
            range_end = chapter_end

        n = len(job_indices)
        if n == 1:
            new_timestamps = [(range_start + range_end) // 2]
        else:
            step = (range_end - range_start) / (n - 1)
            new_timestamps = [
                max(chapter_start, min(int(range_start + i * step), chapter_end))
                for i in range(n)
            ]

        logger.info(
            "Spreading %d clustered timestamps for block %d: %s → %s",
            n, block_idx, timestamps, new_timestamps,
        )

        for ji, new_ts in zip(job_indices, new_timestamps):
            old = result[ji]
            result[ji] = (old[0], old[1], new_ts)

    return result


def _resolve_timestamp(
    source: dict,
    video_duration: int | None,
    chapter_start: int | None,
    chapter_end: int | None,
) -> int | None:
    """Extract and validate a timestamp from a block or frame dict.

    Returns clamped timestamp in seconds, or None if unresolvable.
    """
    try:
        ts = int(source["timestamp"])
    except (KeyError, ValueError, TypeError):
        if chapter_start is not None and chapter_end is not None:
            return (chapter_start + chapter_end) // 2
        return None

    # Clamp to chapter range (highest priority — prevents LLM hallucinated timestamps)
    if chapter_start is not None and chapter_end is not None:
        if ts < chapter_start or ts > chapter_end:
            logger.debug("Clamping timestamp %d to chapter range [%d, %d]", ts, chapter_start, chapter_end)
            ts = max(chapter_start, min(ts, chapter_end))

    # Clamp to video duration as safety net
    if video_duration and ts > video_duration:
        ts = max(video_duration - 5, 0)
    return ts


def _collect_extraction_jobs(
    content: list[dict],
    video_duration: int | None,
    chapter_start: int | None,
    chapter_end: int | None,
) -> list[tuple[int, int | None, int]]:
    """Phase 1: Iterate content blocks and build a list of extraction jobs.

    Each job is a tuple of (block_idx, frame_idx_or_None, timestamp).
    Multi-frame blocks produce one job per frame; single-frame blocks produce one job.

    Args:
        content: List of content block dicts.
        video_duration: Total video duration for timestamp clamping.
        chapter_start: Chapter start time for timestamp estimation.
        chapter_end: Chapter end time for timestamp estimation.

    Returns:
        List of (block_idx, frame_idx_or_None, timestamp) tuples.
    """
    jobs: list[tuple[int, int | None, int]] = []
    total_frames = 0

    for i, block in enumerate(content):
        if block.get("type") != "visual" or block.get("imageUrl"):
            continue

        frames = block.get("frames", [])
        if frames and isinstance(frames, list) and len(frames) > 1:
            # Multi-frame: extract each frame (capped)
            max_frames = min(len(frames), settings.MAX_FRAMES_PER_VISUAL)
            for fi in range(max_frames):
                if total_frames >= settings.MAX_FRAMES_PER_CHAPTER:
                    break
                frame = frames[fi]
                if not isinstance(frame, dict):
                    continue
                if frame.get("imageUrl"):
                    continue
                ts = _resolve_timestamp(frame, video_duration, chapter_start, chapter_end)
                if ts is not None:
                    jobs.append((i, fi, ts))
                    total_frames += 1
        else:
            # Single-frame: existing behavior
            if total_frames >= settings.MAX_FRAMES_PER_CHAPTER:
                break
            ts = _resolve_timestamp(block, video_duration, chapter_start, chapter_end)
            if ts is not None:
                jobs.append((i, None, ts))
                total_frames += 1

    return jobs


async def _extract_and_upload_frames(
    jobs: list[tuple[int, int | None, int]],
    youtube_id: str,
    stream_url: str,
    frame_hashes: dict[int, str],
) -> list[tuple[FrameExtractionResult, str | None]]:
    """Phase 2: Extract frames via ffmpeg, deduplicate, and upload to S3.

    Runs all extraction jobs in parallel (bounded by semaphore), then deduplicates
    via perceptual hashing and uploads unique frames to S3.

    Args:
        jobs: List of (block_idx, frame_idx_or_None, timestamp) tuples.
        youtube_id: YouTube video ID for S3 key generation.
        stream_url: Video stream URL for ffmpeg extraction.
        frame_hashes: Cross-chapter hash->s3_key map for video-level dedup.
            Mutated in place when new hashes are discovered.

    Returns:
        List of (FrameExtractionResult, s3_key_or_None) tuples.
    """
    # ── Stage 1: Extract all frames in parallel ──
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_EXTRACTIONS)

    async def _extract_job(job: tuple[int, int | None, int]) -> FrameExtractionResult:
        block_idx, frame_idx, ts = job

        # Check S3 cache
        s3_key = _frame_s3_key(youtube_id, ts)
        try:
            if await s3_client.exists(s3_key):
                logger.debug("Frame already in S3: %s", s3_key)
                return FrameExtractionResult(
                    idx=block_idx, ts=ts, frame_bytes=None,
                    cached_in_s3=True, frame_idx=frame_idx,
                )
        except Exception as e:
            logger.debug("S3 cache check failed for %s, proceeding with extraction: %s", s3_key, e)

        frame_bytes = await extract_frame(stream_url, ts)
        return FrameExtractionResult(
            idx=block_idx, ts=ts, frame_bytes=frame_bytes, frame_idx=frame_idx,
        )

    async def _extract_limited(job: tuple[int, int | None, int]) -> FrameExtractionResult:
        async with semaphore:
            return await _extract_job(job)

    try:
        extract_results = await asyncio.wait_for(
            asyncio.gather(
                *[_extract_limited(j) for j in jobs],
                return_exceptions=True,
            ),
            timeout=_TOTAL_EXTRACTION_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "Total frame extraction timed out for %s after %.0fs (%d jobs)",
            youtube_id, _TOTAL_EXTRACTION_TIMEOUT, len(jobs),
        )
        return []

    # ── Stage 2: Dedup + Upload ──
    upload_tasks: list[tuple[FrameExtractionResult, asyncio.Task[str | None] | str]] = []
    block_hashes: dict[int, list[int]] = {}  # per-block hash tracking for within-block dedup

    for result in extract_results:
        if isinstance(result, BaseException):
            logger.warning("Frame extraction task failed: %s", result)
            continue
        if result.frame_bytes is None and not result.cached_in_s3:
            continue

        s3_key = _frame_s3_key(youtube_id, result.ts)

        if result.cached_in_s3:
            upload_tasks.append((result, s3_key))
            continue

        if result.frame_bytes is None:
            continue

        # Brightness check: skip mostly-black frames
        if _HAS_IMAGE_DEDUP:
            try:
                if is_mostly_black(result.frame_bytes):
                    logger.debug("Frame at %ds is mostly black, skipping", result.ts)
                    continue
            except Exception as e:
            logger.debug("Brightness check failed at %ds: %s", result.ts, e)

        # Compute hash once for both within-block and global dedup
        frame_hash = _compute_frame_hash(result.frame_bytes)

        # Within-block diversity check (multi-frame only)
        if result.frame_idx is not None and frame_hash is not None and _HAS_IMAGE_DEDUP:
            try:
                block_hash_list = block_hashes.setdefault(result.idx, [])
                threshold = settings.FRAME_WITHIN_BLOCK_DEDUP_THRESHOLD
                if any(is_duplicate(frame_hash, bh, threshold=threshold) for bh in block_hash_list):
                    logger.debug(
                        "Frame at %ds too similar to sibling in block %d, dropping",
                        result.ts, result.idx,
                    )
                    continue
                block_hash_list.append(frame_hash)
            except Exception as e:
                logger.debug("Within-block dedup failed at %ds: %s", result.ts, e)

        # Perceptual dedup: check if near-identical frame already uploaded
        dedup_hit = _check_dedup(result.frame_bytes, s3_key, frame_hashes, precomputed_hash=frame_hash)
        if dedup_hit:
            logger.debug("Frame at %ds is duplicate of %s, reusing", result.ts, dedup_hit)
            upload_tasks.append((result, dedup_hit))
            continue

        upload_tasks.append((result, asyncio.create_task(_upload_frame(s3_key, result.frame_bytes))))

    # Await uploads
    resolved: list[tuple[FrameExtractionResult, str | None]] = []
    for result, task_or_key in upload_tasks:
        if isinstance(task_or_key, str):
            resolved.append((result, task_or_key))
        else:
            uploaded_key = await task_or_key
            resolved.append((result, uploaded_key))

    return resolved


def _apply_frame_results(
    content: list[dict],
    resolved_frames: list[tuple[FrameExtractionResult, str | None]],
) -> tuple[list[dict], int]:
    """Phase 3: Write S3 keys and image URLs back into content blocks.

    Creates a shallow copy of each block before mutating. Handles both
    single-frame and multi-frame blocks, gallery-to-single collapse, and
    fallback block-level imageUrl from first frame.

    Args:
        content: Original list of content block dicts (not mutated).
        resolved_frames: List of (FrameExtractionResult, s3_key_or_None) tuples.

    Returns:
        Tuple of (new_content, success_count).
    """
    new_content = [dict(b) for b in content]  # shallow copy each block
    success_count = 0

    for result, s3_key in resolved_frames:
        if s3_key is None:
            continue

        try:
            image_url = s3_client.generate_presigned_url(s3_key)
        except Exception as e:
            logger.warning("Failed to generate presigned URL for %s: %s", s3_key, e)
            continue

        success_count += 1
        block = new_content[result.idx]

        if result.frame_idx is not None:
            # Multi-frame: update the specific frame entry
            frames = block.get("frames", [])
            if result.frame_idx < len(frames):
                frames = list(frames)  # shallow copy
                frames[result.frame_idx] = {
                    **frames[result.frame_idx],
                    "s3_key": s3_key,
                    "imageUrl": image_url,
                }
                block["frames"] = frames
                # Set block-level imageUrl to first frame for backward compat
                if result.frame_idx == 0:
                    block["s3_key"] = s3_key
                    block["imageUrl"] = image_url
        else:
            # Single-frame: set on block directly
            block["s3_key"] = s3_key
            block["imageUrl"] = image_url

    # For multi-frame blocks without a block-level imageUrl, use first frame's URL
    for block in new_content:
        if block.get("type") != "visual" or block.get("imageUrl"):
            continue
        frames = block.get("frames", [])
        if frames and isinstance(frames, list):
            for frame in frames:
                if isinstance(frame, dict) and frame.get("imageUrl"):
                    block["s3_key"] = frame.get("s3_key", "")
                    block["imageUrl"] = frame["imageUrl"]
                    break

    # ── Gallery-to-single conversion ──
    # If a multi-frame block ends up with 0-1 frames with imageUrl,
    # convert it to a single-frame screenshot to avoid useless navigation UI.
    for block in new_content:
        if block.get("type") != "visual":
            continue
        frames = block.get("frames", [])
        if not frames or not isinstance(frames, list) or len(frames) < 2:
            continue

        frames_with_url = [f for f in frames if isinstance(f, dict) and f.get("imageUrl")]
        if len(frames_with_url) >= 2:
            continue

        # 0-1 frames survived — collapse to single-frame block
        if frames_with_url:
            surviving = frames_with_url[0]
            block["s3_key"] = surviving.get("s3_key", "")
            block["imageUrl"] = surviving["imageUrl"]
        block.pop("frames", None)
        if block.get("variant") in ("slideshow", "gallery"):
            block["variant"] = "screenshot"
        logger.debug(
            "Collapsed multi-frame block to single-frame (block had %d frames, %d survived)",
            len(frames), len(frames_with_url),
        )

    return new_content, success_count


async def extract_frames_for_blocks(
    youtube_id: str,
    content: list[dict],
    video_duration: int | None = None,
    chapter_start: int | None = None,
    chapter_end: int | None = None,
    frame_hashes: dict[int, str] | None = None,
) -> list[dict]:
    """Extract frames for all visual blocks in a chapter's content.

    Supports both single-frame and multi-frame (frames[]) visual blocks.

    Pipeline:
    1. Collect all extraction jobs (block_idx, frame_idx_or_None, timestamp)
    2. Extract all frames in parallel via ffmpeg
    3. Deduplicate via perceptual hash (reuse S3 key for near-identical frames)
    4. Upload unique frames to S3 in parallel
    5. Generate presigned URLs and set s3_key + imageUrl on blocks

    Args:
        youtube_id: YouTube video ID for S3 key generation.
        content: List of content block dicts.
        video_duration: Total video duration for timestamp clamping.
        chapter_start: Chapter start time for timestamp estimation.
        chapter_end: Chapter end time for timestamp estimation.
        frame_hashes: Cross-chapter hash→s3_key map for video-level dedup.
            Mutated in place when new hashes are discovered.

    Returns:
        New content list with s3_key and imageUrl populated where possible.
    """
    if not settings.FRAME_EXTRACTION_ENABLED:
        return content

    if not YOUTUBE_ID_RE.match(youtube_id):
        return content

    if frame_hashes is None:
        frame_hashes = {}

    # Phase 1: Collect extraction jobs
    jobs = _collect_extraction_jobs(content, video_duration, chapter_start, chapter_end)

    # Spread clustered timestamps for multi-frame blocks
    jobs = _spread_clustered_timestamps(
        jobs, chapter_start, chapter_end, settings.FRAME_MIN_SPACING_SECONDS,
    )

    if not jobs:
        return content

    # Get video stream URL (one call, cached)
    stream_url = await get_video_stream_url(youtube_id)
    if not stream_url:
        logger.info("No stream URL — skipping frame extraction for %s", youtube_id)
        return content

    # Phase 2: Extract, dedup, and upload
    resolved = await _extract_and_upload_frames(jobs, youtube_id, stream_url, frame_hashes)

    # Phase 3: Apply results to content blocks (runs even with empty resolved
    # list, because gallery-to-single collapse must still execute)
    new_content, success_count = _apply_frame_results(content, resolved)

    logger.info(
        "Frame extraction for %s: %d/%d jobs succeeded",
        youtube_id, success_count, len(jobs),
    )
    return new_content


async def check_dependencies() -> dict[str, str]:
    """Check availability of ffmpeg and yt-dlp at startup.

    Returns a dict with tool names as keys and version/status as values.
    Logs warnings for missing tools but does not raise — frame extraction
    degrades gracefully when tools are unavailable.
    """
    results: dict[str, str] = {}
    for tool in ("ffmpeg", "yt-dlp"):
        try:
            proc = await asyncio.create_subprocess_exec(
                tool, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            results[tool] = "not installed"
            logger.warning("Frame extraction dependency %s not found in PATH", tool)
            continue
        except Exception as e:
            results[tool] = f"error: {e}"
            logger.warning("Frame extraction dependency check failed for %s: %s", tool, e)
            continue

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()  # drain pipes
            results[tool] = "error: timeout"
            logger.warning("Frame extraction dependency check timed out for %s", tool)
            continue

        if proc.returncode == 0 and stdout:
            version_line = stdout.decode().strip().split("\n")[0][:80]
            results[tool] = version_line
            logger.info("Frame extraction dependency: %s → %s", tool, version_line)
        else:
            results[tool] = "not available"
            logger.warning("Frame extraction dependency %s returned non-zero exit", tool)
    return results
