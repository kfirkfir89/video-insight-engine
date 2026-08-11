"""Scene-based keyframe extraction with smart frame selection.

Downloads lowest-quality video via yt-dlp to a temp file, runs FFmpeg
scene detection, scores frames locally, selects ~25 best with even time
distribution, and uploads only selected frames to S3.

Key principle: score locally, upload selectively.
"""

import asyncio
import logging
import re
import shutil
import tempfile
from pathlib import Path

from src.config import settings
from src.services.media.s3_client import s3_client
from src.utils.constants import YOUTUBE_ID_RE

logger = logging.getLogger(__name__)

# Per-video extraction locks to prevent duplicate concurrent extractions
_extraction_locks: dict[str, asyncio.Lock] = {}

# Upload all selected frames in a single concurrent batch (~25-30 frames).
# S3 handles thousands of concurrent PUTs; no need to chunk.
UPLOAD_BATCH_SIZE = 50


async def _check_existing_frames(video_id: str) -> list[dict] | None:
    """Check if frames already exist in S3 for this video.

    Returns frame dicts built from existing S3 objects if >10 exist,
    or None if extraction is needed.
    """
    try:
        session = s3_client._ensure_session()
        config = s3_client._get_client_config()
        prefix = f"videos/{video_id}/scenes/"

        async with session.client("s3", **config) as s3:
            response = await s3.list_objects_v2(
                Bucket=s3_client._bucket,
                Prefix=prefix,
                MaxKeys=50,
            )

        objects = response.get("Contents", [])
        if len(objects) < 10:
            return None

        # Build frame dicts from existing S3 objects
        frames: list[dict] = []
        for i, obj in enumerate(sorted(objects, key=lambda o: o["Key"])):
            key = obj["Key"]
            if not key.endswith(".jpg"):
                continue
            url = s3_client.generate_presigned_url(key)
            frames.append({
                "index": i,
                "filename": key.split("/")[-1],
                "s3_key": key,
                "s3_url": url,
                "timestamp": 0.0,  # Unknown for existing frames
            })

        if frames:
            logger.info(
                "Frames already exist in S3 for %s (%d frames), skipping extraction",
                video_id, len(frames),
            )
        return frames if frames else None

    except Exception as e:
        logger.debug("S3 frame check failed (will extract): %s", e)
        return None


async def _upload_frames_batch(frames: list[dict]) -> list[dict]:
    """Upload frames to S3 in parallel batches.

    Uploads UPLOAD_BATCH_SIZE frames concurrently. Skips individual failures.
    Returns frames with s3_key populated.
    """
    results: list[dict] = []

    for batch_start in range(0, len(frames), UPLOAD_BATCH_SIZE):
        batch = frames[batch_start:batch_start + UPLOAD_BATCH_SIZE]

        async def _upload_one(frame: dict) -> dict | None:
            path = frame.get("path")
            s3_key = frame.get("s3_key")
            if not path or not s3_key:
                return None
            try:
                with open(path, "rb") as f:
                    frame_bytes = f.read()
                await s3_client.put_bytes(s3_key, frame_bytes, content_type="image/jpeg")
                return frame
            except Exception as e:
                logger.warning("Failed to upload frame %s: %s", s3_key, e)
                return None

        batch_results = await asyncio.gather(
            *[_upload_one(f) for f in batch],
            return_exceptions=True,
        )

        for result in batch_results:
            if isinstance(result, dict):
                results.append(result)

    return results


