"""Tests for smart frame scoring, selection, and classification."""

from unittest.mock import MagicMock, patch

from src.services.media.frame_scorer import (
    _hamming_distance,
    classify_for_gallery,
    compute_target_count,
    score_all_frames,
    score_face_detection,
    score_frame,
    score_text_density,
    score_uniqueness,
    score_visual_interest,
    select_by_time_slots,
    select_frames,
)

# ─────────────────────────────────────────────────────
# Helper: create mock frame dicts
# ─────────────────────────────────────────────────────


def _frame(index: int, timestamp: float = 0.0, path: str = "/tmp/frame.jpg", **extra) -> dict:
    return {"index": index, "timestamp": timestamp, "path": path, **extra}


# ─────────────────────────────────────────────────────
# score_uniqueness (pure computation, no I/O)
# ─────────────────────────────────────────────────────


class TestScoreUniqueness:
    def test_identical_hashes_score_zero(self):
        h = 0b10101010
        assert score_uniqueness(h, h, h) == 0.0

    def test_completely_different_hashes_score_high(self):
        h1 = 0
        h2 = (1 << 64) - 1  # all bits set
        score = score_uniqueness(h1, h2, h2)
        assert score == 1.0

    def test_no_neighbors_returns_default(self):
        assert score_uniqueness(42, None, None) == 0.5

    def test_one_neighbor_only(self):
        # Only prev neighbor
        score = score_uniqueness(0, 0xFF, None)
        assert 0.0 < score <= 1.0

    def test_max_of_prev_and_next(self):
        # prev is identical, next is very different
        h = 0
        prev = 0  # identical
        nxt = (1 << 32) - 1  # ~50% bits different
        score = score_uniqueness(h, prev, nxt)
        assert score > 0.0


class TestHammingDistance:
    def test_identical(self):
        assert _hamming_distance(42, 42) == 0

    def test_one_bit_diff(self):
        assert _hamming_distance(0b1000, 0b1001) == 1

    def test_all_bits_diff_8bit(self):
        assert _hamming_distance(0b00000000, 0b11111111) == 8


# ─────────────────────────────────────────────────────
# compute_target_count
# ─────────────────────────────────────────────────────


class TestComputeTargetCount:
    def test_short_video_5min(self):
        assert compute_target_count(300) == 15  # 300/30 = 10, clamped to 15

    def test_medium_video_10min(self):
        assert compute_target_count(600) == 20  # 600/30 = 20

    def test_long_video_16min(self):
        # 960/30 = 32, clamped to 30
        assert compute_target_count(960) == 30

    def test_very_long_video_60min(self):
        assert compute_target_count(3600) == 30  # capped at 30

    def test_none_duration(self):
        assert compute_target_count(None) == 20

    def test_zero_duration(self):
        assert compute_target_count(0) == 20

    def test_negative_duration(self):
        assert compute_target_count(-100) == 20


# ─────────────────────────────────────────────────────
# select_by_time_slots
# ─────────────────────────────────────────────────────


class TestSelectByTimeSlots:
    def test_even_distribution(self):
        """Frames should cover the full video duration."""
        frames = [
            _frame(i, timestamp=i * 10.0, total_score=0.5)
            for i in range(50)  # 50 frames across 500s
        ]
        selected = select_by_time_slots(frames, duration_seconds=500, target_count=10)
        assert len(selected) <= 10
        # First and last frames should be near start and end
        timestamps = [f["timestamp"] for f in selected]
        assert timestamps[0] < 100  # first third
        assert timestamps[-1] > 300  # last third

    def test_empty_input(self):
        assert select_by_time_slots([], duration_seconds=100) == []

    def test_skips_black_frames(self):
        """Frames with total_score=0 should be skipped."""
        frames = [
            _frame(0, timestamp=0.0, total_score=0.0),  # black
            _frame(1, timestamp=10.0, total_score=0.8),
            _frame(2, timestamp=20.0, total_score=0.0),  # black
        ]
        selected = select_by_time_slots(frames, duration_seconds=30, target_count=15)
        assert all(f["total_score"] > 0 for f in selected)

    def test_picks_highest_scored_per_slot(self):
        """Within each time slot, the highest scored frame wins."""
        frames = [
            _frame(0, timestamp=5.0, total_score=0.3),
            _frame(1, timestamp=8.0, total_score=0.9),  # same slot, higher score
            _frame(2, timestamp=50.0, total_score=0.5),
        ]
        selected = select_by_time_slots(frames, duration_seconds=100, target_count=15)
        # Frame 1 should be selected over frame 0
        selected_indices = {f["index"] for f in selected}
        assert 1 in selected_indices

    def test_sorted_by_timestamp(self):
        frames = [
            _frame(0, timestamp=90.0, total_score=0.5),
            _frame(1, timestamp=10.0, total_score=0.5),
            _frame(2, timestamp=50.0, total_score=0.5),
        ]
        selected = select_by_time_slots(frames, duration_seconds=100, target_count=15)
        timestamps = [f["timestamp"] for f in selected]
        assert timestamps == sorted(timestamps)


