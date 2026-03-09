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


class TestExplainAutoOutputType:
    """Tests for outputType awareness in explain_auto."""

    async def test_section_context_includes_output_type_label(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test that section context includes output_type_label and hint."""
        from src.schemas import VideoSummary, VideoSummarySection

        summary = VideoSummary(
            id=sample_video_summary_id,
            youtubeId="abc123",
            title="Pasta Carbonara Recipe",
            output_type="recipe",
            sections=[VideoSummarySection(
                id="sec-1",
                title="Ingredients",
                timestamp="00:30",
                content=[{"type": "paragraph", "text": "Gather your ingredients."}],
            )],
            concepts=[],
        )
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = summary
        mock_llm_service.generate_expansion.return_value = "# Ingredients"

        await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="sec-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.generate_expansion.call_args
        context = call_args[0][1]
        assert context["output_type_label"] == "Recipe"
        hint = context["output_type_hint"].lower()
        assert "cooking" in hint or "ingredient" in hint, f"Expected cooking/ingredient keywords in hint: {hint}"

    async def test_concept_context_includes_output_type_label(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
    ):
        """Test that concept context includes output_type_label and hint."""
        from src.schemas import VideoSummary, VideoSummaryConcept

        summary = VideoSummary(
            id=sample_video_summary_id,
            youtubeId="abc123",
            title="Biology Study Guide",
            output_type="study_kit",
            sections=[],
            concepts=[VideoSummaryConcept(
                id="con-1",
                name="Mitosis",
                definition="Cell division process",
            )],
        )
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = summary
        mock_llm_service.generate_expansion.return_value = "# Mitosis"

        await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="concept",
            target_id="con-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.generate_expansion.call_args
        context = call_args[0][1]
        assert context["output_type_label"] == "Study Kit"
        hint = context["output_type_hint"].lower()
        assert "academic" in hint or "theories" in hint or "concepts" in hint, f"Expected academic/theories/concepts keywords in hint: {hint}"

    async def test_default_output_type_when_absent(
        self,
        mock_video_summary_repo,
        mock_expansion_repo,
        mock_llm_service,
        sample_video_summary_id,
        sample_video_summary,
    ):
        """Test default output_type='explanation' when field uses default."""
        mock_expansion_repo.find_by_target.return_value = None
        mock_video_summary_repo.find_by_id.return_value = sample_video_summary
        mock_llm_service.generate_expansion.return_value = "# Content"

        await explain_auto(
            video_summary_id=sample_video_summary_id,
            target_type="section",
            target_id="section-uuid-1",
            video_summary_repo=mock_video_summary_repo,
            expansion_repo=mock_expansion_repo,
            llm_service=mock_llm_service,
        )

        call_args = mock_llm_service.generate_expansion.call_args
        context = call_args[0][1]
        assert context["output_type_label"] == "Explanation"
