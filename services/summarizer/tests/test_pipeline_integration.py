"""Integration tests: full pipeline (detect -> extract -> enrich -> synthesize) for all 10 output types.

Each test mocks the LLM to return realistic JSON for its output type,
then verifies the full chain produces valid Pydantic models and correct events.
"""
import json
import pytest
from unittest.mock import MagicMock, AsyncMock

from src.services.pipeline.intent_detector import detect_intent
from src.services.pipeline.extractor import extract
from src.services.pipeline.enrichment import enrich
from src.services.pipeline.synthesis import synthesize
from src.models.output_types import (
    IntentResult,
    OutputSection,
    SynthesisResult,
    EnrichmentData,
    OUTPUT_TYPE_MODELS,
)


# ─────────────────────────────────────────────────────────────────────────────
# LLM response fixtures per output type
# ─────────────────────────────────────────────────────────────────────────────

_INTENT_RESPONSES = {
    "explanation": {"outputType": "explanation", "confidence": 0.95, "userGoal": "Understand the topic", "sections": []},
    "recipe": {"outputType": "recipe", "confidence": 0.98, "userGoal": "Learn a recipe", "sections": []},
    "code_walkthrough": {"outputType": "code_walkthrough", "confidence": 0.92, "userGoal": "Learn coding", "sections": []},
    "study_kit": {"outputType": "study_kit", "confidence": 0.93, "userGoal": "Study the topic", "sections": []},
    "trip_planner": {"outputType": "trip_planner", "confidence": 0.90, "userGoal": "Plan a trip", "sections": []},
    "workout": {"outputType": "workout", "confidence": 0.91, "userGoal": "Follow a workout", "sections": []},
    "verdict": {"outputType": "verdict", "confidence": 0.94, "userGoal": "Evaluate a product", "sections": []},
    "highlights": {"outputType": "highlights", "confidence": 0.88, "userGoal": "Get interview highlights", "sections": []},
    "music_guide": {"outputType": "music_guide", "confidence": 0.89, "userGoal": "Analyze music", "sections": []},
    "project_guide": {"outputType": "project_guide", "confidence": 0.91, "userGoal": "Build a project", "sections": []},
}

