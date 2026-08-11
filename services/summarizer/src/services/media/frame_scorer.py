"""Smart frame scoring, selection, and classification for gallery curation.

Scores every FFmpeg-detected scene frame on 4 dimensions (visual interest,
face detection, text density, visual uniqueness), then selects ~25 best
with even time distribution, and classifies ~12 for the Gallery tab.

CPU-only, no network calls. Typical latency: ~2-3s for 222 frames.
"""

from __future__ import annotations

import logging
import math

logger = logging.getLogger(__name__)

# Lazy imports for heavy dependencies
_cv2 = None
_face_cascade = None


def _get_cv2():
    global _cv2
    if _cv2 is None:
        import cv2
        _cv2 = cv2
    return _cv2


def _get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        cv2 = _get_cv2()
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _face_cascade


# ─────────────────────────────────────────────────────
# Individual Scoring Functions (each returns 0.0-1.0)
# ─────────────────────────────────────────────────────


def score_visual_interest(path: str) -> float:
    """Score visual interest via HSV saturation (60%) + contrast (40%).

    High saturation = colorful scene (food, landscapes). High contrast =
    dynamic content. Both low = talking head on gray background.
    """
    cv2 = _get_cv2()
    img = cv2.imread(path)
    if img is None:
        return 0.0

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation_score = float(hsv[:, :, 1].mean()) / 255.0
    contrast_score = min(float(img.std()) / 128.0, 1.0)
    return saturation_score * 0.6 + contrast_score * 0.4


def score_face_detection(path: str) -> float:
    """Score face presence using Haar cascade.

    0.0 = no face, 0.5 = one face, 1.0 = two or more faces.
    Frames with faces often show the creator demonstrating something.
    """
    cv2 = _get_cv2()
    cascade = _get_face_cascade()

    gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if gray is None:
        return 0.0

    faces = cascade.detectMultiScale(gray, 1.3, 5)
    return min(len(faces) * 0.5, 1.0)


def score_text_density(path: str) -> float:
    """Score text density by delegating to existing Canny edge detector.

    Reuses estimate_text_density() from frame_ocr.py to avoid duplication.
    """
    from src.services.media.frame_ocr import estimate_text_density
    return estimate_text_density(path)


def _hamming_distance(hash1: int, hash2: int) -> int:
    """Count differing bits between two perceptual hashes."""
    return bin(hash1 ^ hash2).count("1")


def score_uniqueness(frame_hash: int, prev_hash: int | None, next_hash: int | None) -> float:
    """Score visual uniqueness via perceptual hash distance to neighbors.

    High distance = major scene change = visually important frame.
    Uses 64-bit aHash, so max distance is 64.
    """
    distances = []
    if prev_hash is not None:
        distances.append(_hamming_distance(frame_hash, prev_hash) / 64.0)
    if next_hash is not None:
        distances.append(_hamming_distance(frame_hash, next_hash) / 64.0)
    return max(distances) if distances else 0.5


# ─────────────────────────────────────────────────────
# Combined Scoring
# ─────────────────────────────────────────────────────

# Weights: visual 30%, face 20% (inverted), text 25%, uniqueness 25%
# Face is INVERTED: frames with faces score LOWER (penalizes talking heads,
# promotes content-rich frames like diagrams, code, cooking, builds).
WEIGHT_VISUAL = 0.30
WEIGHT_FACE = 0.20
WEIGHT_TEXT = 0.25
WEIGHT_UNIQUENESS = 0.25


def score_frame(path: str, frame_hash: int, prev_hash: int | None, next_hash: int | None) -> dict[str, float]:
    """Score a single frame on all 4 dimensions.

    Returns dict with individual scores and combined total (0.0-1.0).
    """
    visual = score_visual_interest(path)
    face = score_face_detection(path)
    text = score_text_density(path)
    uniqueness = score_uniqueness(frame_hash, prev_hash, next_hash)

    total = (
        visual * WEIGHT_VISUAL
        + (1.0 - face) * WEIGHT_FACE
        + text * WEIGHT_TEXT
        + uniqueness * WEIGHT_UNIQUENESS
    )

    return {
        "visual_score": round(visual, 3),
        "face_score": round(face, 3),
        "text_score": round(text, 3),
        "uniqueness_score": round(uniqueness, 3),
        "total_score": round(total, 3),
    }


