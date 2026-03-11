"""Tests for domain_types Pydantic models."""

import pytest
from pydantic import ValidationError

from src.models.domain_types import (
    TravelData,
    TravelDay,
    TravelBudget,
    TravelSpot,
    TravelPackingItem,
    FoodData,
    FoodMeta,
    FoodIngredient,
    FoodStep,
    FoodTip,
    LearningData,
    LearningKeyPoint,
    LearningConcept,
    LearningTimestamp,
    ReviewData,
    ReviewRating,
    ReviewVerdict,
    ReviewComparison,
    TechData,
    TechSetup,
    TechSnippet,
    TechPattern,
    FitnessData,
    FitnessMeta,
    FitnessExercise,
    FitnessTimer,
    MusicData,
    MusicCredit,
    MusicSection,
    ProjectData,
    ProjectStep,
    ProjectMaterial,
    NarrativeData,
    NarrativeKeyMoment,
    NarrativeQuote,
    FinanceData,
    FinanceCost,
    TabDefinition,
    SectionDefinition,
    VIEResponseMeta,
    VIEResponse,
    DOMAIN_MODELS,
    MODIFIER_MODELS,
    VALID_CONTENT_TAGS,
    VALID_MODIFIERS,
)


class TestTravelData:
    """Test TravelData model."""

    def test_valid_travel_data(self):
        data = TravelData(
            itinerary=[TravelDay(day=1, city="Tokyo", spots=[
                TravelSpot(name="Shibuya Crossing", emoji="🏙️", description="Famous crossing")
            ])],
            budget=TravelBudget(total=1500, currency="USD"),
            packingList=[TravelPackingItem(item="Adapter", category="Electronics", essential=True)],
        )
        assert data.itinerary[0].city == "Tokyo"
        assert data.budget.total == 1500

    def test_empty_travel_data(self):
        data = TravelData()
        assert data.itinerary == []
        assert data.budget.total == 0

    def test_budget_coercion(self):
        budget = TravelBudget(total=None, currency=None)
        assert budget.total == 0.0
        assert budget.currency == "USD"

    def test_day_coercion(self):
        day = TravelDay(day=None)
        assert day.day == 1

    def test_alias_support(self):
        data = TravelData.model_validate({
            "packingList": [{"item": "Shoes", "category": "Clothing", "essential": False}],
            "bestSeason": "Spring",
            "accommodationTips": "Stay in Shinjuku",
            "transportationTips": "Get a JR pass",
        })
        assert data.packing_list[0].item == "Shoes"
        assert data.best_season == "Spring"


class TestFoodData:
    """Test FoodData model."""

    def test_valid_food_data(self):
        data = FoodData(
            meta=FoodMeta(prepTime=20, cookTime=30, difficulty="medium"),
            ingredients=[FoodIngredient(name="flour", amount="2", unit="cups")],
            steps=[FoodStep(number=1, instruction="Mix ingredients")],
        )
        assert data.meta.prep_time == 20
        assert len(data.ingredients) == 1

    def test_empty_food_data(self):
        data = FoodData()
        assert data.ingredients == []
        assert data.steps == []

    def test_food_tip_type_coercion(self):
        tip = FoodTip(type="invalid_type", text="Test tip")
        assert tip.type == "chef_tip"

    def test_food_meta_difficulty_coercion(self):
        meta = FoodMeta(difficulty="expert")
        assert meta.difficulty is None

    def test_valid_difficulty_values(self):
        for d in ("easy", "medium", "hard"):
            meta = FoodMeta(difficulty=d)
            assert meta.difficulty == d


class TestLearningData:
    """Test LearningData model."""

    def test_valid_learning_data(self):
        data = LearningData.model_validate({
            "keyPoints": [{"emoji": "💡", "title": "Point 1", "detail": "Detail"}],
            "concepts": [{"name": "Concept 1", "emoji": "📚", "definition": "A concept"}],
            "takeaways": ["Do this"],
            "timestamps": [{"time": "0:00", "seconds": 0, "label": "Start"}],
            "keyQuestion": "What is this about?",
            "summary": "A summary",
        })
        assert len(data.key_points) == 1
        assert data.key_question == "What is this about?"

    def test_empty_learning_data(self):
        data = LearningData()
        assert data.key_points == []
        assert data.key_question == ""

    def test_timestamp_seconds_coercion(self):
        ts = LearningTimestamp(time="0:00", seconds=None, label="Start")
        assert ts.seconds == 0

    def test_concept_with_connections(self):
        concept = LearningConcept(
            name="OOP",
            definition="Object-oriented programming",
            connections=["Classes", "Inheritance"],
        )
        assert len(concept.connections) == 2