_EXTRACTION_RESPONSES: dict[str, dict] = {
    "explanation": {
        "keyPoints": [
            {"emoji": "💡", "title": "Core Idea", "detail": "The main concept explained"},
            {"emoji": "🔑", "title": "Key Insight", "detail": "An important realization"},
        ],
        "concepts": [
            {"name": "Entropy", "definition": "Measure of disorder", "emoji": "🌪️"},
        ],
        "takeaways": ["Understand entropy", "Apply to daily decisions"],
        "timestamps": [{"time": "2:30", "seconds": 150, "label": "Introduction to entropy"}],
    },
    "recipe": {
        "meta": {"prepTime": 15, "cookTime": 30, "totalTime": 45, "servings": 4, "difficulty": "easy"},
        "ingredients": [
            {"name": "Pasta", "amount": "500", "unit": "g"},
            {"name": "Garlic", "amount": "4", "unit": "cloves"},
            {"name": "Olive Oil", "amount": "3", "unit": "tbsp"},
        ],
        "steps": [
            {"number": 1, "instruction": "Boil water and cook pasta"},
            {"number": 2, "instruction": "Saute garlic in olive oil"},
            {"number": 3, "instruction": "Toss pasta with garlic oil"},
        ],
        "tips": [{"text": "Use extra virgin olive oil for best flavor", "type": "technique"}],
        "equipment": ["Large pot", "Frying pan"],
    },
    "code_walkthrough": {
        "languages": ["Python", "TypeScript"],
        "frameworks": ["FastAPI", "React"],
        "concepts": ["REST API", "Component architecture"],
        "setup": {
            "commands": ["pip install fastapi"],
            "dependencies": [{"name": "fastapi"}, {"name": "uvicorn"}],
            "envVars": [{"name": "API_KEY", "description": "API authentication key"}],
        },
        "snippets": [
            {"language": "python", "code": "app = FastAPI()", "explanation": "Create the FastAPI app"},
            {"language": "typescript", "code": "const App = () => <div>Hello</div>", "explanation": "React component"},
        ],
        "takeaways": ["FastAPI is great for APIs", "React for frontend"],
    },
    "study_kit": {
        "keyQuestion": "What is quantum computing?",
        "concepts": [
            {"name": "Qubit", "emoji": "⚛️", "definition": "Quantum bit that can be 0 and 1 simultaneously"},
            {"name": "Superposition", "emoji": "🌊", "definition": "State of being in multiple states at once"},
        ],
        "keyFacts": ["Quantum computers use qubits", "They can solve certain problems exponentially faster"],
        "summary": "Overview of quantum computing fundamentals",
        "timeline": [
            {"title": "Introduction", "description": "Opening remarks on quantum computing"},
            {"title": "Qubit explanation", "description": "How qubits work vs classical bits"},
        ],
    },
    "trip_planner": {
        "destination": "Tokyo, Japan",
        "totalDays": 5,
        "bestSeason": "Spring",
        "days": [
            {"day": 1, "theme": "Arrival & Exploration", "spots": [
                {"name": "Senso-ji Temple", "emoji": "⛩️", "description": "Historic Buddhist temple"},
                {"name": "Akihabara", "emoji": "🎮", "description": "Electronics and anime district"},
            ]},
            {"day": 2, "theme": "Culture Day", "spots": [
                {"name": "Meiji Shrine", "emoji": "🏯", "description": "Shinto shrine in forest"},
            ]},
        ],
        "budget": {"total": 2500, "currency": "USD", "breakdown": [
            {"category": "Accommodation", "amount": 800, "currency": "USD", "notes": "Mid-range hotel"},
            {"category": "Food", "amount": 500, "currency": "USD", "notes": "Mix of restaurants and convenience stores"},
        ]},
        "tips": [{"text": "Get a JR Pass for train travel", "category": "transport"}],
    },
    "workout": {
        "meta": {"type": "HIIT", "difficulty": "intermediate", "duration": 30, "muscleGroups": ["legs", "core", "arms"]},
        "exercises": [
            {"name": "Squats", "emoji": "🏋️", "sets": 3, "reps": "15"},
            {"name": "Push-ups", "emoji": "💪", "sets": 3, "reps": "12"},
            {"name": "Plank", "emoji": "🧘", "duration": "60s"},
        ],
        "warmup": [{"name": "Jumping Jacks", "duration": "2 min"}],
        "cooldown": [{"name": "Stretching", "duration": "5 min"}],
        "tips": [{"text": "Keep your core engaged", "type": "form"}],
    },
    "verdict": {
        "product": "Sony WH-1000XM5",
        "category": "Headphones",
        "price": "$349",
        "rating": {"score": 8.5, "maxScore": 10, "label": "Excellent"},
        "pros": ["Best-in-class ANC", "Comfortable fit", "30-hour battery"],
        "cons": ["No waterproofing", "Not foldable"],
        "verdict": {
            "badge": "recommended",
            "bestFor": ["Commuters", "Frequent flyers"],
            "notFor": ["Athletes", "Budget buyers"],
            "bottomLine": "The best noise-cancelling headphones for most people",
        },
        "alternatives": [{"name": "Bose QC Ultra", "reason": "Better for calls"}],
    },
    "highlights": {
        "speakers": [
            {"name": "Lex Fridman", "emoji": "🎙️", "role": "Host"},
            {"name": "Elon Musk", "emoji": "🚀", "role": "Guest"},
        ],
        "highlights": [
            {"text": "AI will change everything in the next decade", "speaker": "Elon Musk", "emoji": "🤖", "timestamp": 930},
            {"text": "The key is to ask the right questions", "speaker": "Lex Fridman", "emoji": "❓", "timestamp": 1920},
        ],
        "topics": [
            {"name": "Artificial Intelligence", "emoji": "🤖", "summary": "Discussion about AI progress and risks"},
            {"name": "Space Exploration", "emoji": "🚀", "summary": "Mars colonization timeline"},
        ],
    },
    "music_guide": {
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "album": "A Night at the Opera",
        "year": 1975,
        "genre": ["Rock", "Opera", "Ballad"],
        "duration": "5:55",
        "analysis": "A groundbreaking composition that defied conventions with its operatic section",
        "sections": [
            {"name": "Intro/Ballad", "startTime": "0:00", "description": "Piano-driven ballad opening"},
            {"name": "Opera", "startTime": "3:03", "description": "Famous operatic section"},
            {"name": "Hard Rock", "startTime": "4:07", "description": "Guitar-driven rock section"},
        ],
        "techniques": ["Multi-track vocals", "Dynamic shifts"],
    },
    "project_guide": {
        "projectName": "Floating Shelf",
        "difficulty": "beginner",
        "estimatedTime": "2 hours",
        "materials": [
            {"name": "Pine Board", "quantity": "1", "size": "24x8 inches"},
            {"name": "L-brackets", "quantity": "2"},
            {"name": "Wood Screws", "quantity": "8"},
        ],
        "tools": [
            {"name": "Drill", "required": True},
            {"name": "Level", "required": True},
            {"name": "Sandpaper", "required": False},
        ],
        "steps": [
            {"number": 1, "title": "Measure and Mark", "instruction": "Mark the wall at desired height using a level"},
            {"number": 2, "title": "Install Brackets", "instruction": "Drill brackets into wall studs"},
            {"number": 3, "title": "Mount Shelf", "instruction": "Place board on brackets and secure with screws"},
        ],
        "tips": [{"text": "Always find wall studs for secure mounting", "category": "safety"}],
    },
}

