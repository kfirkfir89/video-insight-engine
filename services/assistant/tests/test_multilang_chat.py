"""Tests for multi-language chat — Hebrew query round-trip via assistant."""

from __future__ import annotations

from unittest.mock import AsyncMock

from src.utils.language_detect import detect_language


class TestHebrewDetection:
    """Hebrew script detection covers RTL queries the user is most likely to send."""

    def test_should_detect_hebrew_query(self):
        # "Explain the main idea of the video"
        text = "הסבר על הרעיון המרכזי של הסרטון"
        assert detect_language(text) == "he"

    def test_should_detect_english_query(self):
        assert detect_language("Explain the main idea of this video") == "en"

    def test_should_fall_back_to_en_for_short_text(self):
        # Below the 10-char minimum
        assert detect_language("hi") == "en"

    def test_should_detect_arabic_query(self):
        # "Explain the main idea"
        text = "اشرح الفكرة الرئيسية للفيديو"
        assert detect_language(text) == "ar"


class TestHebrewRoundTrip:
    """Chat with a Hebrew query: detect -> translate to English for RAG -> stream response."""

    async def test_should_translate_hebrew_query_for_rag(
        self, mock_video_repo, mock_rag, mock_llm, mock_settings,
    ):
        from src.services.assistant import AssistantService
        from src.services.context_builder import ContextBuilder

        mock_llm.translate_to_english = AsyncMock(
            return_value="What are the main concepts in this video?"
        )

        assistant = AssistantService(
            llm=mock_llm,
            rag=mock_rag,
            video_repo=mock_video_repo,
            context_builder=ContextBuilder(),
            settings=mock_settings,
        )

        events = []
        async for event in assistant.chat(
            video_id="abc123",
            message="מה הם הרעיונות המרכזיים בסרטון הזה?",
            history=[],
        ):
            events.append(event)

        # RAG should have been searched with the English translation
        mock_llm.translate_to_english.assert_awaited_once()
        rag_kwargs = mock_rag.search.call_args.kwargs
        assert rag_kwargs["query"] == "What are the main concepts in this video?"
        assert any('"type":"done"' in e for e in events)

    async def test_should_fall_back_to_original_when_translation_fails(
        self, mock_video_repo, mock_rag, mock_llm, mock_settings,
    ):
        from src.services.assistant import AssistantService
        from src.services.context_builder import ContextBuilder

        mock_llm.translate_to_english = AsyncMock(return_value=None)

        assistant = AssistantService(
            llm=mock_llm,
            rag=mock_rag,
            video_repo=mock_video_repo,
            context_builder=ContextBuilder(),
            settings=mock_settings,
        )

        message = "מה הם הרעיונות המרכזיים בסרטון הזה?"
        async for _ in assistant.chat(video_id="abc123", message=message, history=[]):
            pass

        rag_kwargs = mock_rag.search.call_args.kwargs
        assert rag_kwargs["query"] == message  # falls back to original

    async def test_should_skip_translation_for_english_query(
        self, mock_video_repo, mock_rag, mock_llm, mock_settings,
    ):
        from src.services.assistant import AssistantService
        from src.services.context_builder import ContextBuilder

        mock_llm.translate_to_english = AsyncMock()

        assistant = AssistantService(
            llm=mock_llm,
            rag=mock_rag,
            video_repo=mock_video_repo,
            context_builder=ContextBuilder(),
            settings=mock_settings,
        )

        async for _ in assistant.chat(
            video_id="abc123",
            message="What are the main concepts in this video?",
            history=[],
        ):
            pass

        mock_llm.translate_to_english.assert_not_awaited()


class TestContextBuilderLanguageInstruction:
    """ContextBuilder should append a language instruction for non-English users."""

    def test_should_add_language_instruction_for_hebrew(self, sample_video_context):
        from src.services.context_builder import ContextBuilder

        builder = ContextBuilder()
        prompt = builder.build(
            video_ctx=sample_video_context,
            rag_chunks=None,
            user_language="he",
        )
        assert "Respond in the user's language (he)" in prompt

    def test_should_not_add_language_instruction_for_english(self, sample_video_context):
        from src.services.context_builder import ContextBuilder

        builder = ContextBuilder()
        prompt = builder.build(
            video_ctx=sample_video_context,
            rag_chunks=None,
            user_language="en",
        )
        assert "Respond in the user's language" not in prompt