class TestReviewData:
    """Test ReviewData model."""

    def test_valid_review_data(self):
        data = ReviewData(
            product="iPhone 15 Pro",
            price="$999",
            rating=ReviewRating(score=8.5, maxScore=10, label="Great"),
            pros=["Great camera"],
            cons=["No USB-C port"],
            verdict=ReviewVerdict(
                badge="recommended",
                bestFor=["Photography"],
                notFor=["Budget buyers"],
                bottomLine="Great phone",
            ),
        )
        assert data.product == "iPhone 15 Pro"
        assert data.rating.score == 8.5

    def test_rating_coercion(self):
        rating = ReviewRating(score=None, maxScore=None, label="")
        assert rating.score == 0.0
        assert rating.max_score == 10.0

    def test_verdict_badge_coercion(self):
        verdict = ReviewVerdict(badge="unknown_badge", bottomLine="Test")
        assert verdict.badge == "recommended"

    def test_comparison_alias(self):
        comp = ReviewComparison.model_validate({
            "feature": "Battery",
            "thisProduct": "5000mAh",
            "competitor": "4500mAh",
            "competitorName": "Pixel 8",
        })
        assert comp.this_product == "5000mAh"
        assert comp.competitor_name == "Pixel 8"


class TestTechData:
    """Test TechData model."""

    def test_valid_tech_data(self):
        data = TechData.model_validate({
            "languages": ["Python", "TypeScript"],
            "frameworks": ["FastAPI"],
            "concepts": ["REST API"],
            "setup": {
                "commands": ["pip install fastapi"],
                "dependencies": [{"name": "fastapi", "version": "0.100.0"}],
                "envVars": [{"name": "API_KEY", "description": "Your API key"}],
            },
            "snippets": [{"language": "python", "code": "print('hi')", "explanation": "Hello"}],
            "patterns": [{"title": "DI", "doExample": "good", "dontExample": "bad", "explanation": "Why"}],
            "cheatSheet": [{"title": "Quick start", "code": "uvicorn main:app", "description": "Run server"}],
        })
        assert len(data.languages) == 2
        assert data.setup.commands[0] == "pip install fastapi"

    def test_empty_tech_data(self):
        data = TechData()
        assert data.languages == []
        assert data.snippets == []

    def test_pattern_alias(self):
        pattern = TechPattern.model_validate({
            "title": "Test",
            "doExample": "good code",
            "dontExample": "bad code",
            "explanation": "Because",
        })
        assert pattern.do_example == "good code"


class TestFitnessData:
    """Test FitnessData model."""

    def test_valid_fitness_data(self):
        data = FitnessData(
            meta=FitnessMeta(type="HIIT", difficulty="advanced", duration=30, muscleGroups=["legs"]),
            exercises=[FitnessExercise(name="Squats", sets=3, reps="10")],
        )
        assert data.meta.type == "HIIT"
        assert len(data.exercises) == 1

    def test_meta_coercion(self):
        meta = FitnessMeta(type=None, difficulty="expert", duration=None)
        assert meta.type == "general"
        assert meta.difficulty == "intermediate"
        assert meta.duration == 0

    def test_exercise_difficulty_coercion(self):
        exercise = FitnessExercise(name="Push-ups", difficulty="extreme")
        assert exercise.difficulty is None

    def test_timer_rounds_coercion(self):
        timer = FitnessTimer(rounds=None)
        assert timer.rounds == 1


class TestMusicData:
    """Test MusicData model."""

    def test_valid_music_data(self):
        data = MusicData(
            title="Bohemian Rhapsody",
            artist="Queen",
            genre=["Rock", "Opera"],
            credits=[MusicCredit(role="Vocals", name="Freddie Mercury")],
            analysis=[{"aspect": "Production", "emoji": "🎛️", "detail": "Groundbreaking multi-track"}],
            structure=[MusicSection(name="Intro", description="Piano opening")],
        )
        assert data.title == "Bohemian Rhapsody"
        assert len(data.credits) == 1
        assert data.analysis[0].aspect == "Production"

    def test_legacy_string_analysis_coercion(self):
        """Legacy string analysis is coerced to a list with a single 'Overview' item."""
        data = MusicData(analysis="A groundbreaking piece")
        assert len(data.analysis) == 1
        assert data.analysis[0].aspect == "Overview"
        assert data.analysis[0].detail == "A groundbreaking piece"

    def test_empty_music_data(self):
        data = MusicData()
        assert data.title == ""
        assert data.genre == []
        assert data.analysis == []


class TestProjectData:
    """Test ProjectData model."""

    def test_valid_project_data(self):
        data = ProjectData.model_validate({
            "projectName": "Bookshelf",
            "difficulty": "beginner",
            "estimatedTime": "4 hours",
            "estimatedCost": "$50",
            "materials": [{"name": "Pine board", "quantity": "2", "cost": "$15"}],
            "tools": [{"name": "Drill", "required": True}],
            "steps": [{"number": 1, "title": "Cut wood", "instruction": "Cut to size", "safetyNote": "Wear goggles"}],
            "safetyWarnings": ["Wear safety glasses"],
        })
        assert data.project_name == "Bookshelf"
        assert data.steps[0].safety_note == "Wear goggles"

    def test_coercion_defaults(self):
        data = ProjectData.model_validate({
            "projectName": None,
            "difficulty": "expert",
            "estimatedTime": None,
        })
        assert data.project_name == "Untitled Project"
        assert data.difficulty == "intermediate"
        assert data.estimated_time == "unknown"


