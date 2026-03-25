"""Tests for ContextBuilder — system prompt assembly."""

from __future__ import annotations

from tests.conftest import make_video_context, make_rag_sources


class TestContextBuilderBuild:

    async def test_should_include_title_and_creator(self, context_builder, sample_video_context, sample_rag_sources):
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=sample_rag_sources)

        assert sample_video_context.title in prompt
        assert sample_video_context.creator in prompt

    async def test_should_include_tabs_overview(self, context_builder, sample_video_context, sample_rag_sources):
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=sample_rag_sources)

        assert "Key Points" in prompt
        assert "Concepts" in prompt

    async def test_should_include_rag_chunks(self, context_builder, sample_video_context, sample_rag_sources):
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=sample_rag_sources)

        assert "neural network" in prompt.lower() or "layers" in prompt.lower()

    async def test_should_handle_empty_chunks(self, context_builder, sample_video_context):
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=[])

        assert sample_video_context.title in prompt
        assert len(prompt) > 0

    async def test_should_truncate_long_summaries(self, context_builder, sample_rag_sources):
        long_ctx = make_video_context(summary="x" * 10_000)
        prompt = context_builder.build(video_ctx=long_ctx, rag_chunks=sample_rag_sources)

        assert len(prompt) < 15_000

    async def test_should_handle_missing_fields(self, context_builder, sample_rag_sources):
        minimal_ctx = make_video_context(takeaways=[], tabs=[], summary="")
        prompt = context_builder.build(video_ctx=minimal_ctx, rag_chunks=sample_rag_sources)

        assert minimal_ctx.title in prompt
        assert len(prompt) > 0
