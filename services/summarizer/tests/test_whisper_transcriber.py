"""Tests for Whisper transcriber service."""

import pytest
from unittest.mock import MagicMock, patch

from src.services.whisper_transcriber import (
    _download_audio_sync,
    _transcribe_sync,
    _split_audio_chunks,
    _transcribe_chunked_sync,
    _create_estimated_segments,
    transcribe_with_whisper,
    CHUNK_TARGET_SIZE_MB,
)
from src.services.download_utils import classify_download_error, MAX_DOWNLOAD_ATTEMPTS
from src.models.schemas import ErrorCode
from src.exceptions import TranscriptError


class TestDownloadAudioSync:
    """Tests for _download_audio_sync function."""

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_success(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test successful audio download with unique filename."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)  # ~18KB

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path
            mock_ydl.download.assert_called_once()

    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_failure(self, mock_ydl_class, mock_sleep):
        """Test download failure raises TranscriptError with DOWNLOAD_ERROR."""
        video_id = "test123"

        mock_ydl = MagicMock()
        mock_ydl.download.side_effect = Exception("Network error")
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(TranscriptError) as exc_info:
            _download_audio_sync(video_id)

        assert exc_info.value.code == ErrorCode.DOWNLOAD_ERROR
        assert "Failed to download audio" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_file_not_found(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test error when download completes but file not found."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            with pytest.raises(TranscriptError) as exc_info:
                _download_audio_sync(video_id)

            assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
            assert "file not found" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_large_file_not_rejected(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test that large audio files are no longer rejected at download."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            # 30MB file - would have been rejected before
            mp3_path.write_bytes(b"x" * 30 * 1024 * 1024)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path


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


class TestSplitAudioChunks:
    """Tests for _split_audio_chunks function."""

    @patch("src.services.whisper_transcriber.AudioSegment")
    def test_split_creates_correct_number_of_chunks(self, mock_audio_cls, tmp_path):
        """Test that splitting creates expected number of chunks."""
        audio_path = tmp_path / "video123.mp3"
        # 50MB file -> should produce 3 chunks at 24MB target
        audio_path.write_bytes(b"x" * 50 * 1024 * 1024)

        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=600_000)  # 600s = 10min
        mock_audio.__getitem__ = MagicMock(return_value=MagicMock())
        mock_audio_cls.from_mp3.return_value = mock_audio

        chunks = _split_audio_chunks(audio_path)

        # 50MB file, 600s, bytes_per_ms=~87.38
        # chunk_duration_ms = 24*1024*1024 / 87.38 = ~288,000ms
        # 600,000 / 288,000 = ~2.08 -> 3 chunks
        assert len(chunks) == 3
        assert chunks[0][1] == 0  # First chunk offset is 0

    @patch("src.services.whisper_transcriber.AudioSegment")
    def test_split_offsets_are_sequential(self, mock_audio_cls, tmp_path):
        """Test that chunk offsets increase correctly."""
        audio_path = tmp_path / "video123.mp3"
        audio_path.write_bytes(b"x" * 50 * 1024 * 1024)

        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=600_000)
        mock_audio.__getitem__ = MagicMock(return_value=MagicMock())
        mock_audio_cls.from_mp3.return_value = mock_audio

        chunks = _split_audio_chunks(audio_path)

        offsets = [offset for _, offset in chunks]
        # Offsets should be strictly increasing
        for i in range(1, len(offsets)):
            assert offsets[i] > offsets[i - 1]

    @patch("src.services.whisper_transcriber.AudioSegment")
    def test_split_chunk_paths_named_correctly(self, mock_audio_cls, tmp_path):
        """Test that chunk files are named with correct pattern."""
        audio_path = tmp_path / "abc123.mp3"
        audio_path.write_bytes(b"x" * 50 * 1024 * 1024)

        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=600_000)
        mock_audio.__getitem__ = MagicMock(return_value=MagicMock())
        mock_audio_cls.from_mp3.return_value = mock_audio

        chunks = _split_audio_chunks(audio_path)

        for i, (chunk_path, _) in enumerate(chunks):
            assert chunk_path.name == f"abc123_chunk_{i}.mp3"
            assert chunk_path.parent == tmp_path

    @patch("src.services.whisper_transcriber.AudioSegment")
    def test_split_zero_duration_raises(self, mock_audio_cls, tmp_path):
        """Test that zero-duration audio raises TranscriptError."""
        audio_path = tmp_path / "video123.mp3"
        audio_path.write_bytes(b"x" * 1024)

        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=0)
        mock_audio_cls.from_mp3.return_value = mock_audio

        with pytest.raises(TranscriptError) as exc_info:
            _split_audio_chunks(audio_path)

        assert "zero duration" in str(exc_info.value)

    @patch("src.services.whisper_transcriber.AudioSegment")
    def test_split_small_file_produces_one_chunk(self, mock_audio_cls, tmp_path):
        """Test that a file under chunk size produces exactly one chunk."""
        audio_path = tmp_path / "video123.mp3"
        audio_path.write_bytes(b"x" * 10 * 1024 * 1024)  # 10MB

        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=120_000)  # 2min
        mock_audio.__getitem__ = MagicMock(return_value=MagicMock())
        mock_audio_cls.from_mp3.return_value = mock_audio

        chunks = _split_audio_chunks(audio_path)

        assert len(chunks) == 1
        assert chunks[0][1] == 0