class TestNarrativeData:
    """Test NarrativeData modifier model."""

    def test_valid_narrative_data(self):
        data = NarrativeData.model_validate({
            "keyMoments": [{"description": "The big reveal", "mood": "triumphant", "emoji": "🎉"}],
            "quotes": [{"text": "To be or not to be", "speaker": "Hamlet"}],
            "takeaways": ["Life is short"],
        })
        assert len(data.key_moments) == 1
        assert data.quotes[0].text == "To be or not to be"

    def test_empty_narrative_data(self):
        data = NarrativeData()
        assert data.key_moments == []
        assert data.quotes == []


class TestFinanceData:
    """Test FinanceData modifier model."""

    def test_valid_finance_data(self):
        data = FinanceData.model_validate({
            "costs": [{"item": "Flight", "amount": 500, "currency": "EUR"}],
            "savingTips": ["Book early for cheaper flights"],
        })
        assert len(data.costs) == 1
        assert data.costs[0].amount == 500

    def test_cost_amount_coercion(self):
        cost = FinanceCost(item="Test", amount=None)
        assert cost.amount == 0.0

    def test_finance_ignores_budget_field(self):
        """Finance modifier no longer has a budget field — primary domain owns budget."""
        data = FinanceData.model_validate({
            "costs": [],
            "savingTips": [],
        })
        assert not hasattr(data, "budget")


class TestVIEResponse:
    """Test VIEResponse envelope model."""

    def test_full_response(self):
        response = VIEResponse(
            meta=VIEResponseMeta(
                videoId="abc123",
                videoTitle="Test Video",
                contentTags=["travel", "food"],
                primaryTag="travel",
                userGoal="Plan a trip",
            ),
            tabs=[TabDefinition(id="itinerary", label="Itinerary", dataSource="travel.itinerary")],
            sections=[SectionDefinition(type="day", items=[{"label": "Day 1"}])],
            travel=TravelData(itinerary=[TravelDay(day=1, city="Tokyo")]),
        )
        assert response.meta.video_id == "abc123"
        assert response.travel is not None
        assert response.food is None

    def test_minimal_response(self):
        response = VIEResponse(
            meta=VIEResponseMeta(
                contentTags=["learning"],
                primaryTag="learning",
            ),
        )
        assert response.meta.primary_tag == "learning"
        assert response.travel is None
        assert response.learning is None
        assert response.quizzes is None

    def test_with_modifiers(self):
        response = VIEResponse(
            meta=VIEResponseMeta(
                contentTags=["travel"],
                modifiers=["finance"],
                primaryTag="travel",
            ),
            narrative=NarrativeData(takeaways=["Story lesson"]),
            finance=FinanceData(costs=[FinanceCost(item="Flight", amount=1000, currency="EUR")]),
        )
        assert response.finance.costs[0].amount == 1000
        assert response.narrative.takeaways == ["Story lesson"]

    def test_with_enrichment(self):
        response = VIEResponse(
            meta=VIEResponseMeta(
                contentTags=["learning"],
                primaryTag="learning",
            ),
            quizzes=[{"question": "What?", "options": ["A", "B"]}],
            flashcards=[{"front": "Q", "back": "A"}],
            scenarios=[{"scenario": "Real world"}],
        )
        assert len(response.quizzes) == 1
        assert len(response.flashcards) == 1
        assert len(response.scenarios) == 1

    def test_tab_definition_alias(self):
        tab = TabDefinition.model_validate({
            "id": "test",
            "label": "Test",
            "dataSource": "learning.keyPoints",
        })
        assert tab.data_source == "learning.keyPoints"

    def test_meta_alias(self):
        meta = VIEResponseMeta.model_validate({
            "videoId": "abc",
            "videoTitle": "Test",
            "contentTags": ["learning"],
            "primaryTag": "learning",
            "userGoal": "Learn",
        })
        assert meta.video_id == "abc"
        assert meta.content_tags == ["learning"]


class TestModelRegistries:
    """Test model registry completeness."""

    def test_all_eight_domains_registered(self):
        expected = {"travel", "food", "learning", "review", "tech", "fitness", "music", "project"}
        assert set(DOMAIN_MODELS.keys()) == expected

    def test_all_modifiers_registered(self):
        assert set(MODIFIER_MODELS.keys()) == {"narrative", "finance"}

    def test_valid_content_tags_match_domains(self):
        assert VALID_CONTENT_TAGS == frozenset(DOMAIN_MODELS.keys())

    def test_valid_modifiers_match_modifier_models(self):
        assert VALID_MODIFIERS == frozenset(MODIFIER_MODELS.keys())
