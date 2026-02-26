"""Tests for perceptual hashing (aHash) image deduplication module."""

from io import BytesIO

import pytest
from PIL import Image

from src.services.image_dedup import compute_ahash, is_duplicate, is_mostly_black


def _make_jpeg(color: tuple[int, int, int], size: tuple[int, int] = (64, 64)) -> bytes:
    """Create a solid-color JPEG image and return its bytes."""
    img = Image.new("RGB", size, color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_gradient_jpeg(
    start: int = 0,
    end: int = 255,
    size: tuple[int, int] = (64, 64),
) -> bytes:
    """Create a horizontal grayscale gradient JPEG image."""
    img = Image.new("L", size)
    pixels = img.load()
    width, height = size
    for x in range(width):
        value = int(start + (end - start) * x / (width - 1))
        for y in range(height):
            pixels[x, y] = value
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _hamming_distance(h1: int, h2: int) -> int:
    """Compute the Hamming distance between two integer hashes."""
    return bin(h1 ^ h2).count("1")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def solid_red_jpeg() -> bytes:
    """Solid red 64x64 JPEG."""
    return _make_jpeg((255, 0, 0))


@pytest.fixture
def solid_blue_jpeg() -> bytes:
    """Solid blue 64x64 JPEG."""
    return _make_jpeg((0, 0, 255))


@pytest.fixture
def bright_gradient_jpeg() -> bytes:
    """Horizontal gradient from dark (50) to bright (250)."""
    return _make_gradient_jpeg(start=50, end=250)


@pytest.fixture
def slightly_brighter_gradient_jpeg() -> bytes:
    """Same gradient shifted slightly brighter (55 to 255)."""
    return _make_gradient_jpeg(start=55, end=255)


@pytest.fixture
def inverted_gradient_jpeg() -> bytes:
    """Inverted gradient: bright (250) to dark (50)."""
    return _make_gradient_jpeg(start=250, end=50)


# ---------------------------------------------------------------------------
# Tests for compute_ahash
# ---------------------------------------------------------------------------


class TestComputeAhash:
    """Tests for the compute_ahash function."""

    def test_returns_integer(self, solid_red_jpeg: bytes):
        result = compute_ahash(solid_red_jpeg)
        assert isinstance(result, int)

    def test_identical_images_produce_identical_hashes(self, solid_red_jpeg: bytes):
        hash1 = compute_ahash(solid_red_jpeg)
        hash2 = compute_ahash(solid_red_jpeg)
        assert hash1 == hash2

    def test_similar_images_produce_similar_hashes(
        self,
        bright_gradient_jpeg: bytes,
        slightly_brighter_gradient_jpeg: bytes,
    ):
        hash1 = compute_ahash(bright_gradient_jpeg)
        hash2 = compute_ahash(slightly_brighter_gradient_jpeg)
        distance = _hamming_distance(hash1, hash2)
        # Slight brightness shift should yield a small hamming distance
        assert distance <= 10, f"Expected small hamming distance, got {distance}"

    def test_very_different_images_produce_different_hashes(
        self,
        bright_gradient_jpeg: bytes,
        inverted_gradient_jpeg: bytes,
    ):
        hash1 = compute_ahash(bright_gradient_jpeg)
        hash2 = compute_ahash(inverted_gradient_jpeg)
        distance = _hamming_distance(hash1, hash2)
        # A gradient and its inverse should differ substantially
        assert distance > 10, f"Expected large hamming distance, got {distance}"

    def test_different_solid_colors_may_have_same_hash(
        self,
        solid_red_jpeg: bytes,
        solid_blue_jpeg: bytes,
    ):
        """Solid color images collapse to a uniform grayscale, so aHash may be identical."""
        hash1 = compute_ahash(solid_red_jpeg)
        hash2 = compute_ahash(solid_blue_jpeg)
        # Both are uniform after grayscale conversion, distance should be very small
        distance = _hamming_distance(hash1, hash2)
        assert distance <= 5

    def test_custom_hash_size(self, bright_gradient_jpeg: bytes):
        hash_small = compute_ahash(bright_gradient_jpeg, hash_size=4)
        hash_large = compute_ahash(bright_gradient_jpeg, hash_size=16)
        # Smaller hash_size means fewer bits (4x4=16 bits max)
        assert hash_small < (1 << 16)
        # Larger hash_size means more bits (16x16=256 bits max)
        assert hash_large < (1 << 256)

    def test_hash_is_non_negative(self, solid_red_jpeg: bytes):
        result = compute_ahash(solid_red_jpeg)
        assert result >= 0

    def test_default_hash_fits_in_64_bits(self, bright_gradient_jpeg: bytes):
        """Default hash_size=8 produces an 8x8=64-bit hash."""
        result = compute_ahash(bright_gradient_jpeg)
        assert result < (1 << 64)


# ---------------------------------------------------------------------------
# Tests for is_duplicate
# ---------------------------------------------------------------------------


class TestIsDuplicate:
    """Tests for the is_duplicate function."""

    def test_identical_hashes_return_true(self):
        assert is_duplicate(0b1010101010, 0b1010101010) is True

    def test_hashes_within_threshold_return_true(self):
        # Hamming distance of 3 (3 bits differ) with default threshold of 5
        h1 = 0b00000000
        h2 = 0b00000111  # 3 bits differ
        assert is_duplicate(h1, h2) is True

    def test_hashes_at_exact_threshold_return_true(self):
        # Hamming distance of exactly 5
        h1 = 0b00000000
        h2 = 0b00011111  # 5 bits differ
        assert is_duplicate(h1, h2) is True

    def test_hashes_beyond_threshold_return_false(self):
        # Hamming distance of 6 with default threshold of 5
        h1 = 0b00000000
        h2 = 0b00111111  # 6 bits differ
        assert is_duplicate(h1, h2) is False

    def test_custom_threshold_stricter(self):
        h1 = 0b00000000
        h2 = 0b00000111  # 3 bits differ
        # threshold=2 should reject this
        assert is_duplicate(h1, h2, threshold=2) is False

    def test_custom_threshold_looser(self):
        h1 = 0b00000000
        h2 = 0b11111111  # 8 bits differ
        # threshold=10 should accept this
        assert is_duplicate(h1, h2, threshold=10) is True

    def test_threshold_zero_only_matches_exact_duplicates(self):
        assert is_duplicate(42, 42, threshold=0) is True
        # Even 1 bit difference should be rejected
        assert is_duplicate(0b0000, 0b0001, threshold=0) is False

    def test_large_hashes(self):
        """Test with realistic 64-bit hash values."""
        h1 = 0xDEADBEEFCAFEBABE
        h2 = 0xDEADBEEFCAFEBABE
        assert is_duplicate(h1, h2) is True

    def test_symmetry(self):
        """is_duplicate(a, b) should equal is_duplicate(b, a)."""
        h1 = 0b11110000
        h2 = 0b11001100
        assert is_duplicate(h1, h2) == is_duplicate(h2, h1)


# ---------------------------------------------------------------------------
# Integration: compute_ahash + is_duplicate together
# ---------------------------------------------------------------------------


class TestAhashWithIsDuplicate:
    """Integration tests combining compute_ahash and is_duplicate."""

    def test_identical_images_detected_as_duplicates(self, solid_red_jpeg: bytes):
        h1 = compute_ahash(solid_red_jpeg)
        h2 = compute_ahash(solid_red_jpeg)
        assert is_duplicate(h1, h2) is True

    def test_similar_images_detected_as_duplicates(
        self,
        bright_gradient_jpeg: bytes,
        slightly_brighter_gradient_jpeg: bytes,
    ):
        h1 = compute_ahash(bright_gradient_jpeg)
        h2 = compute_ahash(slightly_brighter_gradient_jpeg)
        assert is_duplicate(h1, h2) is True

    def test_very_different_images_not_detected_as_duplicates(
        self,
        bright_gradient_jpeg: bytes,
        inverted_gradient_jpeg: bytes,
    ):
        h1 = compute_ahash(bright_gradient_jpeg)
        h2 = compute_ahash(inverted_gradient_jpeg)
        assert is_duplicate(h1, h2) is False


# ---------------------------------------------------------------------------
# Tests for is_mostly_black
# ---------------------------------------------------------------------------


class TestWithinBlockDedupThreshold:
    """Tests for within-block dedup using relaxed threshold (12 vs default 5)."""

    def test_same_scene_minor_variation_caught(self):
        """Frames with hamming distance 6-14 should be caught at threshold 12."""
        h1 = 0b0000000000000000
        # 10 bits different — passes global (threshold=5) but caught at threshold=12
        h2 = 0b0000001111111111
        assert is_duplicate(h1, h2, threshold=5) is False  # global would miss it
        assert is_duplicate(h1, h2, threshold=12) is True   # within-block catches it

    def test_genuinely_different_visuals_pass(self):
        """Frames with hamming distance 20+ should pass through even at threshold 12."""
        h1 = 0b0000000000000000000000000000000000000000000000000000000000000000
        # 20 bits different
        h2 = 0b0000000000000000000000000000000000000000000011111111111111111111
        assert is_duplicate(h1, h2, threshold=12) is False

    def test_encoding_variation_caught(self):
        """JPEG re-encoding variation (6-8 bits) should be caught at threshold 12."""
        h1 = 0b11111111
        h2 = 0b10010111  # 3 bits differ
        assert is_duplicate(h1, h2, threshold=12) is True
        # Also caught at default threshold
        assert is_duplicate(h1, h2, threshold=5) is True


class TestIsMostlyBlack:
    """Tests for the is_mostly_black function."""

    def test_detects_black_frame(self):
        """Solid black image should be detected as mostly black."""
        black_jpeg = _make_jpeg((0, 0, 0))
        assert is_mostly_black(black_jpeg) is True

    def test_passes_normal_frame(self):
        """A bright image should not be detected as mostly black."""
        bright_jpeg = _make_jpeg((200, 200, 200))
        assert is_mostly_black(bright_jpeg) is False

    def test_near_black_detected(self):
        """Very dark gray image (brightness ~5) should be detected."""
        dark_jpeg = _make_jpeg((5, 5, 5))
        assert is_mostly_black(dark_jpeg) is True

    def test_custom_threshold(self):
        """Custom threshold should be respected."""
        gray_jpeg = _make_jpeg((50, 50, 50))
        # Default threshold (15) should pass this
        assert is_mostly_black(gray_jpeg) is False
        # High threshold should catch it
        assert is_mostly_black(gray_jpeg, threshold=60.0) is True

    def test_gradient_not_mostly_black(self):
        """A gradient with reasonable brightness should not be flagged."""
        gradient = _make_gradient_jpeg(start=50, end=250)
        assert is_mostly_black(gradient) is False
