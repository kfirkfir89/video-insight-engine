"""Pytest fixtures for explainer tests."""

import pytest
from unittest.mock import MagicMock, AsyncMock
from bson import ObjectId


@pytest.fixture
def mock_llm_provider():
    """Mock LLMProvider for testing."""
    from src.services.llm_provider import LLMProvider

    provider = MagicMock(spec=LLMProvider)
    provider.model = "anthropic/claude-sonnet-4-20250514"

    # Default mock for complete() - can be overridden per test
    provider.complete = AsyncMock(return_value="Generated content from LLM")
    provider.complete_with_messages = AsyncMock(return_value="Generated content from LLM")

    # Default mock for stream() - can be overridden per test
    async def mock_stream(*args, **kwargs):
        yield "Hello "
        yield "world"

    async def mock_stream_with_messages(*args, **kwargs):
        yield "Hello "
        yield "world"

    provider.stream = mock_stream
    provider.stream_with_messages = mock_stream_with_messages

    return provider


@pytest.fixture
def sample_video_summary_id():
    """Sample video summary ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_user_id():
    """Sample user ObjectId string."""
    return str(ObjectId())


@pytest.fixture
def sample_section():
    """Sample video section."""
    return {
        "id": "section-uuid-1",
        "title": "Introduction",
        "timestamp": "00:00",
        "summary": "This is the introduction section.",
        "bullets": ["First point", "Second point"],
    }


@pytest.fixture
def sample_concept():
    """Sample video concept."""
    return {
        "id": "concept-uuid-1",
        "name": "Machine Learning",
        "definition": "A field of AI that enables computers to learn from data.",
    }


@pytest.fixture
def sample_video_summary(sample_section, sample_concept):
    """Sample video summary document."""
    return {
        "_id": ObjectId(),
        "title": "Test Video Title",
        "youtubeId": "abc123xyz",
        "summary": {
            "tldr": "A test video about machine learning.",
            "keyTakeaways": ["Learn ML basics", "Understand data"],
            "sections": [sample_section],
            "concepts": [sample_concept],
        },
    }


@pytest.fixture
def sample_memorized_item():
    """Sample memorized item document."""
    return {
        "_id": ObjectId(),
        "userId": ObjectId(),
        "title": "Saved ML Content",
        "notes": "My personal notes on this.",
        "source": {
            "videoTitle": "Test Video Title",
            "youtubeUrl": "https://youtube.com/watch?v=abc123xyz",
            "content": {
                "sections": [
                    {
                        "title": "Introduction",
                        "timestamp": "00:00",
                        "summary": "Intro summary",
                        "bullets": ["Point 1", "Point 2"],
                    }
                ],
            },
        },
    }


@pytest.fixture
def sample_chat():
    """Sample chat document."""
    return {
        "_id": ObjectId(),
        "userId": ObjectId(),
        "memorizedItemId": ObjectId(),
        "messages": [
            {"role": "user", "content": "What is this about?"},
            {"role": "assistant", "content": "This is about machine learning."},
        ],
    }


@pytest.fixture
def sample_expansion():
    """Sample cached expansion document."""
    return {
        "_id": ObjectId(),
        "videoSummaryId": ObjectId(),
        "targetType": "section",
        "targetId": "section-uuid-1",
        "content": "# Detailed Expansion\n\nThis is the cached expansion content.",
        "status": "completed",
    }