def score_all_frames(frames: list[dict]) -> list[dict]:
    """Score every frame, adding score fields to each frame dict.

    Reads frame bytes once for both aHash and black-frame detection.
    Skips scoring on error (frame gets total_score=0.0).
    """
    from src.services.media.image_dedup import compute_ahash, is_mostly_black

    # Pre-compute perceptual hashes for uniqueness scoring
    hashes: list[int | None] = []
    for f in frames:
        path = f.get("path")
        if not path:
            hashes.append(None)
            continue
        try:
            with open(path, "rb") as fh:
                frame_bytes = fh.read()
            if is_mostly_black(frame_bytes):
                hashes.append(None)  # Skip black frames
            else:
                hashes.append(compute_ahash(frame_bytes))
        except Exception:
            hashes.append(None)

    scored: list[dict] = []
    for i, f in enumerate(frames):
        path = f.get("path")
        frame_hash = hashes[i]

        if not path or frame_hash is None:
            # Black frame or unreadable — score 0
            scored.append({
                **f,
                "visual_score": 0.0,
                "face_score": 0.0,
                "text_score": 0.0,
                "uniqueness_score": 0.0,
                "total_score": 0.0,
                "is_black": frame_hash is None and path is not None,
            })
            continue

        prev_hash = hashes[i - 1] if i > 0 else None
        next_hash = hashes[i + 1] if i < len(hashes) - 1 else None

        try:
            scores = score_frame(path, frame_hash, prev_hash, next_hash)
            scored.append({**f, **scores})
        except Exception as e:
            logger.debug("Failed to score frame %d: %s", i, e)
            scored.append({
                **f,
                "visual_score": 0.0,
                "face_score": 0.0,
                "text_score": 0.0,
                "uniqueness_score": 0.0,
                "total_score": 0.0,
            })

    scored_count = sum(1 for s in scored if s.get("total_score", 0) > 0)
    logger.info("Frame scoring: %d/%d frames scored (rest black/unreadable)", scored_count, len(frames))
    return scored


# ─────────────────────────────────────────────────────
# Selection + Classification
# ─────────────────────────────────────────────────────


def compute_target_count(duration_seconds: int | None) -> int:
    """Compute target frame count based on video duration.

    Scaling: max(15, min(30, duration / 30))
    - 5-min video → 15 frames
    - 16-min video → 25 frames
    - 60-min video → 30 frames (cap)
    """
    if not duration_seconds or duration_seconds <= 0:
        return 20  # sensible default
    return max(15, min(30, duration_seconds // 30))


def select_by_time_slots(
    scored_frames: list[dict],
    duration_seconds: int | None,
    target_count: int | None = None,
) -> list[dict]:
    """Select frames with even time distribution across the video.

    Divides video into N time slots, picks highest-scored frame per slot.
    Guarantees coverage from start to end instead of clustering.
    """
    if not scored_frames:
        return []

    n_target = target_count or compute_target_count(duration_seconds)
    dur = duration_seconds or 1

    # Determine actual time range from frame timestamps
    max_ts = max(f.get("timestamp", 0) for f in scored_frames)
    time_range = max(max_ts, dur)
    if time_range <= 0:
        time_range = 1

    slot_width = time_range / n_target

    selected: list[dict] = []
    for slot_idx in range(n_target):
        slot_start = slot_idx * slot_width
        slot_end = (slot_idx + 1) * slot_width

        # Find frames in this time slot
        slot_frames = [
            f for f in scored_frames
            if slot_start <= f.get("timestamp", 0) < slot_end
            and f.get("total_score", 0) > 0  # skip black/unreadable
        ]

        if not slot_frames:
            continue

        # Pick highest scored frame in this slot
        best = max(slot_frames, key=lambda f: f.get("total_score", 0))
        selected.append(best)

    # Sort by timestamp for consistent ordering
    selected.sort(key=lambda f: f.get("timestamp", 0))
    return selected


def classify_for_gallery(selected_frames: list[dict], gallery_ratio: float = 0.48) -> list[dict]:
    """Pick top frames by score for the Gallery tab.

    Takes ~48% of selected frames (typically ~12 from 25), re-sorted by
    timestamp for display order.
    """
    if not selected_frames:
        return []

    gallery_count = max(6, math.ceil(len(selected_frames) * gallery_ratio))
    gallery_count = min(gallery_count, len(selected_frames))

    # Top N by total_score
    by_score = sorted(selected_frames, key=lambda f: f.get("total_score", 0), reverse=True)
    gallery = by_score[:gallery_count]

    # Re-sort by timestamp for display
    gallery.sort(key=lambda f: f.get("timestamp", 0))
    return gallery


def select_frames(
    scored_frames: list[dict],
    duration_seconds: int | None,
) -> tuple[list[dict], list[dict]]:
    """Orchestrator: select frames for upload + classify gallery subset.

    Returns:
        (selected_frames, gallery_frames) — selected are uploaded to S3,
        gallery is the curated subset for the Gallery tab.
    """
    selected = select_by_time_slots(scored_frames, duration_seconds)
    gallery = classify_for_gallery(selected)

    logger.info(
        "Frame selection: %d scored → %d selected → %d gallery (duration=%ss)",
        len(scored_frames), len(selected), len(gallery), duration_seconds,
    )
    return selected, gallery