@patch("src.services.whisper_transcriber.OpenAI")
class TestTranscribeChunkedSync:
    """Tests for _transcribe_chunked_sync function."""

    @patch("src.services.whisper_transcriber._transcribe_sync")
    def test_merges_text_from_all_chunks(self, mock_transcribe, mock_openai, tmp_path):
        """Test that text from all chunks is merged with space separation."""
        chunk_paths = [
            (tmp_path / "chunk_0.mp3", 0),
            (tmp_path / "chunk_1.mp3", 300_000),
        ]

        mock_transcribe.side_effect = [
            {"text": "Hello from chunk one.", "segments": []},
            {"text": "Hello from chunk two.", "segments": []},
        ]

        result = _transcribe_chunked_sync(chunk_paths)

        assert result["text"] == "Hello from chunk one. Hello from chunk two."

    @patch("src.services.whisper_transcriber._transcribe_sync")
    def test_adjusts_segment_timestamps_by_offset(self, mock_transcribe, mock_openai, tmp_path):
        """Test that segment timestamps are adjusted by chunk offset."""
        chunk_paths = [
            (tmp_path / "chunk_0.mp3", 0),
            (tmp_path / "chunk_1.mp3", 300_000),  # 300s offset
        ]

        mock_transcribe.side_effect = [
            {
                "text": "First chunk.",
                "segments": [
                    {"text": "First", "start": 0.0, "end": 5.0},
                    {"text": "chunk.", "start": 5.0, "end": 10.0},
                ],
            },
            {
                "text": "Second chunk.",
                "segments": [
                    {"text": "Second", "start": 0.0, "end": 4.0},
                    {"text": "chunk.", "start": 4.0, "end": 8.0},
                ],
            },
        ]

        result = _transcribe_chunked_sync(chunk_paths)

        assert len(result["segments"]) == 4
        # First chunk segments: no offset
        assert result["segments"][0]["start"] == 0.0
        assert result["segments"][0]["end"] == 5.0
        assert result["segments"][1]["start"] == 5.0
        assert result["segments"][1]["end"] == 10.0
        # Second chunk segments: +300s offset
        assert result["segments"][2]["start"] == 300.0
        assert result["segments"][2]["end"] == 304.0
        assert result["segments"][3]["start"] == 304.0
        assert result["segments"][3]["end"] == 308.0

    @patch("src.services.whisper_transcriber._transcribe_sync")
    def test_handles_chunks_without_segments(self, mock_transcribe, mock_openai, tmp_path):
        """Test merging when some chunks have no segments."""
        chunk_paths = [
            (tmp_path / "chunk_0.mp3", 0),
            (tmp_path / "chunk_1.mp3", 300_000),
        ]

        mock_transcribe.side_effect = [
            {"text": "First chunk.", "segments": [{"text": "First", "start": 0.0, "end": 5.0}]},
            {"text": "Second chunk."},  # No segments key
        ]

        result = _transcribe_chunked_sync(chunk_paths)

        assert result["text"] == "First chunk. Second chunk."
        assert len(result["segments"]) == 1

    @patch("src.services.whisper_transcriber._transcribe_sync")
    def test_single_chunk_works(self, mock_transcribe, mock_openai, tmp_path):
        """Test that a single chunk returns correct result."""
        chunk_paths = [(tmp_path / "chunk_0.mp3", 0)]

        mock_transcribe.return_value = {
            "text": "Only chunk.",
            "segments": [{"text": "Only chunk.", "start": 0.0, "end": 3.0}],
        }

        result = _transcribe_chunked_sync(chunk_paths)

        assert result["text"] == "Only chunk."
        assert len(result["segments"]) == 1
        assert result["segments"][0]["start"] == 0.0

    @patch("src.services.whisper_transcriber._transcribe_sync")
    def test_passes_is_music_to_each_chunk(self, mock_transcribe, mock_openai, tmp_path):
        """Test that is_music flag is forwarded to _transcribe_sync for every chunk."""
        chunk_paths = [
            (tmp_path / "chunk_0.mp3", 0),
            (tmp_path / "chunk_1.mp3", 300_000),
        ]

        mock_transcribe.return_value = {"text": "Lyrics.", "segments": []}

        _transcribe_chunked_sync(chunk_paths, is_music=True)

        assert mock_transcribe.call_count == 2
        for call in mock_transcribe.call_args_list:
            assert call.kwargs.get("is_music") is True or call.args[1] is True


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
        """Test successful full transcription workflow (small file)."""
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

    @patch("src.services.whisper_transcriber._transcribe_chunked_sync")
    @patch("src.services.whisper_transcriber._split_audio_chunks")
    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_large_file_uses_chunked_path(
        self, mock_download, mock_split, mock_chunked, tmp_path
    ):
        """Test that files > CHUNK_TARGET_SIZE_MB use the chunked transcription path."""
        video_id = "longvideo"
        audio_path = tmp_path / f"{video_id}.mp3"
        # Write a file larger than CHUNK_TARGET_SIZE_MB
        audio_path.write_bytes(b"x" * (CHUNK_TARGET_SIZE_MB + 1) * 1024 * 1024)

        chunk_0 = tmp_path / f"{video_id}_chunk_0.mp3"
        chunk_1 = tmp_path / f"{video_id}_chunk_1.mp3"
        chunk_0.write_bytes(b"chunk0")
        chunk_1.write_bytes(b"chunk1")

        mock_download.return_value = audio_path
        mock_split.return_value = [(chunk_0, 0), (chunk_1, 300_000)]
        mock_chunked.return_value = {
            "text": "Long video transcript merged.",
            "segments": [
                {"text": "Long video", "start": 0.0, "end": 5.0},
                {"text": "transcript merged.", "start": 300.0, "end": 305.0},
            ],
        }

        result = await transcribe_with_whisper(video_id)

        assert result.text == "Long video transcript merged."
        assert result.source == "whisper"
        assert len(result.segments) == 2
        mock_split.assert_called_once()
        mock_chunked.assert_called_once()

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

    @patch("src.services.whisper_transcriber._transcribe_chunked_sync")
    @patch("src.services.whisper_transcriber._split_audio_chunks")
    @patch("src.services.whisper_transcriber._download_audio_sync")
    async def test_cleanup_includes_chunk_files(
        self, mock_download, mock_split, mock_chunked, tmp_path
    ):
        """Test that chunk files are cleaned up after chunked transcription."""
        video_id = "longvideo"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"x" * (CHUNK_TARGET_SIZE_MB + 1) * 1024 * 1024)

        chunk_0 = tmp_path / f"{video_id}_chunk_0.mp3"
        chunk_1 = tmp_path / f"{video_id}_chunk_1.mp3"
        chunk_0.write_bytes(b"chunk0")
        chunk_1.write_bytes(b"chunk1")

        mock_download.return_value = audio_path
        mock_split.return_value = [(chunk_0, 0), (chunk_1, 300_000)]
        mock_chunked.return_value = {"text": "Merged.", "segments": []}

        await transcribe_with_whisper(video_id)

        assert not audio_path.exists()
        assert not chunk_0.exists()
        assert not chunk_1.exists()

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


