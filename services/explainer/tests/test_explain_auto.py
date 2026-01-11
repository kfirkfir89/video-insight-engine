"""Tests for explain_auto tool."""

import pytest
from unittest.mock import patch, AsyncMock

from src.tools.explain_auto import explain_auto


class TestExplainAuto:
    """Tests for explain_auto function."""

    @patch("src.tools.explain_auto.mongodb")
    @patch("src.tools.explain_auto.generate_expansion", new_callable=AsyncMock)
    async def test_returns_cached_expansion(
        self,
        mock_generate,
        mock_mongodb,
        sample_video_summary_id,
    ):
        """Test that cached expansion is returned without LLM call."""
        mock_mongodb.get_expansion.return_value = {
            "content": "# Cached Content\n\nThis was cached."
        }

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
        )

        assert result == "# Cached Content\n\nThis was cached."
        mock_generate.assert_not_called()
        mock_mongodb.save_expansion.assert_not_called()

    @patch("src.tools.explain_auto.mongodb")
    @patch("src.tools.explain_auto.generate_expansion", new_callable=AsyncMock)
    async def test_generates_section_expansion(
        self,
        mock_generate,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test section expansion generation when not cached."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary
        mock_generate.return_value = "# Generated Section Documentation"

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
        )

        assert result == "# Generated Section Documentation"
        mock_generate.assert_called_once_with("explain_section", pytest.approx(dict, rel=1))
        mock_mongodb.save_expansion.assert_called_once()

    @patch("src.tools.explain_auto.mongodb")
    @patch("src.tools.explain_auto.generate_expansion", new_callable=AsyncMock)
    async def test_generates_concept_expansion(
        self,
        mock_generate,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test concept expansion generation when not cached."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary
        mock_generate.return_value = "# Generated Concept Documentation"

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="concept",
            target_id="concept-uuid-1",
        )

        assert result == "# Generated Concept Documentation"
        mock_generate.assert_called_once_with("explain_concept", pytest.approx(dict, rel=1))
        mock_mongodb.save_expansion.assert_called_once()

    @patch("src.tools.explain_auto.mongodb")
    async def test_raises_error_video_not_found(
        self,
        mock_mongodb,
        sample_video_summary_id,
    ):
        """Test error when video summary not found."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = None

        with pytest.raises(ValueError, match="Video summary not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="section",
                target_id="section-uuid-1",
            )

    @patch("src.tools.explain_auto.mongodb")
    async def test_raises_error_section_not_found(
        self,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test error when section not found."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary

        with pytest.raises(ValueError, match="Section not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="section",
                target_id="nonexistent-section-id",
            )

    @patch("src.tools.explain_auto.mongodb")
    async def test_raises_error_concept_not_found(
        self,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test error when concept not found."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary

        with pytest.raises(ValueError, match="Concept not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="concept",
                target_id="nonexistent-concept-id",
            )

    @patch("src.tools.explain_auto.mongodb")
    async def test_raises_error_invalid_target_type(
        self,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test error for invalid target type."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary

        with pytest.raises(ValueError, match="Invalid target type"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="invalid",
                target_id="some-id",
            )

    @patch("src.tools.explain_auto.mongodb")
    @patch("src.tools.explain_auto.generate_expansion", new_callable=AsyncMock)
    async def test_saves_expansion_with_correct_model(
        self,
        mock_generate,
        mock_mongodb,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test that expansion is saved with correct model name."""
        mock_mongodb.get_expansion.return_value = None
        mock_mongodb.get_video_summary.return_value = sample_video_summary
        mock_generate.return_value = "Generated content"

        await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
        )

        # Verify save_expansion was called
        mock_mongodb.save_expansion.assert_called_once()
        call_kwargs = mock_mongodb.save_expansion.call_args.kwargs
        assert call_kwargs["video_summary_id"] == sample_video_summary_id
        assert call_kwargs["target_type"] == "section"
        assert call_kwargs["target_id"] == "section-uuid-1"
        assert call_kwargs["content"] == "Generated content"
        assert "model" in call_kwargs