async def extract_scene_keyframes(
    video_id: str,
    scene_threshold: float | None = None,
    max_frames: int | None = None,
    duration_seconds: int | None = None,
) -> dict:
    """Extract keyframes at scene change boundaries with smart selection.

    Downloads lowest-quality video via yt-dlp, runs FFmpeg scene detection,
    scores all frames locally, selects ~25 best, uploads only those to S3.

    Args:
        video_id: YouTube video ID.
        scene_threshold: FFmpeg scene change threshold (0.0-1.0).
        max_frames: Maximum frames to extract from FFmpeg. Default from settings.
        duration_seconds: Video duration in seconds.

    Returns:
        Dict with 'all_frames', 'selected_frames', 'gallery_frames' keys.
        Empty dict on failure (graceful degradation).
    """
    empty_result: dict = {"all_frames": [], "selected_frames": [], "gallery_frames": []}

    if not settings.SCENE_EXTRACTION_ENABLED:
        return empty_result

    if not YOUTUBE_ID_RE.match(video_id):
        logger.warning("Invalid youtube_id for scene extraction: %s", video_id)
        return empty_result

    # Per-video lock prevents duplicate concurrent extractions (atomic setdefault)
    lock = _extraction_locks.setdefault(video_id, asyncio.Lock())

    async with lock:
        try:
            # Check S3 first — skip extraction if frames already exist
            existing = await _check_existing_frames(video_id)
            if existing:
                return {
                    "all_frames": existing,
                    "selected_frames": existing,
                    "gallery_frames": existing[:12],
                }

            return await _do_extraction(video_id, scene_threshold, max_frames, duration_seconds)
        finally:
            # Prune lock after use to prevent unbounded dict growth
            _extraction_locks.pop(video_id, None)