_SYNTHESIS_RESPONSE = {
    "tldr": "A comprehensive overview of the topic",
    "keyTakeaways": ["First key point", "Second key point", "Third key point"],
    "masterSummary": "This video covers the subject in depth, exploring multiple angles and providing actionable insights.",
    "seoDescription": "Learn about the topic with this comprehensive video summary",
}

_ENRICHMENT_STUDY = {
    "quiz": [
        {"question": "What is a qubit?", "options": ["A classical bit", "A quantum bit", "A byte", "A register"], "correctIndex": 1, "explanation": "A qubit is the quantum equivalent of a classical bit"},
    ],
    "flashcards": [
        {"front": "What is superposition?", "back": "Being in multiple states simultaneously"},
    ],
}

_ENRICHMENT_CODE = {
    "cheatSheet": [
        {"title": "Create FastAPI App", "code": "app = FastAPI()", "description": "Initialize a FastAPI application"},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_llm():
    """Mock LLM service with configurable responses."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


def _make_video_data(title: str = "Test Video", duration: int = 600):
    return {"title": title, "channel": "Test Channel", "duration": duration}


_TRANSCRIPT = "This is a test transcript with enough words to pass basic validation. " * 50


# ─────────────────────────────────────────────────────────────────────────────
# Integration Tests
# ─────────────────────────────────────────────────────────────────────────────


class TestPipelineIntegration:
    """Full pipeline integration for all 10 output types."""

    @pytest.mark.parametrize("output_type", list(_EXTRACTION_RESPONSES.keys()))
    async def test_detect_extract_validate_for_all_types(self, mock_llm, output_type):
        """Test intent detection + extraction + Pydantic validation for each type."""
        # 1. Intent detection
        mock_llm.call_llm.return_value = json.dumps(_INTENT_RESPONSES[output_type])
        intent = await detect_intent(
            mock_llm, "Test Video", "Description", 600, output_type, _TRANSCRIPT[:2000]
        )
        assert isinstance(intent, IntentResult)
        assert intent.output_type == output_type
        assert len(intent.sections) > 0  # Standard sections always set

        # 2. Extraction
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES[output_type])
        events = []
        async for evt in extract(mock_llm, output_type, _TRANSCRIPT, _make_video_data(), intent):
            events.append(evt)

        # Must have progress events and extraction_complete
        progress_events = [e for e in events if e["event"] == "extraction_progress"]
        assert len(progress_events) >= 2

        complete_event = next(e for e in events if e["event"] == "extraction_complete")
        assert complete_event["outputType"] == output_type

        # Data must be a valid dict
        data = complete_event["data"]
        assert isinstance(data, dict)

        # Must validate against the correct Pydantic model
        model_cls = OUTPUT_TYPE_MODELS[output_type]
        validated = model_cls.model_validate(data)
        assert validated is not None

    @pytest.mark.parametrize("output_type", list(_EXTRACTION_RESPONSES.keys()))
    async def test_synthesis_for_all_types(self, mock_llm, output_type):
        """Test synthesis produces valid SynthesisResult for each type."""
        mock_llm.call_llm.return_value = json.dumps(_SYNTHESIS_RESPONSE)

        extraction_summary = json.dumps(_EXTRACTION_RESPONSES[output_type])[:2000]
        result = await synthesize(
            mock_llm, "Test Video", "Test Channel", 600, output_type, extraction_summary
        )

        assert isinstance(result, SynthesisResult)
        assert result.tldr
        assert len(result.key_takeaways) >= 1
        assert result.master_summary

    async def test_enrichment_study_kit(self, mock_llm):
        """Test enrichment for study_kit produces quiz and flashcards."""
        mock_llm.call_llm.return_value = json.dumps(_ENRICHMENT_STUDY)

        result = await enrich(mock_llm, "study_kit", _EXTRACTION_RESPONSES["study_kit"], "Test Video")

        assert isinstance(result, EnrichmentData)
        assert result.quiz is not None
        assert len(result.quiz) == 1
        assert result.flashcards is not None

    async def test_enrichment_code_walkthrough(self, mock_llm):
        """Test enrichment for code_walkthrough produces cheat sheet."""
        mock_llm.call_llm.return_value = json.dumps(_ENRICHMENT_CODE)

        result = await enrich(mock_llm, "code_walkthrough", _EXTRACTION_RESPONSES["code_walkthrough"], "Test Video")

        assert isinstance(result, EnrichmentData)
        assert result.cheat_sheet is not None
        assert len(result.cheat_sheet) == 1

    @pytest.mark.parametrize("output_type", ["explanation", "recipe", "workout", "verdict", "highlights", "music_guide", "trip_planner", "project_guide"])
    async def test_enrichment_returns_none_for_non_enrichable_types(self, mock_llm, output_type):
        """Test that non-enrichable types return None without calling LLM."""
        result = await enrich(mock_llm, output_type, {}, "Test Video")

        assert result is None
        mock_llm.call_llm.assert_not_called()


class TestPipelineEdgeCases:
    """Edge cases for the pipeline."""

    async def test_intent_low_confidence_falls_back_to_explanation(self, mock_llm):
        """Test that low confidence intent falls back to explanation."""
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "recipe", "confidence": 0.3, "userGoal": "Unsure", "sections": [],
        })

        intent = await detect_intent(mock_llm, "Vague Title", "", 300, None, "Some words")
        assert intent.output_type == "explanation"

    async def test_intent_unknown_type_falls_back_to_category(self, mock_llm):
        """Test that unknown output type falls back to category-based type."""
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "nonexistent_type", "confidence": 0.9, "userGoal": "Test", "sections": [],
        })

        intent = await detect_intent(mock_llm, "Cooking Show", "", 300, "cooking", "Add flour")
        assert intent.output_type == "recipe"

    async def test_intent_empty_json_response(self, mock_llm):
        """Test that empty JSON from LLM produces fallback intent."""
        mock_llm.call_llm.return_value = ""

        intent = await detect_intent(mock_llm, "Video", "", 300, "education", "Learn physics")
        assert intent.output_type == "study_kit"
        assert intent.confidence <= 0.5

    async def test_extraction_with_null_fields_in_workout(self, mock_llm):
        """Test extraction handles LLM returning null for workout fields."""
        response = {
            "meta": {"type": None, "difficulty": None, "duration": None, "muscleGroups": []},
            "exercises": [{"name": "Push-ups", "emoji": "💪"}],
        }
        mock_llm.call_llm.return_value = json.dumps(response)
        intent = IntentResult.model_validate(_INTENT_RESPONSES["workout"])
        intent.sections = [
            OutputSection(id="exercises", label="Exercises", emoji="💪", description="Workout exercises"),
        ]

        events = []
        async for evt in extract(mock_llm, "workout", _TRANSCRIPT, _make_video_data(), intent):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["data"]["meta"]["type"] == "general"
        assert complete["data"]["meta"]["difficulty"] == "intermediate"

    async def test_extraction_with_null_fields_in_verdict(self, mock_llm):
        """Test extraction handles LLM returning null for verdict rating fields."""
        response = {
            "product": "Test Product",
            "rating": {"score": None, "maxScore": None, "label": "N/A"},
            "pros": ["Good"], "cons": ["Bad"],
            "verdict": {"badge": "invalid", "bestFor": [], "notFor": [], "bottomLine": "OK"},
        }
        mock_llm.call_llm.return_value = json.dumps(response)
        intent = IntentResult.model_validate(_INTENT_RESPONSES["verdict"])
        intent.sections = [
            OutputSection(id="verdict", label="Verdict", emoji="🏆", description="Final verdict"),
        ]

        events = []
        async for evt in extract(mock_llm, "verdict", _TRANSCRIPT, _make_video_data(), intent):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["data"]["rating"]["score"] == 0.0
        assert complete["data"]["rating"]["maxScore"] == 10.0
        assert complete["data"]["verdict"]["badge"] == "recommended"

    async def test_synthesis_handles_truncated_extraction(self, mock_llm):
        """Test synthesis works with very large extraction data (gets truncated)."""
        mock_llm.call_llm.return_value = json.dumps(_SYNTHESIS_RESPONSE)
        large_extraction = json.dumps({"data": "x" * 10000})

        result = await synthesize(mock_llm, "Long Video", "Channel", 7200, "explanation", large_extraction)
        assert isinstance(result, SynthesisResult)
        assert result.tldr

    async def test_enrichment_failure_returns_none(self, mock_llm):
        """Test that enrichment gracefully returns None on LLM error."""
        mock_llm.call_llm.side_effect = Exception("LLM timeout")

        result = await enrich(mock_llm, "study_kit", {}, "Test Video")
        assert result is None


class TestTranscriptLengthEdgeCases:
    """Edge cases for very short, very long, and empty transcripts."""

    def _make_intent(self, output_type="explanation"):
        return IntentResult.model_validate(_INTENT_RESPONSES[output_type])

    async def test_very_short_transcript_under_100_words(self, mock_llm):
        """Very short video (<2min) with minimal transcript still extracts."""
        short_transcript = "Hello and welcome. Today I explain entropy briefly. Goodbye."
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES["explanation"])

        events = []
        async for evt in extract(mock_llm, "explanation", short_transcript, _make_video_data(duration=90), self._make_intent()):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["outputType"] == "explanation"
        # Single strategy used (well under 4K threshold)
        assert mock_llm.call_llm.call_count == 1

    async def test_empty_transcript(self, mock_llm):
        """Empty transcript still attempts extraction (LLM sees empty text)."""
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES["explanation"])

        events = []
        async for evt in extract(mock_llm, "explanation", "", _make_video_data(), self._make_intent()):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["outputType"] == "explanation"

    async def test_very_long_transcript_3h_video(self, mock_llm):
        """3-hour video (~30K words) uses overflow (not segmented) since <3h gate requires >180min."""
        long_transcript = " ".join(["word"] * 30000)
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES["explanation"])

        events = []
        # 3h = 10800s, exactly at boundary — uses overflow (not segmented)
        async for evt in extract(mock_llm, "explanation", long_transcript, _make_video_data(duration=10800), self._make_intent()):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["outputType"] == "explanation"
        # Duration exactly 180 min = not > 180, so uses overflow (1 call)
        assert mock_llm.call_llm.call_count == 1

    async def test_intent_detection_with_minimal_preview(self, mock_llm):
        """Intent detection works with very short transcript preview."""
        mock_llm.call_llm.return_value = json.dumps(_INTENT_RESPONSES["recipe"])

        intent = await detect_intent(mock_llm, "Quick Recipe", "Cooking show", 120, "cooking", "Add salt.")
        assert isinstance(intent, IntentResult)
        assert intent.output_type == "recipe"

    async def test_intent_detection_with_no_description(self, mock_llm):
        """Intent detection works with empty description."""
        mock_llm.call_llm.return_value = json.dumps(_INTENT_RESPONSES["explanation"])

        intent = await detect_intent(mock_llm, "Video Title", "", 600, None, _TRANSCRIPT[:2000])
        assert isinstance(intent, IntentResult)

    async def test_synthesis_with_zero_duration(self, mock_llm):
        """Synthesis handles zero/None duration gracefully."""
        mock_llm.call_llm.return_value = json.dumps(_SYNTHESIS_RESPONSE)

        result = await synthesize(mock_llm, "Live Stream", "Channel", 0, "explanation", "Some extraction data")
        assert isinstance(result, SynthesisResult)

    async def test_synthesis_with_none_duration(self, mock_llm):
        """Synthesis handles None duration gracefully."""
        mock_llm.call_llm.return_value = json.dumps(_SYNTHESIS_RESPONSE)

        result = await synthesize(mock_llm, "Live Stream", "Channel", None, "highlights", "Some data")
        assert isinstance(result, SynthesisResult)

    async def test_extraction_boundary_at_single_threshold(self, mock_llm):
        """Transcript exactly at 4000 words uses overflow strategy."""
        transcript = " ".join(["word"] * 4000)
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES["explanation"])

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, _make_video_data(), self._make_intent()):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["outputType"] == "explanation"
        # At exactly 4000 words, uses overflow strategy (>= SINGLE_THRESHOLD)
        # Overflow succeeds on first try = 1 call
        assert mock_llm.call_llm.call_count == 1

    async def test_extraction_boundary_at_overflow_threshold(self, mock_llm):
        """Transcript at 20K words with <3h duration uses overflow (not segmented)."""
        transcript = " ".join(["word"] * 20000)
        mock_llm.call_llm.return_value = json.dumps(_EXTRACTION_RESPONSES["explanation"])

        events = []
        # 90min = 5400s — under 3h gate, so even at 20K words, uses overflow
        async for evt in extract(mock_llm, "explanation", transcript, _make_video_data(duration=5400), self._make_intent()):
            events.append(evt)

        complete = next(e for e in events if e["event"] == "extraction_complete")
        assert complete["outputType"] == "explanation"
        # Under 3h gate — uses overflow (1 call), not segmented
        assert mock_llm.call_llm.call_count == 1
