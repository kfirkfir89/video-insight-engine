"""Tests for SSE streaming routes (stream.py).

Tests streaming endpoint, SSE event format, error handling, and cancellation.
Uses httpx TestClient for async route testing.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from bson import ObjectId

from httpx import AsyncClient, ASGITransport

from src.main import app
from src.models.schemas import ProcessingStatus, ErrorCode
from src.exceptions import TranscriptError


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def valid_object_id():
    """Generate a valid MongoDB ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_video_entry(valid_object_id):
    """Sample video summary entry from database."""
    return {
        "_id": valid_object_id,
        "youtubeId": "dQw4w9WgXcQ",
        "status": ProcessingStatus.PENDING.value,
    }


@pytest.fixture
def completed_video_entry(valid_object_id):
    """Sample completed video summary entry."""
    return {
        "_id": valid_object_id,
        "youtubeId": "dQw4w9WgXcQ",
        "status": ProcessingStatus.COMPLETED.value,
        "title": "Test Video",
        "channel": "Test Channel",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "duration": 300,
        "context": {"persona": "standard"},
        "chapters": [
            {"startSeconds": 0, "endSeconds": 60, "title": "Intro"},
        ],
        "summary": {
            "tldr": "Test TLDR",
            "key_takeaways": ["Point 1", "Point 2"],
            "sections": [
                {"id": "1", "title": "Intro", "timestamp": "0:00"},
            ],
            "concepts": [
                {"id": "1", "name": "Test Concept"},
            ],
            "master_summary": "Master summary text",
        },
    }


@pytest.fixture
def mock_repository():
    """Mock video repository."""
    repo = MagicMock()
    repo.get_video_summary = MagicMock(return_value=None)
    repo.update_status = MagicMock()
    repo.save_result = MagicMock()
    return repo


@pytest.fixture
def mock_llm_service():
    """Mock LLM service."""
    service = AsyncMock()
    service.fast_model = "anthropic/claude-3-5-haiku-20241022"
    service.generate_metadata_tldr = AsyncMock(return_value={
        "tldr": "Test TLDR",
        "keyTakeaways": ["Point 1"],
    })
    service.summarize_section = AsyncMock(return_value={
        "content": [
            {"type": "paragraph", "text": "Section summary"},
            {"type": "bullets", "items": ["Bullet 1"]},
        ],
    })

    async def mock_stream_detect(*args, **kwargs):
        yield ("complete", [{"title": "Section 1", "startSeconds": 0, "endSeconds": 60}])

    service.stream_detect_sections = mock_stream_detect

    async def mock_stream_concepts(*args, **kwargs):
        yield ("complete", [{"name": "Concept 1", "definition": "Test def"}])

    service.stream_extract_concepts = mock_stream_concepts
    service.generate_master_summary = AsyncMock(return_value="Master summary")

    return service


@pytest.fixture
async def client(mock_repository, mock_llm_service):
    """Async test client with mocked dependencies."""
    from src.dependencies import get_video_repository, get_llm_service

    app.dependency_overrides[get_video_repository] = lambda: mock_repository
    app.dependency_overrides[get_llm_service] = lambda: mock_llm_service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────


def parse_sse_events(content: str) -> list[dict]:
    """Parse SSE events from response content."""
    events = []
    for line in content.split("\n"):
        if line.startswith("data: "):
            data = line[6:]  # Remove "data: " prefix
            if data == "[DONE]":
                events.append({"event": "done_signal"})
            else:
                try:
                    events.append(json.loads(data))
                except json.JSONDecodeError:
                    pass
    return events


