"""Tests for Whisper transcriber service."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, mock_open

from src.services.whisper_transcriber import (
    _download_audio_sync,
    _transcribe_sync,
    _create_estimated_segments,
    transcribe_with_whisper,
    TEMP_DIR,
    MAX_AUDIO_SIZE_MB,
)
from src.models.schemas import ErrorCode
from src.exceptions import TranscriptError


class TestDownloadAudioSync:
    """Tests for _download_audio_sync function."""

    @patch("src.services.whisper_transcriber.yt_dlp.YoutubeDL")
    def test_download_audio_success(self, mock_ydl_class, tmp_path):
        """Test successful audio download."""
        video_id = "test123"

        # Create a mock mp3 file
        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)  # ~18KB

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path
            mock_ydl.download.assert_called_once()

    @patch("src.services.whisper_transcriber.yt_dlp.YoutubeDL")
    def test_download_audio_failure(self, mock_ydl_class):
        """Test download failure raises TranscriptError."""
        video_id = "test123"

        mock_ydl = MagicMock()
        mock_ydl.download.side_effect = Exception("Network error")
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(TranscriptError) as exc_info:
            _download_audio_sync(video_id)

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE
        assert "Failed to download audio" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.yt_dlp.YoutubeDL")
    def test_download_audio_file_not_found(self, mock_ydl_class, tmp_path):
        """Test error when download completes but file not found."""
        video_id = "test123"

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            with pytest.raises(TranscriptError) as exc_info:
                _download_audio_sync(video_id)

            assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
            assert "file not found" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.yt_dlp.YoutubeDL")
    def test_download_audio_file_too_large(self, mock_ydl_class, tmp_path):
        """Test error when audio file exceeds size limit."""
        video_id = "test123"

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            # Create an oversized file (>25MB)
            mp3_path = tmp_path / f"{video_id}.mp3"
            mp3_path.write_bytes(b"x" * (MAX_AUDIO_SIZE_MB + 1) * 1024 * 1024)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            with pytest.raises(TranscriptError) as exc_info:
                _download_audio_sync(video_id)

            assert exc_info.value.code == ErrorCode.VIDEO_TOO_LONG
            assert "too large" in str(exc_info.value)


class TestTranscribeSync:
    """Tests for _transcribe_sync function."""

    @patch("src.services.whisper_transcriber.settings")
    def test_transcribe_no_api_key(self, mock_settings, tmp_path):
        """Test error when OpenAI API key not configured."""
        mock_settings.OPENAI_API_KEY = None
        audio_path = tmp_path / "test.mp3"
        audio_path.write_bytes(b"fake audio")

        with pytest.raises(TranscriptError) as exc_info:
            _transcribe_sync(audio_path)

        assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
        assert "API key not configured" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.OpenAI")
    @patch("src.services.whisper_transcriber.settings")
    def test_transcribe_success(self, mock_settings, mock_openai_class, tmp_path):
        """Test successful transcription."""
        mock_settings.OPENAI_API_KEY = "test-key"
        audio_path = tmp_path / "test.mp3"
        audio_path.write_bytes(b"fake audio")

        # Mock the OpenAI response
        mock_response = MagicMock()
        mock_response.text = "This is a test transcription."
        mock_response.segments = [
            {"text": "This is", "start": 0.0, "end": 1.0},
            {"text": "a test transcription.", "start": 1.0, "end": 2.5},
        ]

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        result = _transcribe_sync(audio_path)

        assert result["text"] == "This is a test transcription."
        assert len(result["segments"]) == 2
        mock_client.audio.transcriptions.create.assert_called_once()

    @patch("src.services.whisper_transcriber.OpenAI")
    @patch("src.services.whisper_transcriber.settings")
    def test_transcribe_api_error(self, mock_settings, mock_openai_class, tmp_path):
        """Test transcription API error."""
        mock_settings.OPENAI_API_KEY = "test-key"
        audio_path = tmp_path / "test.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.side_effect = Exception("API error")
        mock_openai_class.return_value = mock_client

        with pytest.raises(TranscriptError) as exc_info:
            _transcribe_sync(audio_path)

        assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
        assert "Whisper transcription failed" in str(exc_info.value)


class TestCreateEstimatedSegments:
    """Tests for _create_estimated_segments function."""

    def test_empty_text(self):
        """Test with empty text."""
        result = _create_estimated_segments("")
        assert result == []

    def test_short_text(self):
        """Test with text shorter than one segment."""
        text = "Hello world this is a test"
        result = _create_estimated_segments(text)

        assert len(result) == 1
        assert result[0].text == text
        assert result[0].startMs == 0

    def test_long_text_creates_multiple_segments(self):
        """Test that long text creates multiple segments."""
        words = ["word"] * 100  # 100 words
        text = " ".join(words)
        result = _create_estimated_segments(text)

        # 100 words / 30 words per segment = 4 segments (with remainder)
        assert len(result) == 4

        # Check timestamps are sequential
        for i, seg in enumerate(result):
            assert seg.startMs >= 0
            assert seg.endMs > seg.startMs
            if i > 0:
                assert seg.startMs >= result[i - 1].startMs

    def test_segment_timing_estimation(self):
        """Test that segment timing follows speech rate estimation."""
        words = ["word"] * 30  # Exactly one segment worth
        text = " ".join(words)
        result = _create_estimated_segments(text)

        assert len(result) == 1
        # 30 words at 2.5 words/second = 12 seconds = 12000ms
        assert result[0].startMs == 0
        assert result[0].endMs == 12000


class TestTranscribeWithWhisper:
    """Tests for transcribe_with_whisper async function."""

    @patch("src.services.whisper_transcriber._transcribe_sync")
    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_full_workflow_success(self, mock_download, mock_transcribe, tmp_path):
        """Test successful full transcription workflow."""
        video_id = "test123"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_download.return_value = audio_path
        mock_transcribe.return_value = {
            "text": "This is the transcript.",
            "segments": [
                {"text": "This is", "start": 0.0, "end": 1.0},
                {"text": "the transcript.", "start": 1.0, "end": 2.0},
            ],
        }

        result = await transcribe_with_whisper(video_id)

        assert result.text == "This is the transcript."
        assert result.source == "whisper"
        assert len(result.segments) == 2
        assert result.segments[0].startMs == 0
        assert result.segments[0].endMs == 1000

    @patch("src.services.whisper_transcriber._transcribe_sync")
    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_workflow_uses_estimated_segments(
        self, mock_download, mock_transcribe, tmp_path
    ):
        """Test fallback to estimated segments when Whisper returns none."""
        video_id = "test123"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_download.return_value = audio_path
        mock_transcribe.return_value = {
            "text": "This is a test transcript with multiple words for estimation.",
            "segments": [],  # No segments returned
        }

        result = await transcribe_with_whisper(video_id)

        assert result.source == "whisper"
        assert len(result.segments) > 0
        # Segments should be estimated, not from Whisper

    @patch("src.services.whisper_transcriber._transcribe_sync")
    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_cleanup_on_success(self, mock_download, mock_transcribe, tmp_path):
        """Test that audio file is cleaned up after success."""
        video_id = "test123"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_download.return_value = audio_path
        mock_transcribe.return_value = {"text": "Test", "segments": []}

        await transcribe_with_whisper(video_id)

        # File should be deleted
        assert not audio_path.exists()

    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_cleanup_on_error(self, mock_download, tmp_path):
        """Test that audio file is cleaned up even on error."""
        video_id = "test123"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_download.return_value = audio_path

        with patch(
            "src.services.whisper_transcriber._transcribe_sync",
            side_effect=TranscriptError("Error", ErrorCode.UNKNOWN_ERROR),
        ):
            with pytest.raises(TranscriptError):
                await transcribe_with_whisper(video_id)

        # File should still be deleted
        assert not audio_path.exists()

    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_download_error_propagates(self, mock_download):
        """Test that download errors propagate correctly."""
        mock_download.side_effect = TranscriptError(
            "Download failed", ErrorCode.VIDEO_UNAVAILABLE
        )

        with pytest.raises(TranscriptError) as exc_info:
            await transcribe_with_whisper("test123")

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE
