"""Tests for scene-based frame extraction."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.media.scene_extractor import extract_scene_keyframes, cleanup_temp_dir

# Expected empty result from the 3-tier return shape
EMPTY_RESULT = {"all_frames": [], "selected_frames": [], "gallery_frames": []}


class TestExtractSceneKeyframes:
    """Test scene keyframe extraction."""

    @patch("src.services.media.scene_extractor.settings")
    def test_returns_empty_when_disabled(self, mock_settings):
        mock_settings.SCENE_EXTRACTION_ENABLED = False

        result = asyncio.get_event_loop().run_until_complete(
            extract_scene_keyframes("dQw4w9WgXcQ")
        )

        assert result == EMPTY_RESULT

    @patch("src.services.media.scene_extractor.YOUTUBE_ID_RE")
    @patch("src.services.media.scene_extractor.settings")
    def test_returns_empty_for_invalid_id(self, mock_settings, mock_re):
        mock_settings.SCENE_EXTRACTION_ENABLED = True
        mock_re.match.return_value = None

        result = asyncio.get_event_loop().run_until_complete(
            extract_scene_keyframes("invalid!")
        )

        assert result == EMPTY_RESULT

    @patch("src.services.media.scene_extractor._check_existing_frames", new_callable=AsyncMock, return_value=None)
    @patch("src.services.media.scene_extractor.s3_client")
    @patch("src.services.media.scene_extractor.settings")
    @patch("asyncio.create_subprocess_exec")
    def test_returns_empty_on_ytdlp_timeout(self, mock_exec, mock_settings, mock_s3, mock_check):
        mock_settings.SCENE_EXTRACTION_ENABLED = True
        mock_settings.SCENE_THRESHOLD = 0.3

        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError())
        mock_exec.return_value = mock_proc

        result = asyncio.get_event_loop().run_until_complete(
            extract_scene_keyframes("dQw4w9WgXcQ")
        )

        assert result == EMPTY_RESULT

    @patch("src.services.media.scene_extractor._check_existing_frames", new_callable=AsyncMock, return_value=None)
    @patch("src.services.media.scene_extractor.settings")
    def test_returns_empty_when_ytdlp_missing(self, mock_settings, mock_check):
        mock_settings.SCENE_EXTRACTION_ENABLED = True
        mock_settings.SCENE_THRESHOLD = 0.3

        with patch("asyncio.create_subprocess_exec", side_effect=FileNotFoundError):
            result = asyncio.get_event_loop().run_until_complete(
                extract_scene_keyframes("dQw4w9WgXcQ")
            )

        assert result == EMPTY_RESULT

    @patch("src.services.media.scene_extractor._check_existing_frames", new_callable=AsyncMock, return_value=None)
    @patch("src.services.media.scene_extractor.s3_client")
    @patch("src.services.media.scene_extractor.settings")
    @patch("src.services.media.scene_extractor.tempfile")
    @patch("asyncio.create_subprocess_exec")
    def test_returns_empty_on_ytdlp_failure(self, mock_exec, mock_tempfile, mock_settings, mock_s3, mock_check):
        mock_settings.SCENE_EXTRACTION_ENABLED = True
        mock_settings.SCENE_THRESHOLD = 0.3
        mock_tempfile.mkdtemp.return_value = "/tmp/vie-scene-test"

        # yt-dlp returns non-zero
        mock_proc = AsyncMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b"", b"error"))
        mock_exec.return_value = mock_proc

        with patch("src.services.media.scene_extractor.Path") as mock_path:
            mock_video = MagicMock()
            mock_video.exists.return_value = False
            mock_frames_dir = MagicMock()
            mock_path.return_value.__truediv__ = MagicMock(side_effect=[mock_video, mock_frames_dir])

            result = asyncio.get_event_loop().run_until_complete(
                extract_scene_keyframes("dQw4w9WgXcQ")
            )

        assert result == EMPTY_RESULT

    @patch("src.services.media.scene_extractor._check_existing_frames", new_callable=AsyncMock)
    @patch("src.services.media.scene_extractor.settings")
    def test_s3_cache_hit_skips_extraction(self, mock_settings, mock_check):
        """When S3 already has frames, return them without FFmpeg."""
        mock_settings.SCENE_EXTRACTION_ENABLED = True
        existing_frames = [{"index": i, "s3_key": f"scene_{i}.jpg", "s3_url": f"url_{i}"} for i in range(15)]
        mock_check.return_value = existing_frames

        result = asyncio.get_event_loop().run_until_complete(
            extract_scene_keyframes("dQw4w9WgXcQ")
        )

        assert len(result["all_frames"]) == 15
        assert len(result["gallery_frames"]) == 12


class TestCleanupTempDir:
    """Test temp directory cleanup."""

    @patch("src.services.media.scene_extractor.shutil")
    def test_cleanup_calls_rmtree(self, mock_shutil):
        asyncio.get_event_loop().run_until_complete(
            cleanup_temp_dir("/tmp/vie-scene-test")
        )
        mock_shutil.rmtree.assert_called_once_with("/tmp/vie-scene-test", ignore_errors=True)

    @patch("src.services.media.scene_extractor.shutil")
    def test_cleanup_handles_errors(self, mock_shutil):
        mock_shutil.rmtree.side_effect = Exception("cleanup failed")

        # Should not raise
        asyncio.get_event_loop().run_until_complete(
            cleanup_temp_dir("/tmp/vie-scene-nonexistent")
        )
