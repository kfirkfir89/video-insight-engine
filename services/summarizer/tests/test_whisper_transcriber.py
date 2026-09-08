"""Tests for Whisper transcriber service."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from yt_dlp.utils import DownloadError

from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode
from src.services.media.download_utils import MAX_DOWNLOAD_ATTEMPTS, classify_download_error
from src.services.transcription.whisper_transcriber import (
    CHUNK_TARGET_SIZE_MB,
    _create_estimated_segments,
    _download_audio_sync,
    _merge_chunk_results,
    _split_audio_chunks,
    _transcribe_chunks_parallel,
    _transcribe_sync,
    transcribe_with_whisper,
)


class TestDownloadAudioSync:
    """Tests for _download_audio_sync function."""

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_success(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test successful audio download with unique filename."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)  # ~18KB

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path
            mock_ydl.download.assert_called_once()

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_format_selector_falls_back_to_best(self, mock_ydl_class, mock_uuid, tmp_path):
        """Selector must be bestaudio/best so muxed-only videos still download."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            _download_audio_sync(video_id)

            opts = mock_ydl_class.call_args[0][0]
            assert opts["format"] == "bestaudio/best"

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_progressive_only_video_downloads_via_best(self, mock_ydl_class, mock_uuid, tmp_path):
        """Regression: SABR-stripped android leaves only progressive format 18.

        A bare ``bestaudio`` selector raises "Requested format is not
        available"; the ``/best`` fallback matches the muxed stream. This mock
        yt-dlp errors for bestaudio-only and succeeds for the chained selector,
        pinning the 2026-09 BoxubcDHZ_Q failure mode.
        """

        video_id = "sabr123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"

            def fake_ydl(opts):
                ydl = MagicMock()
                if opts["format"] == "bestaudio":
                    ydl.download.side_effect = DownloadError(
                        "ERROR: [youtube] sabr123: Requested format is not available."
                    )
                else:
                    ydl.download.side_effect = lambda urls: mp3_path.write_bytes(
                        b"fake audio" * 1000
                    )
                ctx = MagicMock()
                ctx.__enter__.return_value = ydl
                ctx.__exit__.return_value = False
                return ctx

            mock_ydl_class.side_effect = fake_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path

    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
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

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_file_not_found(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test error when download completes but file not found."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            with pytest.raises(TranscriptError) as exc_info:
                _download_audio_sync(video_id)

            assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
            assert "file not found" in str(exc_info.value)

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_download_audio_large_file_not_rejected(self, mock_ydl_class, mock_uuid, tmp_path):
        """Test that large audio files are no longer rejected at download."""
        video_id = "test123"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            # 30MB file - would have been rejected before
            mp3_path.write_bytes(b"x" * 30 * 1024 * 1024)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            result = _download_audio_sync(video_id)

            assert result == mp3_path


class TestTranscribeSync:
    """Tests for _transcribe_sync function."""

    @patch("src.services.transcription.whisper_transcriber.settings")
    def test_transcribe_no_api_key(self, mock_settings, tmp_path):
        """Test error when OpenAI API key not configured."""
        mock_settings.OPENAI_API_KEY = None
        audio_path = tmp_path / "test.mp3"
        audio_path.write_bytes(b"fake audio")

        with pytest.raises(TranscriptError) as exc_info:
            _transcribe_sync(audio_path)

        assert exc_info.value.code == ErrorCode.UNKNOWN_ERROR
        assert "API key not configured" in str(exc_info.value)

    @patch("src.services.transcription.whisper_transcriber.OpenAI")
    @patch("src.services.transcription.whisper_transcriber.settings")
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

    @patch("src.services.transcription.whisper_transcriber.OpenAI")
    @patch("src.services.transcription.whisper_transcriber.settings")
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


class TestMakeOpenAIClient:
    """The OpenAI client must carry a bounded timeout + retry budget.

    Without this, the SDK default (600s × 2 retries) lets a stalled chunk
    upload hang far past the pipeline backstop — the original freeze.
    """

    @patch("src.services.transcription.whisper_transcriber.OpenAI")
    @patch("src.services.transcription.whisper_transcriber.settings")
    def test_client_bounded_with_timeout_and_retries(self, mock_settings, mock_openai):
        from src.services.transcription.whisper_transcriber import _make_openai_client

        mock_settings.OPENAI_API_KEY = "test-key"
        mock_settings.WHISPER_CLIENT_TIMEOUT_SECONDS = 300.0
        mock_settings.WHISPER_MAX_RETRIES = 1

        _make_openai_client()

        mock_openai.assert_called_once_with(api_key="test-key", timeout=300.0, max_retries=1)


class TestSplitAudioChunks:
    """Tests for _split_audio_chunks function."""

    @patch("src.services.transcription.whisper_transcriber.AudioSegment")
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

    @patch("src.services.transcription.whisper_transcriber.AudioSegment")
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

    @patch("src.services.transcription.whisper_transcriber.AudioSegment")
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

    @patch("src.services.transcription.whisper_transcriber.AudioSegment")
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

    @patch("src.services.transcription.whisper_transcriber.AudioSegment")
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


class TestMergeChunkResults:
    """Tests for _merge_chunk_results — pure merge of per-chunk transcription dicts."""

    def test_merges_text_from_all_chunks(self):
        """Text from all chunks is merged with space separation, in offset order."""
        result = _merge_chunk_results(
            [
                (0, {"text": "Hello from chunk one.", "segments": []}),
                (300_000, {"text": "Hello from chunk two.", "segments": []}),
            ]
        )

        assert result["text"] == "Hello from chunk one. Hello from chunk two."

    def test_adjusts_segment_timestamps_by_offset(self):
        """Segment timestamps are shifted by each chunk's offset."""
        result = _merge_chunk_results(
            [
                (
                    0,
                    {
                        "text": "First chunk.",
                        "segments": [
                            {"text": "First", "start": 0.0, "end": 5.0},
                            {"text": "chunk.", "start": 5.0, "end": 10.0},
                        ],
                    },
                ),
                (
                    300_000,
                    {  # 300s offset
                        "text": "Second chunk.",
                        "segments": [
                            {"text": "Second", "start": 0.0, "end": 4.0},
                            {"text": "chunk.", "start": 4.0, "end": 8.0},
                        ],
                    },
                ),
            ]
        )

        assert len(result["segments"]) == 4
        # First chunk segments: no offset
        assert result["segments"][0]["start"] == 0.0
        assert result["segments"][1]["end"] == 10.0
        # Second chunk segments: +300s offset
        assert result["segments"][2]["start"] == 300.0
        assert result["segments"][2]["end"] == 304.0
        assert result["segments"][3]["end"] == 308.0

    def test_handles_chunks_without_segments(self):
        """Merging tolerates a chunk dict missing the segments key."""
        result = _merge_chunk_results(
            [
                (
                    0,
                    {
                        "text": "First chunk.",
                        "segments": [{"text": "First", "start": 0.0, "end": 5.0}],
                    },
                ),
                (300_000, {"text": "Second chunk."}),  # No segments key
            ]
        )

        assert result["text"] == "First chunk. Second chunk."
        assert len(result["segments"]) == 1

    def test_single_chunk(self):
        """A single chunk merges to the expected result."""
        result = _merge_chunk_results(
            [
                (
                    0,
                    {
                        "text": "Only chunk.",
                        "segments": [{"text": "Only chunk.", "start": 0.0, "end": 3.0}],
                    },
                ),
            ]
        )

        assert result["text"] == "Only chunk."
        assert result["segments"][0]["start"] == 0.0

    def test_sums_durations(self):
        """Per-chunk billed durations sum into the combined total."""
        result = _merge_chunk_results(
            [
                (0, {"text": "a", "segments": [], "language": "en", "duration": 100.0}),
                (100_000, {"text": "b", "segments": [], "language": "en", "duration": 50.0}),
            ]
        )

        assert result["duration"] == 150.0

    def test_combines_language_by_majority(self):
        """A language detected by every chunk survives the merge (normalized)."""
        result = _merge_chunk_results(
            [
                (0, {"text": "a", "segments": [], "language": "hebrew"}),
                (100_000, {"text": "b", "segments": [], "language": "hebrew"}),
            ]
        )

        assert result["language"] == "he"


@patch("src.services.transcription.whisper_transcriber.OpenAI")
class TestTranscribeChunksParallel:
    """Tests for _transcribe_chunks_parallel — concurrent, order-preserving transcription.

    ``_transcribe_sync`` is mocked with a path-keyed callable rather than an
    ordered ``side_effect`` list because chunks now run concurrently, so the
    *call* order is non-deterministic even though the merged output stays in
    chunk order.
    """

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_transcribes_all_chunks(self, mock_transcribe, mock_openai, tmp_path):
        """Every chunk is transcribed and its text appears in the merged result."""
        chunks = [(tmp_path / "chunk_0.mp3", 0), (tmp_path / "chunk_1.mp3", 300_000)]
        by_name = {
            "chunk_0.mp3": {"text": "Hello from chunk one.", "segments": []},
            "chunk_1.mp3": {"text": "Hello from chunk two.", "segments": []},
        }
        mock_transcribe.side_effect = lambda path, *a, **k: by_name[path.name]

        result = await _transcribe_chunks_parallel(chunks)

        assert "Hello from chunk one." in result["text"]
        assert "Hello from chunk two." in result["text"]
        assert mock_transcribe.call_count == 2

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_preserves_chunk_order(self, mock_transcribe, mock_openai, tmp_path):
        """Merged text follows chunk/offset order regardless of completion order."""
        chunks = [(tmp_path / "chunk_0.mp3", 0), (tmp_path / "chunk_1.mp3", 300_000)]
        by_name = {
            "chunk_0.mp3": {"text": "one", "segments": []},
            "chunk_1.mp3": {"text": "two", "segments": []},
        }
        mock_transcribe.side_effect = lambda path, *a, **k: by_name[path.name]

        result = await _transcribe_chunks_parallel(chunks)

        assert result["text"] == "one two"

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_passes_is_music_to_each_chunk(self, mock_transcribe, mock_openai, tmp_path):
        """is_music is forwarded to _transcribe_sync for every chunk."""
        chunks = [(tmp_path / "chunk_0.mp3", 0), (tmp_path / "chunk_1.mp3", 300_000)]
        mock_transcribe.side_effect = lambda path, *a, **k: {"text": "Lyrics.", "segments": []}

        await _transcribe_chunks_parallel(chunks, is_music=True)

        assert mock_transcribe.call_count == 2
        for call in mock_transcribe.call_args_list:
            # _transcribe_sync(chunk_path, is_music, client) — positional
            assert call.args[1] is True

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_deadline_skips_later_chunks(self, mock_transcribe, mock_openai, tmp_path):
        """A passed deadline transcribes only chunk 0, keeping partial work.

        Regression: a long video used to be hard-cancelled on timeout (orphaning
        the worker thread, which then read just-deleted chunk files), discarding
        all transcription. The first chunk always runs; later chunks are skipped
        once the deadline passes — better than the truncating Gemini fallback.
        """
        chunks = [
            (tmp_path / "chunk_0.mp3", 0),
            (tmp_path / "chunk_1.mp3", 300_000),
            (tmp_path / "chunk_2.mp3", 600_000),
        ]
        mock_transcribe.side_effect = lambda path, *a, **k: {"text": "Chunk one.", "segments": []}

        result = await _transcribe_chunks_parallel(chunks, deadline=time.monotonic() - 1.0)

        assert result["text"] == "Chunk one."
        assert mock_transcribe.call_count == 1

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_future_deadline_transcribes_all_chunks(
        self, mock_transcribe, mock_openai, tmp_path
    ):
        """A deadline comfortably in the future does not curtail transcription."""
        chunks = [(tmp_path / "chunk_0.mp3", 0), (tmp_path / "chunk_1.mp3", 300_000)]
        by_name = {
            "chunk_0.mp3": {"text": "one", "segments": []},
            "chunk_1.mp3": {"text": "two", "segments": []},
        }
        mock_transcribe.side_effect = lambda path, *a, **k: by_name[path.name]

        result = await _transcribe_chunks_parallel(chunks, deadline=time.monotonic() + 3600.0)

        assert result["text"] == "one two"
        assert mock_transcribe.call_count == 2

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_failed_chunk_is_dropped(self, mock_transcribe, mock_openai, tmp_path):
        """One failing chunk is dropped; surviving chunks still produce a transcript."""
        chunks = [(tmp_path / "chunk_0.mp3", 0), (tmp_path / "chunk_1.mp3", 300_000)]

        def fake(path, *a, **k):
            if path.name == "chunk_1.mp3":
                raise TranscriptError("boom", ErrorCode.UNKNOWN_ERROR)
            return {"text": "survived", "segments": []}

        mock_transcribe.side_effect = fake

        result = await _transcribe_chunks_parallel(chunks)

        assert result["text"] == "survived"

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    async def test_all_chunks_failed_raises(self, mock_transcribe, mock_openai, tmp_path):
        """If every chunk fails, a TranscriptError surfaces (no empty transcript)."""
        chunks = [(tmp_path / "chunk_0.mp3", 0)]
        mock_transcribe.side_effect = TranscriptError("boom", ErrorCode.UNKNOWN_ERROR)

        with pytest.raises(TranscriptError):
            await _transcribe_chunks_parallel(chunks)


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

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
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

    @patch(
        "src.services.transcription.whisper_transcriber._transcribe_chunks_parallel",
        new_callable=AsyncMock,
    )
    @patch("src.services.transcription.whisper_transcriber._split_audio_chunks")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
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

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_workflow_uses_estimated_segments(self, mock_download, mock_transcribe, tmp_path):
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

    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
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

    @patch(
        "src.services.transcription.whisper_transcriber._transcribe_chunks_parallel",
        new_callable=AsyncMock,
    )
    @patch("src.services.transcription.whisper_transcriber._split_audio_chunks")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
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

    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_cleanup_on_error(self, mock_download, tmp_path):
        """Test that audio file is cleaned up even on error."""
        video_id = "test123"
        audio_path = tmp_path / f"{video_id}.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_download.return_value = audio_path

        with patch(
            "src.services.transcription.whisper_transcriber._transcribe_sync",
            side_effect=TranscriptError("Error", ErrorCode.UNKNOWN_ERROR),
        ):
            with pytest.raises(TranscriptError):
                await transcribe_with_whisper(video_id)

        # File should still be deleted
        assert not audio_path.exists()

    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_download_error_propagates(self, mock_download):
        """Test that download errors propagate correctly."""
        mock_download.side_effect = TranscriptError("Download failed", ErrorCode.VIDEO_UNAVAILABLE)

        with pytest.raises(TranscriptError) as exc_info:
            await transcribe_with_whisper("test123")

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE


class TestWhisperUsageEmission:
    """Phase 0.5 — Whisper transcription emits a cost row to the usage ledger.

    Whisper bypasses LiteLLM, so the transcriber itself must emit the cost.
    """

    @patch("src.services.transcription.whisper_transcriber.OpenAI")
    @patch("src.services.transcription.whisper_transcriber.settings")
    def test_transcribe_sync_captures_duration(self, mock_settings, mock_openai_class, tmp_path):
        """verbose_json duration is surfaced for cost computation."""
        mock_settings.OPENAI_API_KEY = "test-key"
        audio_path = tmp_path / "test.mp3"
        audio_path.write_bytes(b"fake audio")

        mock_response = MagicMock()
        mock_response.text = "hi"
        mock_response.segments = []
        mock_response.duration = 305.5

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        result = _transcribe_sync(audio_path)
        assert result["duration"] == 305.5

    def test_chunked_sums_durations(self):
        """Chunked transcription sums per-chunk durations for the billed total."""
        result = _merge_chunk_results(
            [
                (0, {"text": "a", "segments": [], "language": "en", "duration": 100.0}),
                (100_000, {"text": "b", "segments": [], "language": "en", "duration": 50.0}),
            ]
        )

        assert result["duration"] == 150.0

    @patch("src.services.transcription.whisper_transcriber.emit_transcription_usage")
    @patch("src.services.transcription.whisper_transcriber._transcribe_sync")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_emits_cost_row_on_success(
        self, mock_download, mock_transcribe, mock_emit, tmp_path
    ):
        audio_path = tmp_path / "v.mp3"
        audio_path.write_bytes(b"fake audio")
        mock_download.return_value = audio_path
        mock_transcribe.return_value = {
            "text": "hi",
            "segments": [],
            "duration": 600.0,
        }

        await transcribe_with_whisper("v")

        mock_emit.assert_called_once()
        kwargs = mock_emit.call_args.kwargs
        assert kwargs["model"] == "whisper-1"
        assert kwargs["feature"] == "summarize:transcript:whisper"
        assert kwargs["audio_seconds"] == 600.0
        assert kwargs["success"] is True

    @patch("src.services.transcription.whisper_transcriber.emit_transcription_usage")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_emits_failure_row_when_transcription_fails(self, mock_download, mock_emit):
        mock_download.side_effect = TranscriptError("boom", ErrorCode.DOWNLOAD_ERROR)

        with pytest.raises(TranscriptError):
            await transcribe_with_whisper("v")

        mock_emit.assert_called_once()
        assert mock_emit.call_args.kwargs["success"] is False
        assert mock_emit.call_args.kwargs["feature"] == "summarize:transcript:whisper"

    @patch("src.services.transcription.whisper_transcriber.emit_transcription_usage")
    @patch("src.services.transcription.whisper_transcriber._translate_sync")
    @patch("src.services.transcription.whisper_transcriber._download_audio_sync")
    async def test_translate_emits_whisper_translate_feature(
        self, mock_download, mock_translate, mock_emit, tmp_path
    ):
        audio_path = tmp_path / "v.mp3"
        audio_path.write_bytes(b"fake audio")
        mock_download.return_value = audio_path
        mock_translate.return_value = {
            "text": "english text",
            "segments": [],
            "duration": 240.0,
        }

        from src.services.transcription.whisper_transcriber import translate_audio_to_english

        result = await translate_audio_to_english("v")

        assert result == "english text"
        mock_emit.assert_called_once()
        kwargs = mock_emit.call_args.kwargs
        assert kwargs["feature"] == "summarize:transcript:whisper_translate"
        assert kwargs["audio_seconds"] == 240.0


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

    def test_requested_format_not_available_is_download_error(self):
        """Regression: format-selector failures must NOT read as video-gone.

        "Requested format is not available" contains "not available" and used
        to be misclassified VIDEO_UNAVAILABLE, which suppresses audio fallback
        upstream (_NO_AUDIO_FALLBACK).
        """
        msg = "ERROR: [youtube] X: Requested format is not available. Use --list-formats"
        assert classify_download_error(msg) == ErrorCode.DOWNLOAD_ERROR


class TestDownloadRetryBehavior:
    """Tests for retry behavior in _download_audio_sync."""

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_retries_then_succeeds(self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path):
        """Test that download retries on failure and succeeds on later attempt."""
        video_id = "test_retry"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
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

    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
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

    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_unavailable_error_after_retries(self, mock_ydl_class, mock_sleep):
        """Test that VIDEO_UNAVAILABLE is classified correctly after retries."""
        video_id = "test_unavailable"

        mock_ydl = MagicMock()
        mock_ydl.download.side_effect = Exception(
            "Private video. Sign in if you've been granted access"
        )
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl

        with pytest.raises(TranscriptError) as exc_info:
            _download_audio_sync(video_id)

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_no_sleep_on_first_attempt_success(
        self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path
    ):
        """Test that no backoff sleep happens when first attempt succeeds."""
        video_id = "test_first"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
            mp3_path = tmp_path / f"{video_id}_aabbccdd.mp3"
            mp3_path.write_bytes(b"fake audio content" * 1000)

            mock_ydl = MagicMock()
            mock_ydl_class.return_value.__enter__.return_value = mock_ydl

            _download_audio_sync(video_id)

            mock_sleep.assert_not_called()

    @patch("src.services.transcription.whisper_transcriber.uuid.uuid4")
    @patch("src.services.media.download_utils.time.sleep")
    @patch("src.services.media.download_utils.yt_dlp.YoutubeDL")
    def test_ydl_opts_include_resilience_settings(
        self, mock_ydl_class, mock_sleep, mock_uuid, tmp_path
    ):
        """Test that yt-dlp is configured with retry and timeout options."""
        video_id = "test_opts"
        mock_uuid.return_value = MagicMock(hex="aabbccdd11223344")

        with patch("src.services.transcription.whisper_transcriber.TEMP_DIR", tmp_path):
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
            assert opts["format"] == "bestaudio/best"
            assert opts["noprogress"] is True
