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
    """Sample completed video summary entry (triage pipeline format)."""
    return {
        "_id": valid_object_id,
        "youtubeId": "dQw4w9WgXcQ",
        "status": ProcessingStatus.COMPLETED.value,
        "title": "Test Video",
        "channel": "Test Channel",
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "duration": 300,
        "triage": {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Learn about the topic",
            "tabs": [
                {"id": "key_points", "label": "Key Points", "emoji": "📝", "description": "Main points"},
            ],
            "confidence": 0.9,
        },
        "output": {
            "learning": {
                "concepts": [{"name": "Test Concept", "definition": "A test"}],
                "keyPoints": ["Point 1", "Point 2"],
            },
        },
        "synthesis": {
            "tldr": "Test TLDR",
            "keyTakeaways": ["Point 1", "Point 2"],
            "masterSummary": "Master summary text",
            "seoDescription": "Test description",
        },
    }


@pytest.fixture
def mock_repository():
    """Mock video repository."""
    repo = MagicMock()
    repo.get_video_summary = MagicMock(return_value=None)
    repo.update_status = MagicMock()
    repo.save_structured_result = MagicMock()
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
        assert "triage_complete" in event_types
        assert "extraction_complete" in event_types
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

    async def test_cached_result_includes_triage(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result includes triage event."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        triage_event = next((e for e in events if e.get("event") == "triage_complete"), None)
        assert triage_event is not None
        assert triage_event["primaryTag"] == "learning"

    async def test_cached_result_includes_extraction(self, client, mock_repository, completed_video_entry, valid_object_id):
        """Test that cached result includes extraction event."""
        mock_repository.get_video_summary.return_value = completed_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        extraction_event = next((e for e in events if e.get("event") == "extraction_complete"), None)
        assert extraction_event is not None
        assert "learning" in extraction_event["data"]


# ─────────────────────────────────────────────────────────────────────────────
# Structured Pipeline Cached Result Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def structured_video_entry(valid_object_id):
    """Sample completed video entry with structured output (triage pipeline format)."""
    return {
        "_id": valid_object_id,
        "youtubeId": "VRoTOE3FqT0",
        "status": ProcessingStatus.COMPLETED.value,
        "title": "Blind Camera Test Winners",
        "channel": "Marques Brownlee",
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "duration": 732,
        "output": {
            "review": {
                "product": "Google Pixel 7A",
                "price": "$500",
                "rating": {"score": 8.5, "maxScore": 10, "label": "Great"},
                "pros": ["Great camera", "Good price"],
                "cons": ["Average battery"],
                "specs": [],
                "comparisons": [],
                "verdict": {
                    "badge": "best_in_class",
                    "bestFor": ["Photography"],
                    "notFor": ["Gaming"],
                    "bottomLine": "Best budget camera phone",
                },
            },
        },
        "triage": {
            "contentTags": ["review"],
            "modifiers": [],
            "primaryTag": "review",
            "userGoal": "Find best camera phone",
            "tabs": [
                {"id": "overview", "label": "Overview", "emoji": "⭐", "description": "Product overview"},
                {"id": "pros_cons", "label": "Pros & Cons", "emoji": "⚖️", "description": "Pros and cons"},
            ],
            "confidence": 0.95,
        },
        "enrichment": None,
        "synthesis": {
            "tldr": "The Pixel 7A wins the blind camera test.",
            "keyTakeaways": ["Great camera for the price", "Budget-friendly option"],
            "masterSummary": "Detailed analysis of camera test results.",
            "seoDescription": "Camera test results",
        },
    }


class TestStreamStructuredCachedResult:
    """Tests for streaming cached structured results (new pipeline format)."""

    async def test_streams_structured_result_event_sequence(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that structured cached result emits events in correct order."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        event_types = [e.get("event") for e in events]

        # Verify correct event sequence
        assert event_types == [
            "cached",
            "metadata",
            "triage_complete",
            "extraction_complete",
            "synthesis_complete",
            "done",
            "done_signal",
        ]

    async def test_structured_cached_metadata(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result metadata event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        metadata = next(e for e in events if e.get("event") == "metadata")
        assert metadata["title"] == "Blind Camera Test Winners"
        assert metadata["channel"] == "Marques Brownlee"
        assert metadata["duration"] == 732

    async def test_structured_cached_triage_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result triage_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        triage = next(e for e in events if e.get("event") == "triage_complete")
        assert triage["primaryTag"] == "review"
        assert triage["confidence"] == 0.95
        assert len(triage["tabs"]) == 2

    async def test_structured_cached_extraction_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result extraction_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        extraction = next(e for e in events if e.get("event") == "extraction_complete")
        assert extraction["data"]["review"]["product"] == "Google Pixel 7A"
        assert extraction["data"]["review"]["rating"]["score"] == 8.5

    async def test_structured_cached_synthesis_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result synthesis_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        synthesis = next(e for e in events if e.get("event") == "synthesis_complete")
        assert synthesis["tldr"] == "The Pixel 7A wins the blind camera test."
        assert len(synthesis["keyTakeaways"]) == 2
        assert synthesis["masterSummary"] == "Detailed analysis of camera test results."

    async def test_structured_cached_done_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result done event has cached flag."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        done = next(e for e in events if e.get("event") == "done")
        assert done["cached"] is True
        assert "videoSummaryId" in done

    async def test_structured_without_enrichment_skips_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that no enrichment_complete event when enrichment is None."""
        structured_video_entry["enrichment"] = None
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        event_types = [e.get("event") for e in events]
        assert "enrichment_complete" not in event_types

    async def test_structured_with_enrichment_includes_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that enrichment_complete event is included when enrichment data exists."""
        structured_video_entry["enrichment"] = {
            "quiz": [{"question": "Q1?", "options": ["A", "B"], "correctIndex": 0, "explanation": "Because A"}],
        }
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        event_types = [e.get("event") for e in events]
        assert "enrichment_complete" in event_types

        enrichment = next(e for e in events if e.get("event") == "enrichment_complete")
        assert len(enrichment["quiz"]) == 1


# ─────────────────────────────────────────────────────────────────────────────
# SSE Event Format Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestSSEEventFormat:
    """Tests for SSE event formatting."""

    def test_sse_event_format(self):
        """Test sse_event helper function format."""
        from src.services.pipeline.pipeline_helpers import sse_event

        result = sse_event("test", {"key": "value"})

        assert result.startswith("data: ")
        assert result.endswith("\n\n")

        data = json.loads(result[6:-2])  # Remove "data: " and "\n\n"
        assert data["event"] == "test"
        assert data["key"] == "value"

    def test_sse_token_format(self):
        """Test sse_token helper function format."""
        from src.services.pipeline.pipeline_helpers import sse_token

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
        from src.services.pipeline.pipeline_helpers import validate_duration

        with pytest.raises(TranscriptError) as exc_info:
            validate_duration(60 * 60 * 11)  # 11 hours (max is 600 min = 10 hours)

        assert exc_info.value.code == ErrorCode.VIDEO_TOO_LONG

    def test_validate_duration_too_short(self):
        """Test duration validation for too short video."""
        from src.services.pipeline.pipeline_helpers import validate_duration

        with pytest.raises(TranscriptError) as exc_info:
            validate_duration(30)  # 30 seconds

        assert exc_info.value.code == ErrorCode.VIDEO_TOO_SHORT

    def test_validate_duration_valid(self):
        """Test duration validation for valid duration."""
        from src.services.pipeline.pipeline_helpers import validate_duration

        # Should not raise
        validate_duration(300)  # 5 minutes

    def test_normalize_segments_from_api(self):
        """Test normalizing segments from API format."""
        from src.services.pipeline.pipeline_helpers import normalize_segments

        segments = [
            {"text": "Hello", "start": 1.5, "duration": 2.0},
        ]

        result = normalize_segments(segments)

        assert len(result) == 1
        assert result[0]["startMs"] == 1500
        assert result[0]["endMs"] == 3500

    def test_normalize_segments_from_whisper(self):
        """Test normalizing segments from Whisper format."""
        from src.services.pipeline.pipeline_helpers import normalize_segments

        segments = [
            {"text": "Hello", "startMs": 1500, "endMs": 3500},
        ]

        result = normalize_segments(segments)

        assert result[0]["startMs"] == 1500
        assert result[0]["endMs"] == 3500



class TestTranscriptData:
    """Tests for TranscriptData dataclass."""

    def test_transcript_data_creation(self):
        """Test creating TranscriptData."""
        from src.services.pipeline.pipeline_helpers import TranscriptData

        data = TranscriptData(
            segments=[{"text": "Hello", "start": 0, "duration": 1}],
            raw_text="Hello",
            transcript_type="manual",
            source="ytdlp",
        )

        assert len(data.segments) == 1
        assert data.raw_text == "Hello"
        assert data.source == "ytdlp"



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
# Structured Cached Result Tests (new pipeline)
# ─────────────────────────────────────────────────────────────────────────────


class TestStreamStructuredCachedResultNewPipeline:
    """Tests for streaming structured (new pipeline) cached results."""

    @pytest.fixture
    def structured_video_entry(self, valid_object_id):
        """Sample structured (triage pipeline) video entry with output field."""
        return {
            "_id": valid_object_id,
            "youtubeId": "dQw4w9WgXcQ",
            "status": ProcessingStatus.COMPLETED.value,
            "title": "MKBHD Camera Test",
            "channel": "MKBHD",
            "thumbnailUrl": "https://example.com/thumb.jpg",
            "duration": 600,
            "triage": {
                "contentTags": ["review"],
                "modifiers": [],
                "primaryTag": "review",
                "userGoal": "Evaluate camera quality",
                "tabs": [
                    {"id": "overview", "label": "Overview", "emoji": "📋", "description": "Summary"},
                    {"id": "pros_cons", "label": "Pros & Cons", "emoji": "⚖️", "description": "Comparison"},
                    {"id": "ratings", "label": "Ratings", "emoji": "⭐", "description": "Scores"},
                    {"id": "verdict", "label": "Verdict", "emoji": "🏆", "description": "Final call"},
                ],
                "confidence": 0.92,
            },
            "output": {
                "review": {
                    "product": "iPhone 15 Camera",
                    "pros": ["Great photo quality"],
                    "cons": ["Expensive"],
                    "rating": {"score": 8.5, "maxScore": 10, "label": "Great"},
                    "verdict": {
                        "badge": "recommended",
                        "bestFor": ["Photography"],
                        "notFor": ["Budget buyers"],
                        "bottomLine": "Excellent camera",
                    },
                },
            },
            "synthesis": {
                "tldr": "iPhone 15 camera is excellent for photography",
                "keyTakeaways": ["Great photo quality", "Improved night mode"],
                "masterSummary": "Full review of iPhone 15 camera capabilities",
                "seoDescription": "iPhone 15 camera review",
            },
        }

    async def test_streams_structured_result_event_sequence(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that structured cached result streams correct event sequence."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        event_types = [e.get("event") for e in events]

        assert event_types == [
            "cached",
            "metadata",
            "triage_complete",
            "extraction_complete",
            "synthesis_complete",
            "done",
            "done_signal",
        ]

    async def test_structured_cached_metadata(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result metadata event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        metadata = next(e for e in events if e.get("event") == "metadata")
        assert metadata["title"] == "MKBHD Camera Test"
        assert metadata["channel"] == "MKBHD"
        assert metadata["duration"] == 600
        assert metadata["thumbnailUrl"] == "https://example.com/thumb.jpg"

    async def test_structured_cached_triage_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result triage_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        triage = next(e for e in events if e.get("event") == "triage_complete")
        assert triage["primaryTag"] == "review"
        assert triage["confidence"] == 0.92
        assert len(triage["tabs"]) == 4

    async def test_structured_cached_extraction_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result extraction_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        extraction = next(e for e in events if e.get("event") == "extraction_complete")
        assert extraction["data"]["review"]["product"] == "iPhone 15 Camera"
        assert len(extraction["data"]["review"]["pros"]) == 1

    async def test_structured_cached_synthesis_complete(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result synthesis_complete event."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        synthesis = next(e for e in events if e.get("event") == "synthesis_complete")
        assert synthesis["tldr"] == "iPhone 15 camera is excellent for photography"
        assert len(synthesis["keyTakeaways"]) == 2
        assert "masterSummary" in synthesis

    async def test_structured_cached_done_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test structured cached result done event includes cached flag."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        done = next(e for e in events if e.get("event") == "done")
        assert done["cached"] is True
        assert done["videoSummaryId"] == valid_object_id

    async def test_structured_without_enrichment_skips_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that enrichment_complete event is skipped when no enrichment data."""
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        event_types = [e.get("event") for e in events]
        assert "enrichment_complete" not in event_types

    async def test_structured_with_enrichment_includes_event(
        self, client, mock_repository, structured_video_entry, valid_object_id
    ):
        """Test that enrichment_complete event is included when enrichment data exists."""
        structured_video_entry["enrichment"] = {
            "quiz": [
                {
                    "question": "What score did the camera get?",
                    "options": ["7", "8", "8.5", "9"],
                    "correctIndex": 2,
                    "explanation": "The camera scored 8.5/10",
                }
            ],
        }
        mock_repository.get_video_summary.return_value = structured_video_entry

        response = await client.get(f"/summarize/stream/{valid_object_id}")
        events = parse_sse_events(response.text)

        event_types = [e.get("event") for e in events]
        assert "enrichment_complete" in event_types

        enrichment = next(e for e in events if e.get("event") == "enrichment_complete")
        assert len(enrichment["quiz"]) == 1
