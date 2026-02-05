"""Pytest fixtures for explainer tests."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from src.schemas import (
    Chat,
    ChatMessage,
    Expansion,
    MemorizedItem,
    MemorizedItemSource,
    VideoSummary,
    VideoSummaryConcept,
    VideoSummarySection,
)
from src.services.llm import LLMService
from src.services.llm_provider import LLMProvider


def _utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


# ============================================================
# Mock Repositories
# ============================================================


@pytest.fixture
def mock_video_summary_repo():
    """Mock video summary repository."""
    repo = AsyncMock()
    repo.find_by_id = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_expansion_repo():
    """Mock expansion repository."""
    repo = AsyncMock()
    repo.find_by_target = AsyncMock(return_value=None)
    repo.save = AsyncMock(return_value=str(ObjectId()))
    return repo


@pytest.fixture
def mock_memorized_item_repo():
    """Mock memorized item repository."""
    repo = AsyncMock()
    repo.find_by_id_and_user = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_chat_repo():
    """Mock chat repository."""
    repo = AsyncMock()
    repo.find_by_id_and_user = AsyncMock(return_value=None)
    repo.create = AsyncMock(return_value=str(ObjectId()))
    repo.add_messages = AsyncMock()
    return repo


# ============================================================
# Mock LLM Services
# ============================================================


@pytest.fixture
def mock_llm_provider():
    """Mock LLMProvider for testing."""
    provider = MagicMock(spec=LLMProvider)
    provider.model = "anthropic/claude-sonnet-4-20250514"
    provider.complete = AsyncMock(return_value="Generated content from LLM")
    provider.complete_with_messages = AsyncMock(return_value="Generated content from LLM")

    async def mock_stream_with_messages(*args, **kwargs):
        yield "Hello "
        yield "world"

    provider.stream_with_messages = mock_stream_with_messages
    return provider


@pytest.fixture
def mock_llm_service(mock_llm_provider):
    """Mock LLM service for testing."""
    service = MagicMock(spec=LLMService)
    service.generate_expansion = AsyncMock(return_value="# Generated Documentation")
    service.chat_completion = AsyncMock(return_value="Assistant response")

    async def mock_stream(*args, **kwargs):
        yield "Hello "
        yield "world"

    service.chat_completion_stream = mock_stream
    return service


# ============================================================
# Sample Data Fixtures
# ============================================================


@pytest.fixture
def sample_video_summary_id():
    """Sample video summary ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_user_id():
    """Sample user ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_memorized_item_id():
    """Sample memorized item ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_chat_id():
    """Sample chat ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_section():
    """Sample video section domain object."""
    return VideoSummarySection(
        id="section-uuid-1",
        title="Introduction",
        timestamp="00:00",
        content=[
            {"type": "paragraph", "text": "This is the introduction section."},
            {"type": "bullets", "items": ["First point", "Second point"]},
        ],
    )


@pytest.fixture
def sample_concept():
    """Sample video concept domain object."""
    return VideoSummaryConcept(
        id="concept-uuid-1",
        name="Machine Learning",
        definition="A field of AI that enables computers to learn from data.",
    )


@pytest.fixture
def sample_video_summary(sample_video_summary_id, sample_section, sample_concept):
    """Sample video summary domain object."""
    return VideoSummary(
        id=sample_video_summary_id,
        youtubeId="abc123xyz",
        title="Test Video Title",
        sections=[sample_section],
        concepts=[sample_concept],
    )


@pytest.fixture
def sample_expansion(sample_video_summary_id):
    """Sample cached expansion domain object."""
    return Expansion(
        id=str(ObjectId()),
        videoSummaryId=sample_video_summary_id,
        targetType="section",
        targetId="section-uuid-1",
        context={"title": "Introduction"},
        content="# Cached Content\n\nThis was cached.",
        status="completed",
        version=1,
        model="anthropic/claude-sonnet-4-20250514",
        generatedAt=_utc_now(),
        createdAt=_utc_now(),
    )


@pytest.fixture
def sample_memorized_item(sample_memorized_item_id, sample_user_id):
    """Sample memorized item domain object."""
    return MemorizedItem(
        id=sample_memorized_item_id,
        userId=sample_user_id,
        title="Saved ML Content",
        source=MemorizedItemSource(
            videoTitle="Test Video Title",
            youtubeUrl="https://youtube.com/watch?v=abc123xyz",
            content={
                "sections": [
                    {
                        "title": "Introduction",
                        "timestamp": "00:00",
                        "content": [
                            {"type": "paragraph", "text": "Intro summary"},
                            {"type": "bullets", "items": ["Point 1", "Point 2"]},
                        ],
                    }
                ],
            },
        ),
        notes="My personal notes on this.",
        createdAt=_utc_now(),
        updatedAt=_utc_now(),
    )


@pytest.fixture
def sample_chat(sample_chat_id, sample_user_id, sample_memorized_item_id):
    """Sample chat domain object."""
    return Chat(
        id=sample_chat_id,
        userId=sample_user_id,
        memorizedItemId=sample_memorized_item_id,
        messages=[
            ChatMessage(role="user", content="What is this about?", createdAt=_utc_now()),
            ChatMessage(
                role="assistant",
                content="This is about machine learning.",
                createdAt=_utc_now(),
            ),
        ],
        title=None,
        createdAt=_utc_now(),
        updatedAt=_utc_now(),
    )
