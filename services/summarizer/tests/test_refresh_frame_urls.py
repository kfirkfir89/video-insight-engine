"""Tests for _refresh_frame_urls in stream routes."""

from unittest.mock import MagicMock, patch

import pytest


class TestRefreshFrameUrls:
    """Tests for _refresh_frame_urls sync helper."""

    def _get_refresh_fn(self):
        """Import the function to test."""
        from src.services.pipeline.pipeline_helpers import refresh_frame_urls
        return refresh_frame_urls

    def test_refresh_with_s3_key(self):
        chapters = [
            {
                "content": [
                    {"type": "paragraph", "text": "Hello"},
                    {"type": "visual", "s3_key": "videos/abc/frames/30.jpg", "imageUrl": "old-url"},
                ],
            },
        ]

        with patch("src.services.pipeline.pipeline_helpers.s3_client") as mock_s3:
            mock_s3.generate_presigned_url.return_value = "https://new-presigned-url"
            refresh = self._get_refresh_fn()
            refresh(chapters)

        assert chapters[0]["content"][1]["imageUrl"] == "https://new-presigned-url"
        assert chapters[0]["content"][0]["text"] == "Hello"  # non-visual unchanged

    def test_refresh_without_s3_key(self):
        chapters = [
            {
                "content": [
                    {"type": "visual", "imageUrl": "http://localhost:8000/frames/old.jpg"},
                ],
            },
        ]

        with patch("src.services.pipeline.pipeline_helpers.s3_client") as mock_s3:
            refresh = self._get_refresh_fn()
            refresh(chapters)

        # No s3_key — imageUrl should be unchanged
        assert chapters[0]["content"][0]["imageUrl"] == "http://localhost:8000/frames/old.jpg"
        mock_s3.generate_presigned_url.assert_not_called()

    def test_refresh_empty_chapters(self):
        chapters = []

        with patch("src.services.pipeline.pipeline_helpers.s3_client"):
            refresh = self._get_refresh_fn()
            refresh(chapters)  # Should not raise

    def test_refresh_chapter_without_content(self):
        chapters = [{"title": "Chapter 1"}]

        with patch("src.services.pipeline.pipeline_helpers.s3_client"):
            refresh = self._get_refresh_fn()
            refresh(chapters)  # Should not raise

    def test_refresh_handles_presign_error(self):
        chapters = [
            {
                "content": [
                    {"type": "visual", "s3_key": "videos/abc/frames/30.jpg", "imageUrl": "old-url"},
                ],
            },
        ]

        with patch("src.services.pipeline.pipeline_helpers.s3_client") as mock_s3:
            mock_s3.generate_presigned_url.side_effect = Exception("boto3 error")
            refresh = self._get_refresh_fn()
            refresh(chapters)

        # On error, imageUrl should remain unchanged
        assert chapters[0]["content"][0]["imageUrl"] == "old-url"

    def test_refresh_refreshes_frames_array(self):
        """Multi-frame visual blocks should have each frame's URL refreshed."""
        chapters = [
            {
                "content": [
                    {
                        "type": "visual",
                        "s3_key": "videos/abc/frames/120.jpg",
                        "imageUrl": "old-block-url",
                        "frames": [
                            {"s3_key": "videos/abc/frames/120.jpg", "imageUrl": "old-frame-1", "caption": "First"},
                            {"s3_key": "videos/abc/frames/135.jpg", "imageUrl": "old-frame-2", "caption": "Second"},
                            {"imageUrl": "external-url", "caption": "No s3_key"},
                        ],
                    },
                ],
            },
        ]

        call_count = 0

        def mock_presign(key):
            nonlocal call_count
            call_count += 1
            return f"https://new-signed/{key}"

        with patch("src.services.pipeline.pipeline_helpers.s3_client") as mock_s3:
            mock_s3.generate_presigned_url.side_effect = mock_presign
            refresh = self._get_refresh_fn()
            refresh(chapters)

        block = chapters[0]["content"][0]
        # Block-level URL refreshed
        assert block["imageUrl"] == "https://new-signed/videos/abc/frames/120.jpg"
        # Frame URLs refreshed where s3_key exists
        assert block["frames"][0]["imageUrl"] == "https://new-signed/videos/abc/frames/120.jpg"
        assert block["frames"][1]["imageUrl"] == "https://new-signed/videos/abc/frames/135.jpg"
        # Frame without s3_key should be unchanged
        assert block["frames"][2]["imageUrl"] == "external-url"
        # Total: 1 block-level + 2 frame-level = 3 calls
        assert call_count == 3
