"""Tests for ContextBuilder — system prompt assembly."""

from __future__ import annotations

from tests.conftest import make_video_context, make_rag_sources


class TestContextBuilderBuild:
    async def test_should_include_title_and_creator(
        self, context_builder, sample_video_context, sample_rag_sources
    ):
        prompt = context_builder.build(
            video_ctx=sample_video_context, rag_chunks=sample_rag_sources
        )

        assert sample_video_context.title in prompt
        assert sample_video_context.creator in prompt

    async def test_should_include_tabs_overview(
        self, context_builder, sample_video_context, sample_rag_sources
    ):
        prompt = context_builder.build(
            video_ctx=sample_video_context, rag_chunks=sample_rag_sources
        )

        assert "Key Points" in prompt
        assert "Concepts" in prompt

    async def test_should_include_rag_chunks(
        self, context_builder, sample_video_context, sample_rag_sources
    ):
        prompt = context_builder.build(
            video_ctx=sample_video_context, rag_chunks=sample_rag_sources
        )

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

    async def test_should_prefix_chunks_with_timestamp_citation(
        self, context_builder, sample_video_context
    ):
        from src.models.responses import RAGSource

        chunks = [
            RAGSource(
                text="Attention is all you need.",
                video_id="abc",
                timestamp="12:34",
                score=0.9,
                chunk_index=0,
            )
        ]
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=chunks)

        assert "[12:34] Attention is all you need." in prompt

    async def test_should_omit_citation_for_null_timestamp(
        self, context_builder, sample_video_context
    ):
        """Legacy v1 points carry no timestamp — chunk renders without a prefix."""
        from src.models.responses import RAGSource

        chunks = [
            RAGSource(
                text="Old chunk without timeline.",
                video_id="abc",
                timestamp=None,
                score=0.9,
                chunk_index=0,
            )
        ]
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=chunks)

        assert "Old chunk without timeline." in prompt
        assert "[None]" not in prompt
        assert "[] Old chunk" not in prompt

    async def test_should_say_nothing_relevant_when_no_chunks(
        self, context_builder, sample_video_context
    ):
        """Relevance-floor wipeout → the model is told to admit the gap."""
        from src.utils.prompt_templates import RAG_EMPTY_NOTE

        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=[])

        assert RAG_EMPTY_NOTE in prompt

    async def test_should_teach_timestamp_citation_when_chunks_carry_timestamps(
        self, context_builder, sample_video_context
    ):
        from src.models.responses import RAGSource
        from src.utils.prompt_templates import RAG_TIMESTAMP_CITE_NOTE

        chunks = [
            RAGSource(
                text="Timed chunk.", video_id="abc", timestamp="1:23", score=0.9, chunk_index=0
            )
        ]
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=chunks)

        assert RAG_TIMESTAMP_CITE_NOTE in prompt

    async def test_should_omit_citation_note_when_no_chunk_has_timestamp(
        self, context_builder, sample_video_context
    ):
        from src.models.responses import RAGSource
        from src.utils.prompt_templates import RAG_TIMESTAMP_CITE_NOTE

        chunks = [
            RAGSource(
                text="Untimed chunk.", video_id="abc", timestamp=None, score=0.9, chunk_index=0
            )
        ]
        prompt = context_builder.build(video_ctx=sample_video_context, rag_chunks=chunks)

        assert RAG_TIMESTAMP_CITE_NOTE not in prompt


class TestContextBuilderBuildLibrary:
    """build_library: multi-video, conversational, title-attributed prompt."""

    async def test_should_not_leak_raw_ids_or_excerpt_jargon(self, context_builder):
        from src.models.responses import RAGSource

        chunks = [
            RAGSource(text="React uses hooks.", video_id="react_id", score=0.9, chunk_index=0)
        ]
        prompt = context_builder.build_library(rag_chunks=chunks)

        # The model must never be told to print raw ids or cite "[video: id]".
        assert "react_id" not in prompt
        assert "[video:" not in prompt.lower()

    async def test_should_group_chunks_by_title_from_inventory(self, context_builder):
        from src.models.responses import RAGSource

        chunks = [
            RAGSource(text="React uses hooks.", video_id="react_id", score=0.9, chunk_index=0),
            RAGSource(
                text="Vue tracks reactive refs.", video_id="vue_id", score=0.8, chunk_index=0
            ),
        ]
        inventory = [
            {"video_id": "react_id", "title": "React Deep Dive"},
            {"video_id": "vue_id", "title": "Vue Basics"},
        ]
        prompt = context_builder.build_library(rag_chunks=chunks, inventory=inventory)

        assert "React Deep Dive" in prompt
        assert "Vue Basics" in prompt
        assert "react_id" not in prompt  # title used, never the raw id
        assert "React uses hooks." in prompt

    async def test_should_list_inventory_even_without_matching_chunks(self, context_builder):
        inventory = [
            {"video_id": "v1", "title": "My First Video"},
            {"video_id": "v2", "title": "My Second Video"},
        ]
        prompt = context_builder.build_library(rag_chunks=[], inventory=inventory)

        assert "My First Video" in prompt
        assert "My Second Video" in prompt

    async def test_should_add_language_instruction_for_non_english(
        self, context_builder, sample_rag_sources
    ):
        prompt = context_builder.build_library(rag_chunks=sample_rag_sources, user_language="he")

        assert "he" in prompt
        assert "language" in prompt.lower()


def _make_translated_context():
    """Translated video: English promoted to top level, Hebrew under sourceLanguage."""
    return make_video_context(
        language="en",
        summary="English master summary about neural networks.",
        tabs=[{"id": "key_points", "label": "Key Points", "emoji": "\U0001f4dd"}],
        source_language={
            "code": "he",
            "name": "Hebrew",
            "isRTL": True,
            "meta": {
                "masterSummary": "תקציר בעברית על רשתות ניורונים.",
                "keyTakeaways": ["השכלה ראשונה"],
            },
            "tabs": [{"id": "key_points", "label": "נקודות מפתח", "emoji": "\U0001f4dd"}],
        },
    )


class TestContextBuilderSourceLanguage:
    """sourceLanguage grounding: English promoted to top level, native nested."""

    async def test_should_use_top_level_english_summary_for_english_user(
        self, context_builder, sample_rag_sources
    ):
        ctx = _make_translated_context()

        prompt = context_builder.build(
            video_ctx=ctx,
            rag_chunks=sample_rag_sources,
            user_language="en",
        )

        assert "English master summary about neural networks." in prompt

    async def test_should_use_native_summary_for_source_language_user(self, context_builder):
        ctx = _make_translated_context()
        # A Hebrew message → detect_language yields "he" → matches source code.
        from src.utils.language_detect import detect_language

        hebrew_message = "מה זה רשת ניורונים?"
        assert detect_language(hebrew_message) == "he"

        rag_chunks = make_rag_sources(1)
        rag_chunks[0].text_original = "טקסט מקורי בעברית"

        prompt = context_builder.build(
            video_ctx=ctx,
            rag_chunks=rag_chunks,
            user_language="he",
        )

        assert ctx.source_language is not None
        native_summary = ctx.source_language["meta"]["masterSummary"]
        assert native_summary in prompt
        # text_original is preferred when the user language matches the real source.
        assert "טקסט מקורי בעברית" in prompt
