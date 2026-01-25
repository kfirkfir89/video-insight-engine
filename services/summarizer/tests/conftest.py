"""Pytest fixtures for summarizer tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_llm_provider():
    """Mock LLMProvider for testing."""
    from src.services.llm_provider import LLMProvider

    provider = MagicMock(spec=LLMProvider)
    provider.model = "anthropic/claude-sonnet-4-20250514"

    # Default mock for complete() - can be overridden per test
    provider.complete = AsyncMock(
        return_value='{"sections": [{"title": "Test", "startSeconds": 0, "endSeconds": 60}]}'
    )

    # Default mock for stream() - can be overridden per test
    async def mock_stream(*args, **kwargs):
        yield '{"sections": [{"title": "Test", "startSeconds": 0, "endSeconds": 60}]}'

    provider.stream = mock_stream

    return provider


@pytest.fixture
def mock_repository():
    """Mock video repository."""
    repo = MagicMock()
    repo.update_status = MagicMock()
    repo.save_result = MagicMock()
    return repo


@pytest.fixture
def sample_segments():
    """Sample transcript segments."""
    return [
        {"text": "Hello and welcome", "start": 0.0, "duration": 2.5},
        {"text": "to this video about testing", "start": 2.5, "duration": 3.0},
        {"text": "Today we will learn", "start": 5.5, "duration": 2.0},
        {"text": "how to write good tests", "start": 7.5, "duration": 3.0},
    ]


@pytest.fixture
def sample_transcript():
    """Sample cleaned transcript text."""
    return "Hello and welcome to this video about testing. Today we will learn how to write good tests."


@pytest.fixture
def sample_llm_sections_response():
    """Sample LLM response for section detection."""
    return '{"sections": [{"title": "Introduction", "startSeconds": 0, "endSeconds": 30}, {"title": "Testing Basics", "startSeconds": 30, "endSeconds": 60}]}'


@pytest.fixture
def sample_llm_summary_response():
    """Sample LLM response for section summary with content blocks."""
    return '{"content": [{"type": "paragraph", "text": "This section covers the basics of testing."}, {"type": "bullets", "items": ["Write tests first", "Keep tests simple"]}]}'


@pytest.fixture
def sample_llm_concepts_response():
    """Sample LLM response for concept extraction."""
    return '{"concepts": [{"name": "Unit Testing", "definition": "Testing individual components"}, {"name": "Integration Testing", "definition": "Testing components together"}]}'


@pytest.fixture
def sample_llm_synthesis_response():
    """Sample LLM response for synthesis."""
    return '{"tldr": "A video about writing effective tests.", "keyTakeaways": ["Always test", "Keep it simple"]}'
