"""Tests for SummarizeService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.models.schemas import ProcessingStatus, ErrorCode
from src.services.summarizer_service import SummarizeService
from src.exceptions import TranscriptError


class TestSummarizeService:
    """Tests for SummarizeService class."""

    @pytest.fixture
    def mock_llm_service(self):
        """Mock LLM service."""
        service = AsyncMock()
        service.process_video.return_value = {
            "tldr": "Test TLDR",
            "key_takeaways": ["Take 1", "Take 2"],
            "sections": [{"id": "1", "title": "Section 1", "content": [{"type": "paragraph", "text": "Summary"}]}],
            "concepts": [{"id": "1", "name": "Concept 1"}],
        }
        return service

    @pytest.fixture
    def service(self, mock_repository, mock_llm_service):
        """Create SummarizeService with mocked dependencies."""
        return SummarizeService(mock_repository, mock_llm_service)

    def test_init(self, mock_repository, mock_llm_service):
        """Test service initialization."""
        service = SummarizeService(mock_repository, mock_llm_service)
        assert service._repository is mock_repository
        assert service._llm is mock_llm_service

    def test_calculate_duration_empty_segments(self, service):
        """Test duration calculation with empty segments."""
        result = service._calculate_and_validate_duration([])
        assert result is None

    def test_calculate_duration_valid_segments(self, service, sample_segments):
        """Test duration calculation with valid segments."""
        result = service._calculate_and_validate_duration(sample_segments)
        assert result == 75  # 65.0 + 10.0 (last segment start + duration)

    def test_calculate_duration_too_long(self, service):
        """Test duration validation for too long video."""
        # MAX_VIDEO_DURATION_MINUTES is 240, so 241 minutes = 14460 seconds
        segments = [{"start": 0, "duration": 14500}]  # Over 240 mins
        with pytest.raises(TranscriptError) as exc_info:
            service._calculate_and_validate_duration(segments)
        assert exc_info.value.code == ErrorCode.VIDEO_TOO_LONG

    def test_calculate_duration_too_short(self, service):
        """Test duration validation for too short video."""
        segments = [{"start": 0, "duration": 5}]  # Under 30 seconds
        with pytest.raises(TranscriptError) as exc_info:
            service._calculate_and_validate_duration(segments)
        assert exc_info.value.code == ErrorCode.VIDEO_TOO_SHORT

    def test_build_result(self, service):
        """Test result building."""
        meta = {"title": "Test Video", "channel": "Test Channel", "thumbnail_url": "http://example.com/thumb.jpg"}
        summary = {"tldr": "Test", "key_takeaways": [], "sections": [], "concepts": []}

        result = service._build_result(
            meta=meta,
            youtube_id="test123",
            duration=120,
            raw_transcript="Test transcript",
            transcript_type="manual",
            summary=summary,
            processing_time=1000,
        )

        assert result["title"] == "Test Video"
        assert result["channel"] == "Test Channel"
        assert result["duration"] == 120
        assert result["transcript"] == "Test transcript"
        assert result["processing_time_ms"] == 1000

    @patch("src.services.summarizer_service.transcript")
    @patch("src.services.summarizer_service.metadata")
    @patch("src.services.summarizer_service.send_video_status")
    async def test_process_video_success(
        self,
        mock_send_status,
        mock_metadata,
        mock_transcript,
        service,
        sample_segments,
    ):
        """Test successful video processing."""
        # Setup mocks
        mock_metadata.get_video_metadata = AsyncMock(return_value={
            "title": "Test Video",
            "channel": "Test Channel",
            "thumbnail_url": "http://example.com/thumb.jpg",
        })
        mock_transcript.get_transcript = AsyncMock(return_value=(
            sample_segments,
            "Full transcript text",
            "manual",
        ))
        mock_transcript.clean_transcript.return_value = "Cleaned transcript"
        mock_send_status.return_value = None

        await service.process_video(
            video_summary_id="test-id",
            youtube_id="test123",
            _url="https://youtube.com/watch?v=test123",
        )

        # Verify repository was called
        service._repository.update_status.assert_called()
        service._repository.save_result.assert_called_once()

        # Verify LLM was called
        service._llm.process_video.assert_called_once()

    @patch("src.services.summarizer_service.transcript")
    @patch("src.services.summarizer_service.send_video_status")
    async def test_process_video_transcript_error(
        self,
        mock_send_status,
        mock_transcript,
        service,
    ):
        """Test video processing with transcript error."""
        mock_transcript.get_transcript = AsyncMock(
            side_effect=TranscriptError("No transcript", ErrorCode.NO_TRANSCRIPT)
        )
        mock_send_status.return_value = None

        await service.process_video(
            video_summary_id="test-id",
            youtube_id="test123",
            _url="https://youtube.com/watch?v=test123",
        )

        # Verify error was recorded
        service._repository.update_status.assert_called()
        # Last call should be with FAILED status
        last_call = service._repository.update_status.call_args_list[-1]
        assert last_call[0][1] == ProcessingStatus.FAILED
