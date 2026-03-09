"""Pydantic validation tests for all 10 output types — positive and negative cases."""
import pytest
from pydantic import ValidationError

from src.models.output_types import (
    OutputType,
    OUTPUT_TYPE_VALUES,
    OUTPUT_TYPE_MODELS,
    validate_output,
    IntentResult,
    OutputSection,
    SynthesisResult,
    EnrichmentData,
    ExplanationOutput,
    RecipeOutput,
    CodeWalkthroughOutput,
    StudyKitOutput,
    TripPlannerOutput,
    WorkoutOutput,
    VerdictOutput,
    HighlightsOutput,
    MusicGuideOutput,
    ProjectGuideOutput,
)


class TestOutputTypeValues:
    """Test output type constants."""

    def test_has_10_output_types(self):
        assert len(OUTPUT_TYPE_VALUES) == 10

    def test_all_types_have_models(self):
        for ot in OUTPUT_TYPE_VALUES:
            assert ot in OUTPUT_TYPE_MODELS, f"Missing model for {ot}"

    def test_validate_output_raises_for_unknown_type(self):
        with pytest.raises(ValueError, match="Unknown output type"):
            validate_output("nonexistent", {})


class TestIntentResult:
    """Test IntentResult validation."""

    def test_valid_intent(self):
        result = IntentResult.model_validate({
            "outputType": "recipe",
            "confidence": 0.9,
            "userGoal": "Cook a meal",
            "sections": [{"id": "s1", "label": "Ingredients", "emoji": "🥘", "description": "List"}],
        })
        assert result.output_type == "recipe"

    def test_rejects_invalid_output_type(self):
        with pytest.raises(ValidationError):
            IntentResult.model_validate({
                "outputType": "invalid_type",
                "confidence": 0.9,
                "userGoal": "Test",
                "sections": [],
            })

    def test_rejects_confidence_out_of_range(self):
        with pytest.raises(ValidationError):
            IntentResult.model_validate({
                "outputType": "explanation",
                "confidence": 1.5,
                "userGoal": "Test",
                "sections": [],
            })

    def test_rejects_negative_confidence(self):
        with pytest.raises(ValidationError):
            IntentResult.model_validate({
                "outputType": "explanation",
                "confidence": -0.1,
                "userGoal": "Test",
                "sections": [],
            })


class TestSynthesisResult:
    """Test SynthesisResult validation."""

    def test_valid_synthesis(self):
        result = SynthesisResult.model_validate({
            "tldr": "A short summary",
            "keyTakeaways": ["One", "Two"],
            "masterSummary": "Full summary text",
            "seoDescription": "SEO text",
        })
        assert result.tldr == "A short summary"
        assert len(result.key_takeaways) == 2

    def test_rejects_missing_tldr(self):
        with pytest.raises(ValidationError):
            SynthesisResult.model_validate({
                "keyTakeaways": ["One"],
                "masterSummary": "Summary",
                "seoDescription": "SEO",
            })


class TestExplanationOutput:
    """Test explanation output validation."""

    def test_valid_output(self):
        result = validate_output("explanation", {
            "keyPoints": [
                {"emoji": "💡", "title": "Point 1", "detail": "Detail"},
            ],
            "concepts": [
                {"name": "Concept", "definition": "Definition", "emoji": "📚"},
            ],
            "takeaways": ["Takeaway 1"],
        })
        assert isinstance(result, ExplanationOutput)

    def test_rejects_missing_key_points(self):
        with pytest.raises(ValidationError):
            validate_output("explanation", {
                "concepts": [],
                "takeaways": [],
            })

    def test_timestamps_optional(self):
        result = validate_output("explanation", {
            "keyPoints": [{"emoji": "💡", "title": "P", "detail": "D"}],
            "concepts": [],
            "takeaways": [],
        })
        assert result.timestamps == []


class TestRecipeOutput:
    """Test recipe output validation."""

    def test_valid_recipe(self):
        result = validate_output("recipe", {
            "meta": {"prepTime": 10, "cookTime": 20, "totalTime": 30, "servings": 4},
            "ingredients": [{"name": "Salt", "amount": "1", "unit": "tsp"}],
            "steps": [{"number": 1, "instruction": "Add salt"}],
        })
        assert isinstance(result, RecipeOutput)
        assert len(result.ingredients) == 1

    def test_rejects_missing_ingredients(self):
        with pytest.raises(ValidationError):
            validate_output("recipe", {
                "meta": {},
                "steps": [{"number": 1, "instruction": "Cook"}],
            })

    def test_difficulty_enum_validation(self):
        result = validate_output("recipe", {
            "meta": {"difficulty": "easy"},
            "ingredients": [{"name": "Flour"}],
            "steps": [{"number": 1, "instruction": "Mix"}],
        })
        assert result.meta.difficulty == "easy"

    def test_rejects_invalid_difficulty(self):
        with pytest.raises(ValidationError):
            validate_output("recipe", {
                "meta": {"difficulty": "impossible"},
                "ingredients": [{"name": "Flour"}],
                "steps": [{"number": 1, "instruction": "Mix"}],
            })