# ─────────────────────────────────────────────────────
# classify_for_gallery
# ─────────────────────────────────────────────────────


class TestClassifyForGallery:
    def test_correct_count(self):
        frames = [_frame(i, timestamp=i * 10.0, total_score=i * 0.1) for i in range(25)]
        gallery = classify_for_gallery(frames)
        assert len(gallery) == 12  # ceil(25 * 0.48) = 12

    def test_sorted_by_timestamp(self):
        frames = [
            _frame(0, timestamp=100.0, total_score=0.9),
            _frame(1, timestamp=10.0, total_score=0.8),
            _frame(2, timestamp=50.0, total_score=0.7),
        ]
        gallery = classify_for_gallery(frames, gallery_ratio=1.0)
        timestamps = [f["timestamp"] for f in gallery]
        assert timestamps == sorted(timestamps)

    def test_picks_highest_scored(self):
        frames = [
            _frame(0, total_score=0.1),
            _frame(1, total_score=0.9),
            _frame(2, total_score=0.5),
        ]
        gallery = classify_for_gallery(frames, gallery_ratio=0.5)
        # Should include the highest scored frame
        indices = {f["index"] for f in gallery}
        assert 1 in indices

    def test_empty_input(self):
        assert classify_for_gallery([]) == []

    def test_minimum_6(self):
        frames = [_frame(i, total_score=0.5) for i in range(10)]
        gallery = classify_for_gallery(frames, gallery_ratio=0.1)
        assert len(gallery) >= 6


# ─────────────────────────────────────────────────────
# select_frames (orchestrator)
# ─────────────────────────────────────────────────────


class TestSelectFrames:
    def test_returns_tuple(self):
        frames = [_frame(i, timestamp=i * 10.0, total_score=0.5) for i in range(50)]
        selected, gallery = select_frames(frames, duration_seconds=500)
        assert isinstance(selected, list)
        assert isinstance(gallery, list)
        assert len(gallery) <= len(selected)

    def test_gallery_is_subset_of_selected(self):
        frames = [_frame(i, timestamp=i * 10.0, total_score=0.5) for i in range(50)]
        selected, gallery = select_frames(frames, duration_seconds=500)
        selected_indices = {f["index"] for f in selected}
        gallery_indices = {f["index"] for f in gallery}
        assert gallery_indices.issubset(selected_indices)


# ─────────────────────────────────────────────────────
# score_all_frames (mocked I/O)
# ─────────────────────────────────────────────────────


class TestScoreAllFrames:
    @patch("src.services.media.frame_scorer.score_frame")
    @patch("src.services.media.image_dedup.compute_ahash", return_value=42)
    @patch("src.services.media.image_dedup.is_mostly_black", return_value=False)
    def test_scores_all_frames(self, mock_black, mock_ahash, mock_score_frame):
        mock_score_frame.return_value = {
            "visual_score": 0.5,
            "face_score": 0.3,
            "text_score": 0.2,
            "uniqueness_score": 0.4,
            "total_score": 0.35,
        }

        with patch("builtins.open", MagicMock()):
            frames = [_frame(i, path=f"/tmp/f{i}.jpg") for i in range(3)]
            scored = score_all_frames(frames)

        assert len(scored) == 3
        assert all("total_score" in f for f in scored)

    def test_handles_missing_path(self):
        frames = [{"index": 0}]  # no path
        scored = score_all_frames(frames)
        assert len(scored) == 1
        assert scored[0]["total_score"] == 0.0

    @patch("src.services.media.image_dedup.compute_ahash", return_value=0)
    @patch("src.services.media.image_dedup.is_mostly_black", return_value=True)
    def test_black_frames_score_zero(self, mock_black, mock_hash):
        with patch("builtins.open", MagicMock()):
            frames = [_frame(0, path="/tmp/black.jpg")]
            scored = score_all_frames(frames)
        assert scored[0]["total_score"] == 0.0
        assert scored[0].get("is_black") is True


