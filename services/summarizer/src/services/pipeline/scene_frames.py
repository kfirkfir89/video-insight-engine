"""Shared scene-frame processing helpers.

Single OCR pass for both transcript enrichment and frame metadata.
Handles the 3-tier frame structure: all_frames, selected_frames, gallery_frames.
"""

from __future__ import annotations

import asyncio
import logging

from src.services.media.s3_client import s3_client
from src.services.media.frame_ocr import extract_text_from_frames, enrich_transcript_with_ocr
from src.services.pipeline.pipeline_helpers import sse_event
from src.utils.constants import YOUTUBE_ID_RE

logger = logging.getLogger(__name__)


async def process_scene_frames(
    extraction_result: dict | list,
    youtube_id: str,
    clean_text: str | None = None,
) -> tuple[dict, str, str | None]:
    """Run OCR, generate presigned URLs, optionally enrich transcript.

    Accepts the 3-tier dict from extract_scene_keyframes() or a legacy
    flat list for backward compatibility.

    Args:
        extraction_result: Dict with all_frames/selected_frames/gallery_frames,
            or a flat list of frame dicts (legacy).
        youtube_id: YouTube video ID.
        clean_text: If provided, OCR results enrich this transcript text.

    Returns:
        (enriched_result, sse_event_string, updated_clean_text_or_None).
        enriched_result has same shape as input (3-tier dict).
    """
    # Validate youtube_id (defense-in-depth)
    if not YOUTUBE_ID_RE.match(youtube_id):
        logger.warning("Invalid youtube_id in process_scene_frames: %s", youtube_id)
        empty = {"all_frames": [], "selected_frames": [], "gallery_frames": []}
        return empty, "", None

    # Handle legacy flat list input
    if isinstance(extraction_result, list):
        extraction_result = {
            "all_frames": extraction_result,
            "selected_frames": extraction_result,
            "gallery_frames": extraction_result[:12],
        }

    all_frames = extraction_result.get("all_frames", [])
    selected_frames = extraction_result.get("selected_frames", [])
    gallery_frames = extraction_result.get("gallery_frames", [])

    # Single OCR pass on ALL frames (for transcript enrichment, non-critical)
    ocr_frames = [f for f in all_frames if f.get("path")]
    ocr_results: list[dict] = []
    try:
        if ocr_frames:
            ocr_results = await asyncio.to_thread(extract_text_from_frames, ocr_frames)
    except Exception as e:
        logger.warning("Scene OCR failed (non-critical): %s", e)
    ocr_map = {r["index"]: r for r in ocr_results} if ocr_results else {}

    # Enrich transcript if clean_text provided
    updated_text = None
    if clean_text is not None and ocr_results:
        updated_text = enrich_transcript_with_ocr(clean_text, ocr_results)
        logger.info("Scene OCR: enriched transcript with %d text frames", len(ocr_results))

    # Generate presigned URLs for SELECTED frames only (those with s3_key)
    enriched_selected: list[dict] = []
    for f in selected_frames:
        s3_key = f.get("s3_key")
        if not s3_key:
            continue
        url = s3_client.generate_presigned_url(s3_key)
        ocr = ocr_map.get(f.get("index"), {})
        enriched_selected.append({
            **f,
            "s3_url": url,
            "ocr_text": ocr.get("ocr_text"),
            "text_density": ocr.get("text_density", 0.0),
        })

    # Enrich gallery frames with presigned URLs
    enriched_gallery: list[dict] = []
    selected_url_map = {f.get("index"): f.get("s3_url", "") for f in enriched_selected}
    for f in gallery_frames:
        idx = f.get("index")
        url = selected_url_map.get(idx)
        if not url and f.get("s3_key"):
            url = s3_client.generate_presigned_url(f["s3_key"])
        ocr = ocr_map.get(idx, {})
        enriched_gallery.append({
            **f,
            "s3_url": url or "",
            "ocr_text": ocr.get("ocr_text"),
            "text_density": ocr.get("text_density", 0.0),
        })

    # Enrich all_frames with OCR data (no presigned URLs — they have no S3 keys)
    enriched_all: list[dict] = []
    for f in all_frames:
        ocr = ocr_map.get(f.get("index"), {})
        enriched_all.append({
            **f,
            "ocr_text": ocr.get("ocr_text"),
            "text_density": ocr.get("text_density", 0.0),
        })

    # Build SSE event with SELECTED frames only (those with S3 URLs)
    event_str = sse_event("frames", {
        "videoId": youtube_id,
        "frames": [
            {
                "index": f.get("index", 0),
                "timestamp": f.get("timestamp", 0.0),
                "url": f.get("s3_url", ""),
                "s3Key": f.get("s3_key", ""),
                "ocrText": f.get("ocr_text"),
                "textDensity": f.get("text_density", 0.0),
            }
            for f in enriched_selected
        ],
    })

    result = {
        "all_frames": enriched_all,
        "selected_frames": enriched_selected,
        "gallery_frames": enriched_gallery,
    }

    return result, event_str, updated_text


# ─────────────────────────────────────────────────────
# Visual Context Injection
# ─────────────────────────────────────────────────────


