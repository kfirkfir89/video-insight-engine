"""Tests for frame OCR service."""

import pytest
from unittest.mock import patch, MagicMock

import numpy as np


class TestEstimateTextDensity:
    """Test text density estimation."""

    @patch("src.services.media.frame_ocr._get_cv2")
    def test_returns_float_between_0_and_1(self, mock_get_cv2):
        cv2 = MagicMock()
        mock_get_cv2.return_value = cv2

        # Create a fake grayscale image
        fake_img = np.zeros((100, 100), dtype=np.uint8)
        cv2.imread.return_value = fake_img

        # Canny returns some edges
        edges = np.zeros((100, 100), dtype=np.uint8)
        edges[10:20, 10:90] = 255  # Some edges
        cv2.Canny.return_value = edges

        from src.services.media.frame_ocr import estimate_text_density

        result = estimate_text_density("/fake/path.jpg")

        assert 0.0 <= result <= 1.0
        cv2.imread.assert_called_once()

    @patch("src.services.media.frame_ocr._get_cv2")
    def test_returns_zero_for_invalid_image(self, mock_get_cv2):
        cv2 = MagicMock()
        mock_get_cv2.return_value = cv2
        cv2.imread.return_value = None

        from src.services.media.frame_ocr import estimate_text_density

        result = estimate_text_density("/fake/nonexistent.jpg")
        assert result == 0.0


class TestExtractTextFromFrames:
    """Test batch OCR extraction."""

    @patch("src.services.media.frame_ocr.run_ocr")
    @patch("src.services.media.frame_ocr.estimate_text_density")
    def test_filters_by_density_threshold(self, mock_density, mock_ocr):
        mock_density.side_effect = [0.05, 0.20, 0.10]
        mock_ocr.return_value = "Some detected text here"

        from src.services.media.frame_ocr import extract_text_from_frames

        frames = [
            {"path": "/f1.jpg", "index": 0},
            {"path": "/f2.jpg", "index": 1},
            {"path": "/f3.jpg", "index": 2},
        ]

        results = extract_text_from_frames(frames, density_threshold=0.15)

        # Only frame 2 (density 0.20) passes threshold
        assert len(results) == 1
        assert results[0]["index"] == 1
        assert results[0]["ocr_text"] == "Some detected text here"

    @patch("src.services.media.frame_ocr.run_ocr")
    @patch("src.services.media.frame_ocr.estimate_text_density")
    def test_skips_short_ocr_text(self, mock_density, mock_ocr):
        mock_density.return_value = 0.30
        mock_ocr.return_value = "short"  # < 10 chars

        from src.services.media.frame_ocr import extract_text_from_frames

        frames = [{"path": "/f1.jpg", "index": 0}]
        results = extract_text_from_frames(frames, density_threshold=0.15)

        assert len(results) == 0


class TestEnrichTranscriptWithOcr:
    """Test transcript enrichment with OCR results."""

    def test_appends_ocr_text(self):
        from src.services.media.frame_ocr import enrich_transcript_with_ocr

        transcript = "Original transcript text."
        ocr_results = [
            {"index": 5, "ocr_text": "def main():"},
            {"index": 12, "ocr_text": "pip install numpy"},
        ]

        result = enrich_transcript_with_ocr(transcript, ocr_results)

        assert "Original transcript text." in result
        assert "ON-SCREEN TEXT DETECTED" in result
        assert "def main():" in result
        assert "pip install numpy" in result

    def test_no_ocr_results_unchanged(self):
        from src.services.media.frame_ocr import enrich_transcript_with_ocr

        transcript = "Original text."
        result = enrich_transcript_with_ocr(transcript, [])

        assert result == transcript
