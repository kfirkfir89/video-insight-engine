"""Perceptual hashing for frame deduplication using average hash (aHash).

Used to detect identical or near-identical video frames across chapters,
preventing duplicate uploads and storage. The aHash algorithm is fast and
well-suited for video frames where slight encoding variations are common.
"""

from io import BytesIO

from PIL import Image


def compute_ahash(frame_bytes: bytes, hash_size: int = 8) -> int:
    """Compute average hash from JPEG bytes.

    Resizes image to hash_size x hash_size grayscale, then compares
    each pixel to the average to produce a binary hash.

    Args:
        frame_bytes: Raw JPEG image bytes.
        hash_size: Size of the hash grid (default 8 = 64-bit hash).

    Returns:
        Integer hash value.
    """
    img = Image.open(BytesIO(frame_bytes)).convert("L").resize(
        (hash_size, hash_size), Image.Resampling.LANCZOS
    )
    pixels = list(img.getdata())
    avg = sum(pixels) / len(pixels)
    return sum(1 << i for i, p in enumerate(pixels) if p > avg)


def is_mostly_black(frame_bytes: bytes, threshold: float = 15.0) -> bool:
    """Check if a frame is mostly black (mean brightness below threshold).

    Resizes to a small tile and computes mean pixel value on a 0-255 scale.
    Black/blank frames from video intros or encoding errors typically have
    mean brightness well below 10.

    Args:
        frame_bytes: Raw JPEG image bytes.
        threshold: Maximum mean brightness to consider "mostly black" (default 15).

    Returns:
        True if the image is mostly black.
    """
    img = Image.open(BytesIO(frame_bytes)).convert("L").resize(
        (32, 32), Image.Resampling.LANCZOS
    )
    pixels = list(img.getdata())
    return (sum(pixels) / len(pixels)) < threshold


def is_duplicate(hash1: int, hash2: int, threshold: int = 5) -> bool:
    """Check if two hashes are perceptually similar.

    Uses Hamming distance — the number of differing bits between hashes.
    A threshold of 5 (out of 64 bits) catches near-identical frames while
    allowing minor encoding differences.

    Args:
        hash1: First image hash.
        hash2: Second image hash.
        threshold: Maximum Hamming distance for a match (default 5).

    Returns:
        True if the images are perceptually similar.
    """
    return bin(hash1 ^ hash2).count("1") <= threshold