# ─────────────────────────────────────────────────────────────────────────────
# Route Validation Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestStreamRouteValidation:
    """Tests for stream route input validation."""

    async def test_rejects_invalid_object_id(self, client):
        """Test rejection of invalid ObjectId format."""
        response = await client.get("/summarize/stream/invalid-id")

        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"]

    async def test_returns_404_for_missing_entry(self, client, mock_repository, valid_object_id):
        """Test 404 for non-existent video summary."""
        mock_repository.get_video_summary.return_value = None

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestStreamCachedResult:
    """Tests for streaming cached results."""

    async def test_streams_cached_result(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test streaming a cached (completed) result."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

        events = parse_sse_events(response.text)

        # Check event sequence
        event_types = [e.get("event") for e in events]
        assert "cached" in event_types
        assert "metadata" in event_types
        assert "synthesis_complete" in event_types
        assert "done" in event_types

    async def test_cached_result_includes_metadata(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result includes all metadata."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        metadata_event = next((e for e in events if e.get("event") == "metadata"), None)
        assert metadata_event is not None
        assert metadata_event["title"] == "Test Video"
        assert metadata_event["channel"] == "Test Channel"
        assert metadata_event["duration"] == 300

    async def test_cached_result_includes_synthesis(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result includes TLDR and takeaways."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        synthesis_event = next((e for e in events if e.get("event") == "synthesis_complete"), None)
        assert synthesis_event is not None
        assert synthesis_event["tldr"] == "Test TLDR"
        assert "Point 1" in synthesis_event["keyTakeaways"]

    async def test_cached_result_includes_sections(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result streams section events."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        section_events = [e for e in events if e.get("event") == "section_ready"]
        assert len(section_events) >= 1
        assert section_events[0]["section"]["title"] == "Intro"

    async def test_cached_result_includes_concepts(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result includes concepts."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        concepts_event = next((e for e in events if e.get("event") == "concepts_complete"), None)
        assert concepts_event is not None
        assert len(concepts_event["concepts"]) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# SSE Event Format Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestSSEEventFormat:
    """Tests for SSE event formatting."""

    def test_sse_event_format(self):
        """Test sse_event helper function format."""
        from src.routes.stream import sse_event

        result = sse_event("test", {"key": "value"})

        assert result.startswith("data: ")
        assert result.endswith("\n\n")

        data = json.loads(result[6:-2])  # Remove "data: " and "\n\n"
        assert data["event"] == "test"
        assert data["key"] == "value"

    def test_sse_token_format(self):
        """Test sse_token helper function format."""
        from src.routes.stream import sse_token

        result = sse_token("section_detect", "test token", index=0)

        data = json.loads(result[6:-2])
        assert data["event"] == "token"
        assert data["phase"] == "section_detect"
        assert data["token"] == "test token"
        assert data["index"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# Error Handling Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestStreamErrorHandling:
    """Tests for stream error handling."""

    @patch("src.routes.stream.extract_video_data")
    async def test_handles_transcript_error(
        self,
        mock_extract,
        client,
        mock_repository,
        sample_video_entry,
        valid_object_id,
    ):
        """Test handling TranscriptError during processing."""
        mock_repository.get_video_summary.return_value = sample_video_entry
        mock_extract.side_effect = TranscriptError("No transcript available", ErrorCode.NO_TRANSCRIPT)

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        error_event = next((e for e in events if e.get("event") == "error"), None)
        assert error_event is not None
        assert error_event["code"] == ErrorCode.NO_TRANSCRIPT.value

    @patch("src.routes.stream.extract_video_data")
    async def test_handles_video_too_long_error(
        self,
        mock_extract,
        client,
        mock_repository,
        sample_video_entry,
        valid_object_id,
    ):
        """Test handling video too long error."""
        mock_repository.get_video_summary.return_value = sample_video_entry
        mock_extract.side_effect = TranscriptError("Video too long", ErrorCode.VIDEO_TOO_LONG)

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        error_event = next((e for e in events if e.get("event") == "error"), None)
        assert error_event is not None
        assert error_event["code"] == ErrorCode.VIDEO_TOO_LONG.value

    @patch("src.routes.stream.extract_video_data")
    async def test_handles_video_unavailable_error(
        self,
        mock_extract,
        client,
        mock_repository,
        sample_video_entry,
        valid_object_id,
    ):
        """Test handling video unavailable error."""
        mock_repository.get_video_summary.return_value = sample_video_entry
        mock_extract.side_effect = TranscriptError("Video unavailable", ErrorCode.VIDEO_UNAVAILABLE)

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        error_event = next((e for e in events if e.get("event") == "error"), None)
        assert error_event is not None
        assert error_event["code"] == ErrorCode.VIDEO_UNAVAILABLE.value

    @patch("src.routes.stream.extract_video_data")
    async def test_updates_status_on_error(
        self,
        mock_extract,
        client,
        mock_repository,
        sample_video_entry,
        valid_object_id,
    ):
        """Test that status is updated to FAILED on error."""
        mock_repository.get_video_summary.return_value = sample_video_entry
        mock_extract.side_effect = TranscriptError("No transcript", ErrorCode.NO_TRANSCRIPT)

        await client.get(f"/summarize/stream/{valid_object_id}")

        # Verify status was updated to FAILED
        mock_repository.update_status.assert_called()
        # Find the FAILED status call
        failed_calls = [
            call for call in mock_repository.update_status.call_args_list
            if call[0][1] == ProcessingStatus.FAILED
        ]
        assert len(failed_calls) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# Helper Function Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestHelperFunctions:
    """Tests for stream route helper functions."""

    def test_validate_duration_too_long(self):
        """Test duration validation for too long video."""
        from src.routes.stream import validate_duration

        with pytest.raises(TranscriptError) as exc_info:
            validate_duration(60 * 60 * 5)  # 5 hours

        assert exc_info.value.code == ErrorCode.VIDEO_TOO_LONG

    def test_validate_duration_too_short(self):
        """Test duration validation for too short video."""
        from src.routes.stream import validate_duration

        with pytest.raises(TranscriptError) as exc_info:
            validate_duration(30)  # 30 seconds

        assert exc_info.value.code == ErrorCode.VIDEO_TOO_SHORT

    def test_validate_duration_valid(self):
        """Test duration validation for valid duration."""
        from src.routes.stream import validate_duration

        # Should not raise
        validate_duration(300)  # 5 minutes

    def test_build_chapter_dict(self):
        """Test building chapter dictionary."""
        from src.services.chapter_pipeline import build_chapter_dict

        raw = {"title": "Test Section", "startSeconds": 60, "endSeconds": 120}
        summary = {
            "content": [
                {"type": "paragraph", "text": "Summary"},
                {"type": "bullets", "items": ["Point 1"]},
            ],
        }

        result = build_chapter_dict(raw, summary, is_creator_chapter=True)

        assert result["title"] == "Test Section"
        assert result["start_seconds"] == 60
        assert result["end_seconds"] == 120
        assert result["is_creator_chapter"] is True
        assert "id" in result
        assert result["timestamp"] == "01:00"  # MM:SS format with zero-padded minutes
        assert result["content"] == summary["content"]

    def test_build_chapter_dict_generated(self):
        """Test building chapter dictionary for AI-generated chapters."""
        from src.services.chapter_pipeline import build_chapter_dict

        raw = {"title": "AI Section", "startSeconds": 0, "endSeconds": 60}
        summary = {"content": []}

        result = build_chapter_dict(raw, summary, is_creator_chapter=False)

        assert result["is_creator_chapter"] is False
        assert "original_title" not in result

    def test_normalize_segments_from_api(self):
        """Test normalizing segments from API format."""
        from src.routes.stream import normalize_segments

        segments = [
            {"text": "Hello", "start": 1.5, "duration": 2.0},
        ]

        result = normalize_segments(segments)

        assert len(result) == 1
        assert result[0]["startMs"] == 1500
        assert result[0]["endMs"] == 3500

    def test_normalize_segments_from_whisper(self):
        """Test normalizing segments from Whisper format."""
        from src.routes.stream import normalize_segments

        segments = [
            {"text": "Hello", "startMs": 1500, "endMs": 3500},
        ]

        result = normalize_segments(segments)

        assert result[0]["startMs"] == 1500
        assert result[0]["endMs"] == 3500

    def test_extract_context_with_video_data(self):
        """Test extracting context from video data."""
        from src.routes.stream import extract_context
        from src.services.youtube import VideoData, VideoContext

        video_data = VideoData(
            video_id="test",
            title="Test",
            channel="Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            context=VideoContext(
                youtube_category="Science & Technology",
                category="coding",
                persona="code",
                tags=["python"],
                display_tags=["Python"],
            ),
        )

        context_dict, persona = extract_context(video_data)

        assert persona == "code"
        assert context_dict["youtubeCategory"] == "Science & Technology"
        assert context_dict["category"] == "coding"

    def test_extract_context_without_context(self):
        """Test extracting context when video has no context."""
        from src.routes.stream import extract_context
        from src.services.youtube import VideoData

        video_data = VideoData(
            video_id="test",
            title="Test",
            channel="Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            context=None,
        )

        context_dict, persona = extract_context(video_data)

        assert persona == "standard"
        assert context_dict is None


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestPipelineContext:
    """Tests for PipelineContext dataclass."""

    def test_pipeline_context_creation(self):
        """Test creating PipelineContext."""
        from src.routes.stream import PipelineContext, TranscriptData
        from src.services.youtube import VideoData

        video_data = VideoData(
            video_id="test",
            title="Test",
            channel="Channel",
            duration=300,
            thumbnail_url=None,
            description="",
        )
        transcript = TranscriptData(
            segments=[],
            raw_text="Test transcript",
            transcript_type="manual",
            source="api",
        )

        from src.routes.stream import PipelineTimer

        ctx = PipelineContext(
            video_summary_id="abc123",
            youtube_id="test",
            video_data=video_data,
            transcript=transcript,
            persona="standard",
            sponsor_segments=[],
            timer=PipelineTimer(),
        )

        assert ctx.video_summary_id == "abc123"
        assert ctx.youtube_id == "test"
        assert ctx.persona == "standard"


class TestTranscriptData:
    """Tests for TranscriptData dataclass."""

    def test_transcript_data_creation(self):
        """Test creating TranscriptData."""
        from src.routes.stream import TranscriptData

        data = TranscriptData(
            segments=[{"text": "Hello", "start": 0, "duration": 1}],
            raw_text="Hello",
            transcript_type="manual",
            source="ytdlp",
        )

        assert len(data.segments) == 1
        assert data.raw_text == "Hello"
        assert data.source == "ytdlp"


class TestParallelResults:
    """Tests for ParallelResults dataclass."""

    def test_parallel_results_defaults(self):
        """Test ParallelResults default values."""
        from src.routes.stream import ParallelResults

        results = ParallelResults()

        assert results.description_analysis is None
        assert results.synthesis == {"tldr": "", "keyTakeaways": []}
        assert results.first_section is None
        assert results.failed_tasks == []


# ─────────────────────────────────────────────────────────────────────────────
# Integration Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestStreamIntegration:
    """Integration tests for streaming endpoint."""

    async def test_health_endpoint(self, client):
        """Test health check endpoint."""
        # Override db check to avoid actual connection
        with patch("src.main.get_mongo_client") as mock_client:
            mock_mongo = MagicMock()
            mock_mongo.admin.command.return_value = True
            mock_client.return_value = mock_mongo

            response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "vie-summarizer"
        assert "model" in data

    async def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = await client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "vie-summarizer"
        assert "version" in data

    async def test_stream_response_headers(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that stream response has correct headers."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        assert response.headers.get("cache-control") == "no-cache"

    async def test_done_signal_sent_at_end(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that [DONE] signal is sent at end of stream."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert "data: [DONE]" in response.text


# ─────────────────────────────────────────────────────────────────────────────
# finalize_video_context Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestFinalizeVideoContext:
    """Tests for finalize_video_context() function."""

    @pytest.fixture
    def mock_llm_provider(self):
        """Mock LLM provider for fast classification."""
        provider = AsyncMock()
        provider.complete_fast = AsyncMock(return_value="cooking")
        return provider

    @pytest.fixture
    def video_data_high_confidence(self):
        """VideoData with high category confidence (no LLM fallback needed)."""
        from src.services.youtube import VideoData, VideoContext
        return VideoData(
            video_id="test123",
            title="Easy Pasta Recipe",
            channel="Jamie Oliver",
            duration=300,
            thumbnail_url="https://example.com/thumb.jpg",
            description="Learn to make pasta",
            chapters=[],
            subtitles=[],
            context=VideoContext(
                youtube_category="Entertainment",
                category="cooking",
                persona="recipe",
                tags=["recipe", "cooking"],
                display_tags=["Recipe", "Cooking"],
                category_confidence=0.54,  # Above 0.4 threshold
            ),
        )

    @pytest.fixture
    def video_data_low_confidence(self):
        """VideoData with low category confidence (needs LLM fallback)."""
        from src.services.youtube import VideoData, VideoContext
        return VideoData(
            video_id="test456",
            title="Funny Video",
            channel="Random Channel",
            duration=300,
            thumbnail_url="https://example.com/thumb.jpg",
            description="Entertainment video",
            chapters=[],
            subtitles=[],
            context=VideoContext(
                youtube_category="Entertainment",
                category="standard",
                persona="standard",
                tags=["funny"],
                display_tags=["Funny"],
                category_confidence=0.15,  # Below 0.4 threshold
            ),
        )

    @patch("src.services.pipeline_helpers.get_llm_fallback_threshold")
    async def test_high_confidence_skips_llm(self, mock_threshold, mock_llm_provider, video_data_high_confidence):
        """Test that high confidence skips LLM fallback."""
        from src.routes.stream import finalize_video_context

        mock_threshold.return_value = 0.4

        result = await finalize_video_context(video_data_high_confidence, mock_llm_provider)

        # LLM should NOT be called
        mock_llm_provider.complete_fast.assert_not_called()
        # Context should be unchanged
        assert result.context.category == "cooking"
        assert result.context.persona == "recipe"
        assert result.context.category_confidence == 0.54

    @patch("src.services.pipeline_helpers.classify_category_with_llm")
    @patch("src.services.pipeline_helpers.get_llm_fallback_threshold")
    async def test_low_confidence_triggers_llm(self, mock_threshold, mock_classify, mock_llm_provider, video_data_low_confidence):
        """Test that low confidence triggers LLM fallback."""
        from src.routes.stream import finalize_video_context

        mock_threshold.return_value = 0.4
        mock_classify.return_value = "cooking"

        result = await finalize_video_context(video_data_low_confidence, mock_llm_provider)

        # LLM should be called
        mock_classify.assert_called_once()
        # Context should be updated
        assert result.context.category == "cooking"
        assert result.context.persona == "recipe"
        assert result.context.category_confidence == 0.8  # Updated by LLM

    @patch("src.services.pipeline_helpers.classify_category_with_llm")
    @patch("src.services.pipeline_helpers.get_llm_fallback_threshold")
    async def test_llm_fallback_returns_standard(self, mock_threshold, mock_classify, mock_llm_provider, video_data_low_confidence):
        """Test LLM fallback can return standard category."""
        from src.routes.stream import finalize_video_context

        mock_threshold.return_value = 0.4
        mock_classify.return_value = "standard"

        result = await finalize_video_context(video_data_low_confidence, mock_llm_provider)

        assert result.context.category == "standard"
        assert result.context.persona == "standard"

    async def test_handles_missing_context(self, mock_llm_provider):
        """Test graceful handling of missing context."""
        from src.routes.stream import finalize_video_context
        from src.services.youtube import VideoData

        video_data = VideoData(
            video_id="test789",
            title="No Context Video",
            channel="Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[],
            subtitles=[],
            context=None,  # No context
        )

        result = await finalize_video_context(video_data, mock_llm_provider)

        # Should return unchanged
        assert result.context is None
        mock_llm_provider.complete_fast.assert_not_called()