class TestCodeWalkthroughOutput:
    """Test code walkthrough output validation."""

    def test_valid_code_walkthrough(self):
        result = validate_output("code_walkthrough", {
            "languages": ["Python"],
            "frameworks": ["FastAPI"],
            "concepts": ["REST API"],
            "setup": {"commands": ["pip install fastapi"], "dependencies": [], "envVars": []},
            "snippets": [
                {"language": "python", "code": "print('hi')", "explanation": "Prints hello"},
            ],
        })
        assert isinstance(result, CodeWalkthroughOutput)

    def test_rejects_missing_setup(self):
        with pytest.raises(ValidationError):
            validate_output("code_walkthrough", {
                "languages": [],
                "snippets": [],
            })


class TestStudyKitOutput:
    """Test study kit output validation."""

    def test_valid_study_kit(self):
        result = validate_output("study_kit", {
            "keyQuestion": "What is physics?",
            "concepts": [
                {"name": "Gravity", "emoji": "🌍", "definition": "Force of attraction"},
            ],
            "keyFacts": ["Fact 1"],
            "summary": "Physics overview",
        })
        assert isinstance(result, StudyKitOutput)

    def test_rejects_missing_key_question(self):
        with pytest.raises(ValidationError):
            validate_output("study_kit", {
                "concepts": [],
                "keyFacts": [],
                "summary": "Test",
            })


class TestTripPlannerOutput:
    """Test trip planner output validation."""

    def test_valid_trip(self):
        result = validate_output("trip_planner", {
            "destination": "Tokyo",
            "totalDays": 5,
            "days": [
                {"day": 1, "spots": [{"name": "Senso-ji", "emoji": "⛩️", "description": "Temple"}]},
            ],
            "budget": {"total": 2000, "currency": "USD"},
        })
        assert isinstance(result, TripPlannerOutput)
        assert result.destination == "Tokyo"

    def test_rejects_missing_destination(self):
        with pytest.raises(ValidationError):
            validate_output("trip_planner", {
                "totalDays": 3,
                "days": [],
                "budget": {"total": 1000, "currency": "USD"},
            })

    def test_coerces_null_budget_and_days(self):
        """LLMs sometimes return null for totalDays, budget.total, budget.currency."""
        result = validate_output("trip_planner", {
            "destination": "Tokyo",
            "totalDays": None,
            "days": [],
            "budget": {"total": None, "currency": None},
        })
        assert result.total_days == 1
        assert result.budget.total == 0.0
        assert result.budget.currency == "USD"


class TestWorkoutOutput:
    """Test workout output validation."""

    def test_valid_workout(self):
        result = validate_output("workout", {
            "meta": {
                "type": "HIIT",
                "difficulty": "intermediate",
                "duration": 30,
                "muscleGroups": ["legs", "core"],
            },
            "exercises": [
                {"name": "Squats", "emoji": "🏋️", "sets": 3, "reps": "12"},
            ],
        })
        assert isinstance(result, WorkoutOutput)

    def test_coerces_invalid_difficulty_to_default(self):
        """LLMs sometimes return invalid difficulty values — should default to intermediate."""
        result = validate_output("workout", {
            "meta": {
                "type": "Cardio",
                "difficulty": "extreme",
                "duration": 30,
                "muscleGroups": [],
            },
            "exercises": [{
                "name": "Running",
                "emoji": "🏃",
            }],
        })
        assert result.meta.difficulty == "intermediate"

    def test_handles_null_meta_fields(self):
        """LLMs sometimes return null for required meta fields — should use defaults."""
        result = validate_output("workout", {
            "meta": {
                "type": None,
                "difficulty": None,
                "duration": None,
                "muscleGroups": [],
            },
            "exercises": [
                {"name": "Push-ups", "emoji": "💪"},
            ],
        })
        assert isinstance(result, WorkoutOutput)
        assert result.meta.type == "general"
        assert result.meta.difficulty == "intermediate"
        assert result.meta.duration == 0

    def test_handles_missing_meta_fields(self):
        """LLMs sometimes omit required meta fields — should use defaults."""
        result = validate_output("workout", {
            "meta": {},
            "exercises": [
                {"name": "Squats", "emoji": "🏋️"},
            ],
        })
        assert isinstance(result, WorkoutOutput)
        assert result.meta.type == "general"


