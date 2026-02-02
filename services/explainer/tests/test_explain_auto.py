"""Tests for explain_auto tool."""

import pytest

from src.exceptions import ResourceNotFoundError, ValidationError
from src.tools.explain_auto import explain_auto


class TestExplainAuto:
    """Tests for explain_auto function with dependency injection."""

    async def test_returns_cached_expansion(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_expansion,
    ):
        """Test that cached expansion is returned without LLM call."""
        mock_expansion_repo.find_by_target.return_value = sample_expansion

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        assert result == "# Cached Content\n\nThis was cached."
        mock_llm_service.generate_expansion.assert_not_called()
        mock_expansion_repo.save.assert_not_called()

    async def test_generates_section_expansion(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test section expansion generation when not cached."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary
        mock_llm_service.generate_expansion.return_value = "# Generated Section Documentation"

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        assert result == "# Generated Section Documentation"
        mock_llm_service.generate_expansion.assert_called_once()
        mock_expansion_repo.save.assert_called_once()

        # Verify template was "explain_section"
        call_args = mock_llm_service.generate_expansion.call_args
        assert call_args[0][0] == "explain_section"

    async def test_generates_concept_expansion(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test concept expansion generation when not cached."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary
        mock_llm_service.generate_expansion.return_value = "# Generated Concept Documentation"

        result = await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="concept",
            target_id="concept-uuid-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        assert result == "# Generated Concept Documentation"
        mock_llm_service.generate_expansion.assert_called_once()

        # Verify template was "explain_concept"
        call_args = mock_llm_service.generate_expansion.call_args
        assert call_args[0][0] == "explain_concept"

    async def test_raises_error_video_not_found(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test error when video summary not found."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = None

        with pytest.raises(ResourceNotFoundError, match="Video summary not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="section",
                target_id="section-uuid-1",
                video_summary_repo=mock_video_summary_repo,
                expansion_repo=mock_expansion_repo,
                llm_service=mock_llm_service,
            )

    async def test_raises_error_section_not_found(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test error when section not found."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary

        with pytest.raises(ResourceNotFoundError, match="Section not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="section",
                target_id="nonexistent-section-id",
                video_summary_repo=mock_video_summary_repo,
                expansion_repo=mock_expansion_repo,
                llm_service=mock_llm_service,
            )

    async def test_raises_error_concept_not_found(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test error when concept not found."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary

        with pytest.raises(ResourceNotFoundError, match="Concept not found"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="concept",
                target_id="nonexistent-concept-id",
                video_summary_repo=mock_video_summary_repo,
                expansion_repo=mock_expansion_repo,
                llm_service=mock_llm_service,
            )

    async def test_raises_error_invalid_target_type(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test error for invalid target type."""
        with pytest.raises(ValidationError, match="Invalid target type"):
            await explain_auto(
                video_summary_id=sample_video_summary_id,
                target_type="invalid",
                target_id="some-id",
                video_summary_repo=mock_video_summary_repo,
                expansion_repo=mock_expansion_repo,
                llm_service=mock_llm_service,
            )

    async def test_saves_expansion_with_correct_data(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test that expansion is saved with correct data."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary
        mock_llm_service.generate_expansion.return_value = "Generated content"

        await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        # Verify save was called with correct parameters
        mock_expansion_repo.save.assert_called_once()
        call_kwargs = mock_expansion_repo.save.call_args.kwargs
        assert call_kwargs["video_summary_id"] == sample_video_summary_id
        assert call_kwargs["target_type"] == "section"
        assert call_kwargs["target_id"] == "section-uuid-1"
        assert call_kwargs["content"] == "Generated content"
        assert "model" in call_kwargs