def _build_vision_annotations(
    frame_descriptions: list[dict],
) -> tuple[list[tuple[float, str]], set[int]]:
    """Build [VISUAL at M:SS] annotations from vision descriptions.

    Returns:
        (annotations, vision_original_indices) — annotations sorted by timestamp,
        and the set of original frame indices covered by vision.
    """
    from src.services.media.frame_analyzer import format_visual_annotation

    annotations: list[tuple[float, str]] = []
    vision_indices: set[int] = set()
    for desc in frame_descriptions:
        scene_type = desc.get("scene_type", "other")
        if scene_type == "talking_head" and not desc.get("educational_value"):
            continue
        annotation = format_visual_annotation(desc)
        annotations.append((desc.get("timestamp_sec", 0), annotation))
        orig_idx = desc.get("original_index")
        if orig_idx is not None:
            vision_indices.add(orig_idx)
    return annotations, vision_indices


def _build_ocr_annotations(
    all_frames: list[dict],
    vision_indices: set[int],
) -> list[tuple[float, str]]:
    """Build [ON-SCREEN TEXT at M:SS] annotations for frames not covered by vision."""
    annotations: list[tuple[float, str]] = []
    for frame in all_frames:
        idx = frame.get("index")
        if idx in vision_indices:
            continue
        ocr_text = frame.get("ocr_text")
        if not ocr_text or len(ocr_text.strip()) < 10:
            continue
        ts = frame.get("timestamp", 0)
        mins = int(ts) // 60
        secs = int(ts) % 60
        annotation = f"[ON-SCREEN TEXT at {mins}:{secs:02d}: '{ocr_text.strip()[:200]}']"
        annotations.append((ts, annotation))
    return annotations


def inject_visual_context(
    clean_text: str,
    segments: list[dict] | None,
    frame_descriptions: list[dict],
    all_frames: list[dict],
) -> str:
    """Inject visual annotations into transcript at correct temporal positions.

    Builds [VISUAL at M:SS] from vision descriptions and [ON-SCREEN TEXT at M:SS]
    from OCR results (for frames not covered by vision), then inserts them at
    the correct positions in the transcript using segment timestamps.

    Args:
        clean_text: Clean transcript text.
        segments: Transcript segments with startMs/endMs (for positioning).
        frame_descriptions: Vision analysis results (from frame_analyzer).
        all_frames: All frames with optional ocr_text (for OCR-only annotations).

    Returns:
        Transcript with visual annotations injected at correct positions.
    """
    if not clean_text:
        return clean_text

    vision_annotations, vision_indices = _build_vision_annotations(frame_descriptions)
    ocr_annotations = _build_ocr_annotations(all_frames, vision_indices)
    annotations = vision_annotations + ocr_annotations

    if not annotations:
        return clean_text

    annotations.sort(key=lambda x: x[0])

    if segments:
        return _insert_with_segments(clean_text, segments, annotations)
    return _insert_with_estimation(clean_text, annotations)


def _insert_with_segments(
    text: str,
    segments: list[dict],
    annotations: list[tuple[float, str]],
) -> str:
    """Insert annotations using segment timestamps for precise positioning."""
    insertions: list[tuple[int, str]] = []

    for ts, annotation in annotations:
        ts_ms = ts * 1000

        # Find the segment that contains this timestamp
        best_segment = None
        best_distance = float("inf")
        for seg in segments:
            start_ms = seg.get("startMs", seg.get("start_ms", 0))
            end_ms = seg.get("endMs", seg.get("end_ms", start_ms + 5000))
            if start_ms <= ts_ms <= end_ms:
                best_segment = seg
                break
            distance = min(abs(start_ms - ts_ms), abs(end_ms - ts_ms))
            if distance < best_distance:
                best_distance = distance
                best_segment = seg

        if not best_segment:
            continue

        seg_text = best_segment.get("text", "").strip()
        if not seg_text:
            continue

        # Find segment text in transcript (fuzzy match with first 50 chars)
        search_text = seg_text[:50]
        pos = text.find(search_text)
        if pos == -1:
            search_text = seg_text[:25]
            pos = text.find(search_text)

        if pos != -1:
            end_of_match = min(pos + len(seg_text), len(text))
            nl = text.find("\n", end_of_match)
            insert_pos = nl if nl != -1 else end_of_match
            insertions.append((insert_pos, f"\n{annotation}"))

    if not insertions:
        return _insert_with_estimation(text, annotations)

    # Insert from END to START to preserve earlier positions
    insertions.sort(key=lambda x: x[0], reverse=True)
    for pos, annotation_text in insertions:
        text = text[:pos] + annotation_text + text[pos:]

    return text


def _insert_with_estimation(
    text: str,
    annotations: list[tuple[float, str]],
) -> str:
    """Insert annotations using character-count estimation when segments unavailable."""
    if not annotations:
        return text

    max_ts = max(ts for ts, _ in annotations)
    if max_ts <= 0:
        max_ts = 1

    total_chars = len(text)
    insertions: list[tuple[int, str]] = []

    for ts, annotation in annotations:
        ratio = ts / max_ts
        estimated_pos = int(ratio * total_chars)
        nl = text.find("\n", estimated_pos)
        insert_pos = nl if nl != -1 else estimated_pos
        insertions.append((insert_pos, f"\n{annotation}"))

    # Insert from END to START
    insertions.sort(key=lambda x: x[0], reverse=True)
    for pos, annotation_text in insertions:
        text = text[:pos] + annotation_text + text[pos:]

    return text
