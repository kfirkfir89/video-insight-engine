"""Tests for the navigator tool."""

from __future__ import annotations

from unittest.mock import AsyncMock

from src.repositories.video_repository import VideoContext
from src.tools.navigator import NavigatorTool


def _make_video_ctx(tabs: list[dict] | None = None) -> VideoContext:
    default_tabs = [
        {"id": "key_points", "label": "Key Points", "emoji": "📝", "props": {"items": ["Neural networks learn by adjusting weights"]}},
        {"id": "concepts", "label": "Concepts", "emoji": "💡", "props": {"items": ["Backpropagation", "Gradient descent"]}},
        {"id": "quizzes", "label": "Quizzes", "emoji": "🧠", "props": {}},
        {"id": "timestamps", "label": "Timestamps", "emoji": "⏱️", "props": {"entries": ["0:00 Intro", "5:30 Deep dive"]}},
    ]
    return VideoContext(
        id="vid1",
        youtube_id="yt1",
        title="Neural Networks Explained",
        creator="3Blue1Brown",
        summary="A visual intro to neural nets.",
        takeaways=["Layers transform data"],
        tabs=tabs if tabs is not None else default_tabs,
        output_data=None,
    )


class TestNavigator:
    """Navigator tool tests."""

    async def test_should_find_matching_tab_by_label(self) -> None:
        """Should return a match when query matches a tab label directly."""
        # Arrange
        video_repo = AsyncMock()
        tool = NavigatorTool(video_repo=video_repo)
        params = {"query": "key points"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        matches = result["matches"]
        assert len(matches) >= 1
        assert matches[0]["tab_id"] == "key_points"
        assert matches[0]["relevance"] == "high"

    async def test_should_return_empty_when_no_match(self) -> None:
        """Should return empty matches when query does not match any tab."""
        # Arrange
        video_repo = AsyncMock()
        tool = NavigatorTool(video_repo=video_repo)
        params = {"query": "xyzzy gibberish nonexistent"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["matches"] == []

    async def test_should_rank_matches_by_relevance(self) -> None:
        """Should return higher-relevance tabs first when multiple match."""
        # Arrange
        video_repo = AsyncMock()
        tool = NavigatorTool(video_repo=video_repo)
        # "concepts" is an exact substring match → high score
        # "backpropagation" appears in concepts props → props-based score
        params = {"query": "concepts"}
        context = {"video_ctx": _make_video_ctx()}

        # Act
        result = await tool.execute(params, context)

        # Assert
        matches = result["matches"]
        assert len(matches) >= 1
        # The tab with exact label match should be first
        assert matches[0]["tab_id"] == "concepts"
        assert matches[0]["relevance"] == "high"

    async def test_should_handle_tabs_without_labels(self) -> None:
        """Should not crash when tabs lack label or id fields."""
        # Arrange
        tabs_without_labels = [
            {"props": {"items": ["some content about deep learning"]}},
            {"id": "setup", "props": {}},
        ]
        video_repo = AsyncMock()
        tool = NavigatorTool(video_repo=video_repo)
        params = {"query": "deep learning"}
        context = {"video_ctx": _make_video_ctx(tabs=tabs_without_labels)}

        # Act
        result = await tool.execute(params, context)

        # Assert — should not raise; may or may not find a match via props
        assert isinstance(result["matches"], list)