class TestClassifyDownloadError:
    """Tests for _classify_download_error function."""

    def test_private_video_classified_as_unavailable(self):
        """Test that private video errors map to VIDEO_UNAVAILABLE."""
        assert classify_download_error("Private video") == ErrorCode.VIDEO_UNAVAILABLE

    def test_removed_video_classified_as_unavailable(self):
        """Test that removed video errors map to VIDEO_UNAVAILABLE."""
        assert classify_download_error("This video has been removed") == ErrorCode.VIDEO_UNAVAILABLE

    def test_sign_in_classified_as_unavailable(self):
        """Test that sign-in errors map to VIDEO_UNAVAILABLE."""
        assert classify_download_error("Sign in to confirm your age") == ErrorCode.VIDEO_UNAVAILABLE

    def test_unavailable_classified_as_unavailable(self):
        """Test that 'unavailable' errors map to VIDEO_UNAVAILABLE."""
        assert classify_download_error("Video unavailable") == ErrorCode.VIDEO_UNAVAILABLE

    def test_network_error_classified_as_download_error(self):
        """Test that generic network errors map to DOWNLOAD_ERROR."""
        assert classify_download_error("Network error") == ErrorCode.DOWNLOAD_ERROR

    def test_partial_read_classified_as_download_error(self):
        """Test that partial read errors map to DOWNLOAD_ERROR."""
        msg = "6784374 bytes read, 3239217 more expected"
        assert classify_download_error(msg) == ErrorCode.DOWNLOAD_ERROR

    def test_timeout_classified_as_download_error(self):
        """Test that timeout errors map to DOWNLOAD_ERROR."""
        assert classify_download_error("Connection timed out") == ErrorCode.DOWNLOAD_ERROR

    def test_unknown_error_classified_as_download_error(self):
        """Test that unknown errors default to DOWNLOAD_ERROR."""
        assert classify_download_error("Something went wrong") == ErrorCode.DOWNLOAD_ERROR