class TestVerdictOutput:
    """Test verdict output validation."""

    def test_valid_verdict(self):
        result = validate_output("verdict", {
            "product": "iPhone 15",
            "price": "$999",
            "rating": {"score": 8.5, "maxScore": 10, "label": "Great"},
            "pros": ["Good camera", "Fast"],
            "cons": ["Expensive"],
            "verdict": {
                "badge": "recommended",
                "bestFor": ["Photography"],
                "notFor": ["Budget buyers"],
                "bottomLine": "Great phone for most people",
            },
        })
        assert isinstance(result, VerdictOutput)
        assert result.product == "iPhone 15"

    def test_coerces_invalid_badge_to_recommended(self):
        result = validate_output("verdict", {
            "product": "Test",
            "rating": {"score": 5, "maxScore": 10, "label": "OK"},
            "pros": [],
            "cons": [],
            "verdict": {
                "badge": "invalid_badge",
                "bestFor": [],
                "notFor": [],
                "bottomLine": "Test",
            },
        })
        assert result.verdict.badge == "recommended"

    def test_coerces_null_rating_scores(self):
        result = validate_output("verdict", {
            "product": "Test",
            "rating": {"score": None, "maxScore": None, "label": "N/A"},
            "pros": [],
            "cons": [],
            "verdict": {
                "badge": "recommended",
                "bestFor": [],
                "notFor": [],
                "bottomLine": "Test",
            },
        })
        assert result.rating.score == 0.0
        assert result.rating.max_score == 10.0


class TestHighlightsOutput:
    """Test highlights output validation."""

    def test_valid_highlights(self):
        result = validate_output("highlights", {
            "speakers": [{"name": "Host", "emoji": "🎙️"}],
            "highlights": [
                {"text": "Great quote", "speaker": "Host", "emoji": "💬"},
            ],
            "topics": [
                {"name": "AI", "emoji": "🤖", "summary": "Discussion about AI"},
            ],
        })
        assert isinstance(result, HighlightsOutput)

    def test_rejects_missing_speakers(self):
        with pytest.raises(ValidationError):
            validate_output("highlights", {
                "highlights": [],
                "topics": [],
            })


class TestMusicGuideOutput:
    """Test music guide output validation."""

    def test_valid_music_guide(self):
        result = validate_output("music_guide", {
            "title": "Bohemian Rhapsody",
            "artist": "Queen",
            "genre": ["Rock", "Opera"],
            "analysis": "A groundbreaking composition",
        })
        assert isinstance(result, MusicGuideOutput)

    def test_rejects_missing_title(self):
        with pytest.raises(ValidationError):
            validate_output("music_guide", {
                "artist": "Queen",
                "analysis": "Great song",
            })


class TestProjectGuideOutput:
    """Test project guide output validation."""

    def test_valid_project_guide(self):
        result = validate_output("project_guide", {
            "projectName": "Build a Bookshelf",
            "difficulty": "intermediate",
            "estimatedTime": "4 hours",
            "materials": [{"name": "Wood planks", "quantity": "6"}],
            "tools": [{"name": "Drill", "required": True}],
            "steps": [{"number": 1, "title": "Cut wood", "instruction": "Cut to size"}],
        })
        assert isinstance(result, ProjectGuideOutput)

    def test_coerces_invalid_difficulty_to_default(self):
        """LLMs sometimes return invalid difficulty values — should default to intermediate."""
        result = validate_output("project_guide", {
            "projectName": "Test",
            "difficulty": "impossible",
            "estimatedTime": "1 hour",
            "steps": [{"number": 1, "title": "Step 1", "instruction": "Do it"}],
        })
        assert result.difficulty == "intermediate"

    def test_handles_null_fields(self):
        """LLMs sometimes return null for required fields — should use defaults."""
        result = validate_output("project_guide", {
            "projectName": None,
            "difficulty": None,
            "estimatedTime": None,
            "steps": [{"number": 1, "title": "Step 1", "instruction": "Do it"}],
        })
        assert isinstance(result, ProjectGuideOutput)
        assert result.difficulty == "intermediate"
        assert result.estimated_time == "unknown"


class TestEnrichmentData:
    """Test enrichment data validation."""

    def test_valid_quiz_enrichment(self):
        data = EnrichmentData.model_validate({
            "quiz": [
                {
                    "question": "What is 2+2?",
                    "options": ["3", "4", "5", "6"],
                    "correctIndex": 1,
                    "explanation": "Basic math",
                }
            ],
        })
        assert len(data.quiz) == 1

    def test_valid_flashcards_enrichment(self):
        data = EnrichmentData.model_validate({
            "flashcards": [
                {"front": "Capital of France", "back": "Paris"},
            ],
        })
        assert len(data.flashcards) == 1

    def test_valid_cheat_sheet_enrichment(self):
        data = EnrichmentData.model_validate({
            "cheatSheet": [
                {"title": "Loop", "code": "for i in range(10): ...", "description": "Basic loop"},
            ],
        })
        assert len(data.cheat_sheet) == 1

    def test_all_fields_optional(self):
        data = EnrichmentData.model_validate({})
        assert data.quiz is None
        assert data.flashcards is None
        assert data.cheat_sheet is None