# ─────────────────────────────────────────────────────
# score_visual_interest (mocked cv2)
# ─────────────────────────────────────────────────────


class TestScoreVisualInterest:
    @patch("src.services.media.frame_scorer._get_cv2")
    def test_returns_float_in_range(self, mock_get_cv2):
        import numpy as np

        mock_cv2 = MagicMock()
        mock_get_cv2.return_value = mock_cv2

        # Mock a colorful image (high saturation)
        img = np.full((100, 100, 3), 128, dtype=np.uint8)
        hsv = np.full((100, 100, 3), 200, dtype=np.uint8)  # high saturation
        mock_cv2.imread.return_value = img
        mock_cv2.cvtColor.return_value = hsv
        mock_cv2.COLOR_BGR2HSV = 40

        score = score_visual_interest("/tmp/test.jpg")
        assert 0.0 <= score <= 1.0

    @patch("src.services.media.frame_scorer._get_cv2")
    def test_unreadable_image_returns_zero(self, mock_get_cv2):
        mock_cv2 = MagicMock()
        mock_get_cv2.return_value = mock_cv2
        mock_cv2.imread.return_value = None

        assert score_visual_interest("/tmp/missing.jpg") == 0.0


class TestScoreFaceDetection:
    @patch("src.services.media.frame_scorer._get_face_cascade")
    @patch("src.services.media.frame_scorer._get_cv2")
    def test_no_face(self, mock_cv2, mock_cascade):
        import numpy as np

        mock_cv2.return_value.imread.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_cv2.return_value.IMREAD_GRAYSCALE = 0
        mock_cascade.return_value.detectMultiScale.return_value = []

        assert score_face_detection("/tmp/test.jpg") == 0.0

    @patch("src.services.media.frame_scorer._get_face_cascade")
    @patch("src.services.media.frame_scorer._get_cv2")
    def test_one_face(self, mock_cv2, mock_cascade):
        import numpy as np

        mock_cv2.return_value.imread.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_cv2.return_value.IMREAD_GRAYSCALE = 0
        mock_cascade.return_value.detectMultiScale.return_value = [(10, 10, 50, 50)]

        assert score_face_detection("/tmp/test.jpg") == 0.5

    @patch("src.services.media.frame_scorer._get_face_cascade")
    @patch("src.services.media.frame_scorer._get_cv2")
    def test_two_faces_cap_at_one(self, mock_cv2, mock_cascade):
        import numpy as np

        mock_cv2.return_value.imread.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_cv2.return_value.IMREAD_GRAYSCALE = 0
        mock_cascade.return_value.detectMultiScale.return_value = [
            (10, 10, 50, 50),
            (60, 10, 50, 50),
        ]

        assert score_face_detection("/tmp/test.jpg") == 1.0


class TestScoreTextDensity:
    @patch("src.services.media.frame_ocr.estimate_text_density", return_value=0.25)
    def test_delegates_to_frame_ocr(self, mock_density):
        assert score_text_density("/tmp/test.jpg") == 0.25
        mock_density.assert_called_once_with("/tmp/test.jpg")