class TestDownloadRetryBehavior:
    """Tests for retry behavior in _download_audio_sync."""

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_retries_then_succeeds(self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path):
        """Test that download retries on failure and succeeds on later attempt."""
        video_id = "test_retry"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)

            mock_ydl = MagicMock()
            # Fail twice, succeed on third attempt
            mock_ydl.download.side_effect = [
                Exception("read error: partial read"),
                Exception("connection reset"),
                None,
            ]
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path
            assert mock_ydl.download.call_count == 3
            assert mock_sleep.call_count == 2
            # Verify exponential backoff: 2^1=2, 2^2=4
            mock_sleep.assert_any_call(2)
            mock_sleep.assert_any_call(4)

    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_exhausts_retries_then_raises(self, mock_ydl_class, mock_sleep):
        """Test that after exhausting all retries the error is raised."""
        video_id = "test_exhaust"

        mock_ydl = MagicMock()
        mock_ydl.download.side_effect = Exception("timeout reading data")
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(TranscriptError) as exc_info:
            _download_audio_sync(video_id)

        assert exc_info.value.code == ErrorCode.DOWNLOAD_ERROR
        assert mock_ydl.download.call_count == MAX_DOWNLOAD_ATTEMPTS
        # Backoff sleeps happen between attempts (not after last)
        assert mock_sleep.call_count == MAX_DOWNLOAD_ATTEMPTS - 1

    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_unavailable_error_after_retries(self, mock_ydl_class, mock_sleep):
        """Test that VIDEO_UNAVAILABLE is classified correctly after retries."""
        video_id = "test_unavailable"

        mock_ydl = MagicMock()
        mock_ydl.download.side_effect = Exception("Private video. Sign in if you've been granted access")
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(TranscriptError) as exc_info:
            _download_audio_sync(video_id)

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_no_sleep_on_first_attempt_success(self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path):
        """Test that no backoff sleep happens when first attempt succeeds."""
        video_id = "test_first"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            _download_audio_sync(video_id)

            mock_sleep.assert_not_called()

    @patch("src.services.whisper_transcriber.uuid.uuid4")
    @patch("src.services.download_utils.time.sleep")
    @patch("src.services.download_utils.yt_dlp.YoutubeDL")
    def test_ydl_opts_include_resilience_settings(self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path):
        """Test that yt-dlp is configured with retry and timeout options."""
        video_id = "test_opts"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            _download_audio_sync(video_id)

            opts = mock_ydl_class.call_args[0][0]
            assert opts["retries"] == 3
            assert opts["fragment_retries"] == 5
            assert opts["socket_timeout"] == 30
            assert opts["continuedl"] is False
            assert opts["format"] == "bestaudio"
            assert opts["noprogress"] is True