async def _do_extraction(
    video_id: str,
    scene_threshold: float | None,
    max_frames: int | None,
    duration_seconds: int | None,
) -> dict:
    """Core extraction logic — FFmpeg + scoring + selective upload."""
    empty_result: dict = {"all_frames": [], "selected_frames": [], "gallery_frames": []}

    threshold = scene_threshold or settings.SCENE_THRESHOLD
    if not (0.0 < threshold < 1.0):
        logger.warning("Invalid scene threshold %.4f, using default 0.3", threshold)
        threshold = 0.3

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.mkdtemp(prefix=f"vie-scene-{video_id}-")
    temp_video = Path(temp_dir) / f"{video_id}.mp4"
    frames_dir = Path(temp_dir) / "frames"
    frames_dir.mkdir()

    try:
        # Step 1: Download lowest quality video via yt-dlp
        dl_proc = None
        try:
            dl_proc = await asyncio.create_subprocess_exec(
                "yt-dlp",
                "-f", "worstvideo[ext=mp4]/worst[ext=mp4]/worst",
                "--no-playlist",
                "--no-warnings",
                "-o", str(temp_video),
                youtube_url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, dl_stderr = await asyncio.wait_for(dl_proc.communicate(), timeout=120)
        except asyncio.TimeoutError:
            logger.warning("yt-dlp download timed out for %s (120s)", video_id)
            if dl_proc:
                try:
                    dl_proc.kill()
                    await dl_proc.wait()
                except ProcessLookupError:
                    pass
            return empty_result
        except FileNotFoundError:
            logger.warning("yt-dlp not found, scene extraction unavailable")
            return empty_result

        if (dl_proc and dl_proc.returncode != 0) or not temp_video.exists():
            stderr_text = dl_stderr.decode("utf-8", errors="replace")[:300] if dl_stderr else ""
            logger.warning(
                "yt-dlp download failed for %s (rc=%d): %s",
                video_id, dl_proc.returncode if dl_proc else -1, stderr_text,
            )
            return empty_result

        file_size_mb = temp_video.stat().st_size / 1_048_576
        logger.info("Downloaded temp video for %s: %.1fMB", video_id, file_size_mb)

        # Step 2: FFmpeg scene detection on LOCAL file
        output_pattern = str(frames_dir / "scene_%04d.jpg")
        ffmpeg_cmd = [
            "ffmpeg",
            "-i", str(temp_video),
            "-vf", f"select='gt(scene,{threshold:.4f})',showinfo,scale=1024:-1",
            "-vsync", "vfr",
            "-q:v", "5",
            output_pattern,
            "-loglevel", "info",
            "-y",
        ]

        ff_proc = None
        try:
            ff_proc = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            dur = duration_seconds or 300
            ffmpeg_timeout = min(300, max(60, int(dur * 0.3) + 30))
            _, stderr_bytes = await asyncio.wait_for(ff_proc.communicate(), timeout=ffmpeg_timeout)
        except asyncio.TimeoutError:
            ffmpeg_timeout = min(300, max(60, int((duration_seconds or 300) * 0.3) + 30))
            logger.warning("FFmpeg scene detection timed out for %s (%ds)", video_id, ffmpeg_timeout)
            if ff_proc:
                try:
                    ff_proc.kill()
                    await ff_proc.wait()
                except ProcessLookupError:
                    pass
            return empty_result
        except FileNotFoundError:
            logger.warning("ffmpeg not found, scene extraction unavailable")
            return empty_result

        # Step 3: Parse pts_time from showinfo filter output
        timestamps: list[float] = []
        if stderr_bytes:
            stderr_text = stderr_bytes.decode("utf-8", errors="replace")
            for match in re.finditer(r"pts_time:\s*([\d.]+)", stderr_text):
                try:
                    timestamps.append(float(match.group(1)))
                except ValueError:
                    continue

        # Step 4: Collect frames (hard cap at 500 for resource safety)
        frame_paths = sorted(frames_dir.glob("scene_*.jpg"))[:500]
        if not frame_paths:
            logger.info("No scene keyframes extracted for %s", video_id)
            return empty_result

        all_frames: list[dict] = []
        for i, path in enumerate(frame_paths):
            all_frames.append({
                "index": i,
                "filename": path.name,
                "path": str(path),
                "timestamp": timestamps[i] if i < len(timestamps) else 0.0,
                "temp_dir": temp_dir,
            })

        logger.info(
            "FFmpeg detected %d scene frames for %s (%d timestamps parsed)",
            len(all_frames), video_id, len(timestamps),
        )

        # Step 5: Score all frames locally (CPU only, ~2-3s)
        from src.services.media.frame_scorer import score_all_frames, select_frames

        try:
            scored_frames = await asyncio.to_thread(score_all_frames, all_frames)
        except Exception as e:
            logger.warning("Frame scoring failed, uploading first 25 as fallback: %s", e)
            scored_frames = all_frames

        # Step 6: Select ~25 best + classify ~12 for gallery
        selected_frames, gallery_frames = await asyncio.to_thread(
            select_frames, scored_frames, duration_seconds,
        )

        if not selected_frames:
            # Fallback: take evenly spaced frames
            step = max(1, len(scored_frames) // 25)
            selected_frames = scored_frames[::step][:25]
            gallery_frames = selected_frames[:12]

        # Step 7: Upload ONLY selected frames to S3 (batch parallel)
        for f in selected_frames:
            f["s3_key"] = f"videos/{video_id}/scenes/scene_{f['index']:04d}.jpg"

        uploaded = await _upload_frames_batch(selected_frames)

        # Log top 5 scored frames for debugging
        top_5 = sorted(scored_frames, key=lambda f: f.get("total_score", 0), reverse=True)[:5]
        for rank, f in enumerate(top_5, 1):
            logger.info(
                "Top frame #%d: index=%d ts=%.1fs total=%.3f "
                "(visual=%.3f face=%.3f text=%.3f unique=%.3f)",
                rank, f.get("index", -1), f.get("timestamp", 0),
                f.get("total_score", 0),
                f.get("visual_score", 0), f.get("face_score", 0),
                f.get("text_score", 0), f.get("uniqueness_score", 0),
            )

        logger.info(
            "Scene extraction for %s: %d frames scored, %d uploaded to S3, %d gallery",
            video_id, len(scored_frames), len(uploaded), len(gallery_frames),
        )

        return {
            "all_frames": scored_frames,
            "selected_frames": uploaded,
            "gallery_frames": [f for f in gallery_frames if f.get("s3_key")],
        }

    except Exception as e:
        logger.warning("Scene extraction failed for %s: %s", video_id, e)
        return empty_result
    finally:
        # Delete temp VIDEO file immediately (large, ~5-15MB)
        try:
            if temp_video.exists():
                temp_video.unlink()
        except Exception as cleanup_err:
            logger.debug("Failed to delete temp video: %s", cleanup_err)
        # NOTE: Don't delete frames_dir — OCR needs the frame JPEGs.
        # Cleanup via cleanup_temp_dir() after process_scene_frames().


async def cleanup_temp_dir(temp_dir: str) -> None:
    """Remove temp directory after OCR is done.

    Call AFTER process_scene_frames() has finished running OCR on the
    local frame files. Safe to call multiple times or with invalid paths.
    """
    try:
        await asyncio.to_thread(shutil.rmtree, temp_dir, ignore_errors=True)
    except Exception:
        pass