class TestCascadeUnavailable:
    """Regression: OpenCV 5 removed cv2.CascadeClassifier. The scorer must
    degrade to a neutral face score (one warning, no per-frame raise) so the
    other three components still produce a real ranking."""

    def _reset_cascade_cache(self):
        import src.services.media.frame_scorer as fs

        fs._face_cascade = None

    @patch("src.services.media.frame_scorer._get_cv2")
    def test_missing_cascade_class_returns_neutral_score(self, mock_get_cv2):
        self._reset_cascade_cache()
        mock_cv2 = MagicMock()
        # Simulate OpenCV 5: attribute access raises AttributeError.
        del mock_cv2.CascadeClassifier
        mock_get_cv2.return_value = mock_cv2

        try:
            # 0.5 is the true neutral: the score is INVERTED into the total,
            # so 0.0 would grant every frame the maximum anti-face bonus.
            assert score_face_detection("/tmp/test.jpg") == 0.5
        finally:
            self._reset_cascade_cache()

    @patch("src.services.media.frame_scorer._get_cv2")
    def test_failure_is_cached_not_retried(self, mock_get_cv2):
        self._reset_cascade_cache()
        mock_cv2 = MagicMock()
        del mock_cv2.CascadeClassifier
        mock_get_cv2.return_value = mock_cv2

        from src.services.media.frame_scorer import _get_face_cascade

        try:
            assert _get_face_cascade() is None
            assert _get_face_cascade() is None
            # Construction attempted exactly once — the sentinel prevents
            # 500 retries (and 500 log lines) per video.
            assert mock_get_cv2.call_count == 1
            import src.services.media.frame_scorer as fs

            assert fs._face_cascade is False
        finally:
            self._reset_cascade_cache()

    @patch("src.services.media.frame_scorer.score_uniqueness", return_value=0.5)
    @patch("src.services.media.frame_scorer.score_text_density", return_value=0.4)
    @patch("src.services.media.frame_scorer.score_face_detection", return_value=0.0)
    @patch("src.services.media.frame_scorer.score_visual_interest", return_value=0.6)
    def test_other_components_still_rank_without_faces(self, *_mocks):
        scores = score_frame("/tmp/test.jpg", 0b1010, None, None)
        # face=0.0 contributes its full inverted weight; total is non-zero so
        # selection doesn't collapse to the all-zeros fallback path.
        assert scores["total_score"] > 0
        assert scores["face_score"] == 0.0


class TestNewSubjectSignals:
    """skin-fraction + center-detail — the anti-presenter / pro-subject pair."""

    @staticmethod
    def _write_img(path, build):
        import numpy as np

        from PIL import Image

        arr = build(np)
        Image.fromarray(arr).save(path, "JPEG")

    def test_skin_fraction_high_for_skin_toned_frame(self, tmp_path):
        p = str(tmp_path / "skin.jpg")
        self._write_img(
            p,
            lambda np: np.full((64, 64, 3), (200, 140, 110), dtype=np.uint8),
        )
        from src.services.media.frame_scorer import score_skin_fraction

        assert score_skin_fraction(p) > 0.5

    def test_skin_fraction_low_for_neutral_frame(self, tmp_path):
        p = str(tmp_path / "card.jpg")
        self._write_img(
            p,
            lambda np: np.full((64, 64, 3), (30, 60, 200), dtype=np.uint8),
        )
        from src.services.media.frame_scorer import score_skin_fraction

        assert score_skin_fraction(p) < 0.1

    def test_center_detail_high_for_sharp_center(self, tmp_path):
        p = str(tmp_path / "detail.jpg")

        def build(np):
            arr = np.zeros((128, 128), dtype=np.uint8)
            arr[32:96, 32:96] = (np.indices((64, 64)).sum(axis=0) % 2) * 255
            return np.stack([arr] * 3, axis=-1)

        self._write_img(p, build)
        from src.services.media.frame_scorer import score_center_detail

        assert score_center_detail(p) > 0.5

    def test_center_detail_low_for_flat_frame(self, tmp_path):
        p = str(tmp_path / "flat.jpg")
        self._write_img(p, lambda np: np.full((128, 128, 3), 128, dtype=np.uint8))
        from src.services.media.frame_scorer import score_center_detail

        assert score_center_detail(p) < 0.1

    def test_weights_sum_to_one(self):
        from src.services.media import frame_scorer as fs

        total = (
            fs.WEIGHT_VISUAL
            + fs.WEIGHT_FACE
            + fs.WEIGHT_SKIN
            + fs.WEIGHT_CENTER_DETAIL
            + fs.WEIGHT_TEXT
            + fs.WEIGHT_UNIQUENESS
        )
        assert abs(total - 1.0) < 1e-9
