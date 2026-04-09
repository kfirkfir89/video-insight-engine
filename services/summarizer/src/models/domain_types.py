"""Pydantic v2 models for v3 domain data, modifiers, and VIEResponse."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from ..shared_config.domain_config import valid_content_tags, valid_modifiers

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────
# Travel Domain
# ─────────────────────────────────────────────────────

class TravelSpot(BaseModel):
    name: str
    emoji: str = ""
    description: str = ""
    cost: str | None = None
    duration: str | None = None
    map_query: str | None = Field(None, alias="mapQuery")
    tips: str | None = None

    model_config = {"populate_by_name": True}


class TravelDay(BaseModel):
    day: int
    city: str | None = None
    theme: str | None = None
    spots: list[TravelSpot] = []
    tips: list[str] = []

    @field_validator("day", mode="before")
    @classmethod
    def coerce_day(cls, v: Any) -> int:
        if v is None:
            return 1
        return int(v)


class TravelBudgetItem(BaseModel):
    category: str
    amount: float = 0
    currency: str = "USD"
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> float:
        if v is None:
            return 0.0
        return float(v)


class TravelBudget(BaseModel):
    total: float = 0
    currency: str = "USD"
    breakdown: list[TravelBudgetItem] = []

    @field_validator("total", mode="before")
    @classmethod
    def coerce_total(cls, v: Any) -> float:
        if v is None:
            return 0.0
        return float(v)

    @field_validator("currency", mode="before")
    @classmethod
    def coerce_currency(cls, v: Any) -> str:
        if not v:
            return "USD"
        return str(v)


class TravelPackingItem(BaseModel):
    item: str
    category: str = "Essentials"
    essential: bool = False


class TravelTip(BaseModel):
    text: str
    type: str = "tip"

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: Any) -> str:
        valid = ("tip", "warning", "info")
        return v if v in valid else "tip"


class TravelData(BaseModel):
    model_config = {"populate_by_name": True}

    itinerary: list[TravelDay] = []
    budget: TravelBudget = Field(default_factory=TravelBudget)
    packing_list: list[TravelPackingItem] = Field([], alias="packingList")
    accommodation_tips: list[TravelTip] = Field([], alias="accommodationTips")
    transportation_tips: list[TravelTip] = Field([], alias="transportationTips")
    best_season: str | None = Field(None, alias="bestSeason")

    @field_validator("accommodation_tips", "transportation_tips", mode="before")
    @classmethod
    def coerce_tips_to_list(cls, v: Any) -> list:
        """Accept legacy string format and convert to list."""
        if isinstance(v, str):
            return [{"text": v, "type": "tip"}] if v.strip() else []
        if v is None:
            return []
        return v


# ─────────────────────────────────────────────────────
# Food Domain
# ─────────────────────────────────────────────────────

class FoodMeta(BaseModel):
    model_config = {"populate_by_name": True}

    prep_time: int | None = Field(None, alias="prepTime")
    cook_time: int | None = Field(None, alias="cookTime")
    servings: int | None = None
    difficulty: str | None = None
    cuisine: str | None = None

    @field_validator("prep_time", "cook_time", mode="before")
    @classmethod
    def coerce_time_minutes(cls, v: Any) -> int | None:
        """Extract first integer from strings like '~12-15 minutes'."""
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, (float,)):
            return int(v)
        if isinstance(v, str):
            import re
            match = re.search(r"\d+", v)
            return int(match.group()) if match else None
        return None

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: Any) -> str | None:
        if v in ("easy", "medium", "hard"):
            return v
        return None


class FoodIngredient(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    amount: float = 0.0
    display_amount: str = Field("", alias="displayAmount")
    unit: str | None = None
    group: str | None = None
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> float:
        if v is None:
            return 0.0
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                return 0.0
        return float(v)


class FoodStep(BaseModel):
    number: int
    instruction: str
    duration: int | None = None
    tips: str | None = None
    timestamp: int | None = None

    @field_validator("duration", mode="before")
    @classmethod
    def coerce_duration(cls, v: Any) -> int | None:
        """Extract first integer from strings like '5-10 minutes'."""
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, (float,)):
            return int(v)
        if isinstance(v, str):
            import re
            match = re.search(r"\d+", v)
            return int(match.group()) if match else None
        return None


class FoodTip(BaseModel):
    type: str = "chef_tip"
    text: str

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: Any) -> str:
        valid = ("chef_tip", "warning", "substitution", "storage")
        return v if v in valid else "chef_tip"


class FoodSubstitution(BaseModel):
    original: str
    substitute: str
    notes: str | None = None


class FoodNutrition(BaseModel):
    nutrient: str
    amount: str
    unit: str | None = None


class FoodData(BaseModel):
    meta: FoodMeta = Field(default_factory=FoodMeta)
    ingredients: list[FoodIngredient] = []
    steps: list[FoodStep] = []
    tips: list[FoodTip] = []
    equipment: list[str] = []
    substitutions: list[FoodSubstitution] = []
    nutrition: list[FoodNutrition] = []


# ─────────────────────────────────────────────────────
# Learning Domain
# ─────────────────────────────────────────────────────

class LearningKeyPoint(BaseModel):
    emoji: str = ""
    title: str
    detail: str = ""
    timestamp: int | None = None


class LearningConcept(BaseModel):
    name: str
    emoji: str = ""
    definition: str = ""
    example: str | None = None
    analogy: str | None = None
    connections: list[str] = []


class LearningTimestamp(BaseModel):
    time: str = ""
    seconds: int = 0
    label: str = ""

    @field_validator("seconds", mode="before")
    @classmethod
    def coerce_seconds(cls, v: Any) -> int:
        if v is None:
            return 0
        return int(v)


class LearningData(BaseModel):
    model_config = {"populate_by_name": True}

    key_points: list[LearningKeyPoint] = Field([], alias="keyPoints")
    concepts: list[LearningConcept] = []
    takeaways: list[str] = []
    timestamps: list[LearningTimestamp] = []
    key_question: str = Field("", alias="keyQuestion")
    summary: str = ""


# ─────────────────────────────────────────────────────
# Review Domain
# ─────────────────────────────────────────────────────

class ReviewRating(BaseModel):
    model_config = {"populate_by_name": True}

    score: float = 0.0
    max_score: float = Field(10.0, alias="maxScore")
    label: str = ""

    @field_validator("score", mode="before")
    @classmethod
    def coerce_score(cls, v: Any) -> float:
        if v is None:
            return 0.0
        return float(v)

    @field_validator("max_score", mode="before")
    @classmethod
    def coerce_max_score(cls, v: Any) -> float:
        if v is None:
            return 10.0
        return float(v)


class ReviewSpec(BaseModel):
    key: str
    value: str


class ReviewComparison(BaseModel):
    model_config = {"populate_by_name": True}

    feature: str
    this_product: str = Field(alias="thisProduct")
    competitor: str
    competitor_name: str = Field(alias="competitorName")
    winner: str | None = None

    @field_validator("winner", mode="before")
    @classmethod
    def coerce_winner(cls, v: Any) -> str | None:
        valid = ("left", "right", "tie")
        return v if v in valid else None


class ReviewVerdict(BaseModel):
    model_config = {"populate_by_name": True}

    badge: str = "recommended"
    best_for: list[str] = Field([], alias="bestFor")
    not_for: list[str] = Field([], alias="notFor")
    bottom_line: str = Field("", alias="bottomLine")
    sub_scores: list[dict] | None = Field(None, alias="subScores")

    @field_validator("badge", mode="before")
    @classmethod
    def coerce_badge(cls, v: Any) -> str:
        valid = ("recommended", "not_recommended", "conditional", "best_in_class")
        return v if v in valid else "recommended"


class ReviewData(BaseModel):
    product: str = ""
    price: str | None = None
    rating: ReviewRating = Field(default_factory=ReviewRating)
    pros: list[str] = []
    cons: list[str] = []
    specs: list[ReviewSpec] = []
    comparisons: list[ReviewComparison] = []
    verdict: ReviewVerdict = Field(default_factory=ReviewVerdict)


# ─────────────────────────────────────────────────────
# Tech Domain
# ─────────────────────────────────────────────────────

class TechDependency(BaseModel):
    name: str
    version: str | None = None


class TechEnvVar(BaseModel):
    name: str
    description: str = ""
    example: str | None = None


class TechSetup(BaseModel):
    model_config = {"populate_by_name": True}

    commands: list[str] = []
    dependencies: list[TechDependency] = []
    env_vars: list[TechEnvVar] = Field([], alias="envVars")


class TechSnippet(BaseModel):
    filename: str | None = None
    language: str = ""
    code: str = ""
    explanation: str = ""
    timestamp: int | None = None


class TechPattern(BaseModel):
    model_config = {"populate_by_name": True}

    title: str
    do_example: str = Field("", alias="doExample")
    dont_example: str = Field("", alias="dontExample")
    explanation: str = ""


class TechCheatSheetItem(BaseModel):
    title: str
    code: str = ""
    description: str = ""


class TechData(BaseModel):
    model_config = {"populate_by_name": True}

    languages: list[str] = []
    frameworks: list[str] = []
    topics: list[str] = []
    setup: TechSetup = Field(default_factory=TechSetup)
    snippets: list[TechSnippet] = []
    patterns: list[TechPattern] = []
    cheat_sheet: list[TechCheatSheetItem] = Field([], alias="cheatSheet")

    @model_validator(mode="before")
    @classmethod
    def migrate_concepts_to_topics(cls, data: Any) -> Any:
        """Backward compat: rename cached 'concepts' (string[]) to 'topics'."""
        if isinstance(data, dict) and "concepts" in data and "topics" not in data:
            if isinstance(data.get("concepts"), list) and all(isinstance(c, str) for c in data["concepts"]):
                data["topics"] = data.pop("concepts")
        return data

    @field_validator("languages", "frameworks", "topics", mode="before")
    @classmethod
    def _coerce_string_lists(cls, v: Any) -> list[str]:
        """Coerce list items to strings — LLM sometimes returns objects like {name: '...'}."""
        if not isinstance(v, list):
            return v
        result = []
        for item in v:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                result.append(item.get("name") or item.get("label") or str(item))
            else:
                result.append(str(item))
        return result


# ─────────────────────────────────────────────────────
# Fitness Domain
# ─────────────────────────────────────────────────────

class FitnessModification(BaseModel):
    label: str
    description: str = ""


class FitnessExercise(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    emoji: str = "💪"
    sets: int | None = None
    reps: str | None = None
    duration: str | None = None
    rest: str | None = None
    difficulty: str | None = None
    form_cues: list[str] = Field([], alias="formCues")
    modifications: list[FitnessModification] = []
    timestamp: int | None = None

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: Any) -> str | None:
        valid = ("beginner", "intermediate", "advanced")
        return v if v in valid else None


class FitnessTimerInterval(BaseModel):
    name: str
    duration: int = 0
    type: str = "work"

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: Any) -> str:
        valid = ("work", "rest", "warmup", "cooldown")
        return v if v in valid else "work"


class FitnessTimer(BaseModel):
    intervals: list[FitnessTimerInterval] = []
    rounds: int = 1

    @field_validator("rounds", mode="before")
    @classmethod
    def coerce_rounds(cls, v: Any) -> int:
        return v if v is not None else 1


class FitnessTip(BaseModel):
    type: str = "form"
    text: str

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: Any) -> str:
        valid = ("form", "safety", "progression")
        return v if v in valid else "form"


class FitnessMeta(BaseModel):
    model_config = {"populate_by_name": True}

    type: str = "general"
    difficulty: str = "intermediate"
    duration: int = 0
    muscle_groups: list[str] = Field([], alias="muscleGroups")
    equipment: list[str] = []
    calories_burned: int | None = Field(None, alias="caloriesBurned")

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: Any) -> str:
        return v if v else "general"

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: Any) -> str:
        valid = ("beginner", "intermediate", "advanced")
        return v if v in valid else "intermediate"

    @field_validator("duration", mode="before")
    @classmethod
    def coerce_duration(cls, v: Any) -> int:
        return v if v is not None else 0


class FitnessData(BaseModel):
    meta: FitnessMeta = Field(default_factory=FitnessMeta)
    warmup: list[FitnessExercise] = []
    exercises: list[FitnessExercise] = []
    cooldown: list[FitnessExercise] = []
    timer: FitnessTimer | None = None
    tips: list[FitnessTip] = []


# ─────────────────────────────────────────────────────
# Music Domain
# ─────────────────────────────────────────────────────

class MusicCredit(BaseModel):
    role: str
    name: str


class MusicSection(BaseModel):
    name: str
    timestamp: int | None = None
    duration: int | None = None
    description: str = ""

    @field_validator("duration", mode="before")
    @classmethod
    def coerce_duration(cls, v: Any) -> int | None:
        """Extract first integer from strings like '~60s', '~25s'."""
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            return int(v)
        if isinstance(v, str):
            import re
            match = re.search(r"\d+", v)
            return int(match.group()) if match else None
        return None


class MusicLyricLine(BaseModel):
    timestamp: int | None = None
    line: str


class MusicAnalysisItem(BaseModel):
    aspect: str
    emoji: str = ""
    detail: str = ""


class MusicData(BaseModel):
    title: str = ""
    artist: str = ""
    genre: list[str] = []
    credits: list[MusicCredit] = []
    analysis: list[MusicAnalysisItem] = []
    structure: list[MusicSection] = []
    lyrics: list[MusicLyricLine] = []
    themes: list[str] = []

    @field_validator("analysis", mode="before")
    @classmethod
    def coerce_analysis(cls, v: Any) -> list:
        """Accept legacy string format and convert to list."""
        if isinstance(v, str):
            return [{"aspect": "Overview", "emoji": "🎵", "detail": v}] if v.strip() else []
        if v is None:
            return []
        return v


# ─────────────────────────────────────────────────────
# Project Domain
# ─────────────────────────────────────────────────────

class ProjectMaterial(BaseModel):
    name: str
    quantity: str | None = None
    cost: str | None = None
    notes: str | None = None


class ProjectTool(BaseModel):
    name: str
    required: bool = True
    alternative: str | None = None


class ProjectStep(BaseModel):
    model_config = {"populate_by_name": True}

    number: int
    title: str = ""
    instruction: str = ""
    duration: str | None = None
    tips: str | None = None
    safety_note: str | None = Field(None, alias="safetyNote")
    timestamp: int | None = None


class ProjectData(BaseModel):
    model_config = {"populate_by_name": True}

    project_name: str = Field("Untitled Project", alias="projectName")
    difficulty: str = "intermediate"
    estimated_time: str = Field("unknown", alias="estimatedTime")
    estimated_cost: str | None = Field(None, alias="estimatedCost")
    materials: list[ProjectMaterial] = []
    tools: list[ProjectTool] = []
    steps: list[ProjectStep] = []
    safety_warnings: list[str] = Field([], alias="safetyWarnings")

    @field_validator("project_name", mode="before")
    @classmethod
    def coerce_name(cls, v: Any) -> str:
        return v if v else "Untitled Project"

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: Any) -> str:
        valid = ("beginner", "intermediate", "advanced")
        return v if v in valid else "intermediate"

    @field_validator("estimated_time", mode="before")
    @classmethod
    def coerce_time(cls, v: Any) -> str:
        return v if v else "unknown"


# ─────────────────────────────────────────────────────
# Modifiers
# ─────────────────────────────────────────────────────

class NarrativeKeyMoment(BaseModel):
    timestamp: int | None = None
    description: str = ""
    mood: str = ""
    emoji: str = ""


class NarrativeQuote(BaseModel):
    text: str
    speaker: str = ""
    timestamp: int | None = None
    context: str = ""


class NarrativeData(BaseModel):
    model_config = {"populate_by_name": True}

    key_moments: list[NarrativeKeyMoment] = Field([], alias="keyMoments")
    quotes: list[NarrativeQuote] = []
    takeaways: list[str] = []



class FinanceCost(BaseModel):
    item: str
    amount: float = 0
    currency: str = "USD"
    category: str = ""

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> float:
        if v is None:
            return 0.0
        return float(v)


class FinanceData(BaseModel):
    model_config = {"populate_by_name": True}

    costs: list[FinanceCost] = []
    saving_tips: list[str] = Field([], alias="savingTips")


# ─────────────────────────────────────────────────────
# Language Domain
# ─────────────────────────────────────────────────────

class LanguagePhrase(BaseModel):
    phrase: str
    translation: str = ""
    pronunciation: str | None = None
    context: str | None = None
    timestamp: int | None = None


class LanguageRule(BaseModel):
    name: str
    emoji: str = ""
    explanation: str = ""
    examples: list[str] = []
    exceptions: list[str] = []


class LanguageDrill(BaseModel):
    model_config = {"populate_by_name": True}

    number: int = 1
    instruction: str = ""
    prompt: str = ""
    answer: str = ""
    tips: str | None = None
    timestamp: int | None = None

    @field_validator("number", mode="before")
    @classmethod
    def coerce_number(cls, v: Any) -> int:
        if v is None:
            return 1
        return int(v)


class LanguageVocab(BaseModel):
    model_config = {"populate_by_name": True}

    word: str
    definition: str = ""
    pronunciation: str | None = None
    part_of_speech: str | None = Field(None, alias="partOfSpeech")
    example: str | None = None


class LanguageData(BaseModel):
    model_config = {"populate_by_name": True}

    target_language: str = Field("", alias="targetLanguage")
    native_language: str | None = Field(None, alias="nativeLanguage")
    level: str = "beginner"
    phrases: list[LanguagePhrase] = []
    rules: list[LanguageRule] = []
    drills: list[LanguageDrill] = []
    vocabulary: list[LanguageVocab] = []

    @field_validator("level", mode="before")
    @classmethod
    def coerce_level(cls, v: Any) -> str:
        valid = ("beginner", "intermediate", "advanced")
        return v if v in valid else "beginner"


# ─────────────────────────────────────────────────────
# Science Domain
# ─────────────────────────────────────────────────────

class ScienceConcept(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    emoji: str = ""
    definition: str = ""
    formula: str | None = None
    real_world_example: str | None = Field(None, alias="realWorldExample")
    connections: list[str] = []


class ScienceKeyFact(BaseModel):
    emoji: str = ""
    title: str
    detail: str = ""
    source: str | None = None


class ScienceExperiment(BaseModel):
    model_config = {"populate_by_name": True}

    number: int = 1
    title: str = ""
    instruction: str = ""
    materials: list[str] = []
    expected_result: str = Field("", alias="expectedResult")
    safety_note: str | None = Field(None, alias="safetyNote")
    timestamp: int | None = None

    @field_validator("number", mode="before")
    @classmethod
    def coerce_number(cls, v: Any) -> int:
        if v is None:
            return 1
        return int(v)


class ScienceData(BaseModel):
    model_config = {"populate_by_name": True}

    field: str = ""
    level: str = "intermediate"
    concepts: list[ScienceConcept] = []
    key_facts: list[ScienceKeyFact] = Field([], alias="keyFacts")
    experiments: list[ScienceExperiment] = []

    @field_validator("level", mode="before")
    @classmethod
    def coerce_level(cls, v: Any) -> str:
        valid = ("beginner", "intermediate", "advanced")
        return v if v in valid else "intermediate"


# ─────────────────────────────────────────────────────
# VIEResponse Envelope
# ─────────────────────────────────────────────────────

class TabDefinition(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    label: str
    emoji: str = ""
    data_source: str = Field("", alias="dataSource")


class SectionDefinition(BaseModel):
    type: str
    items: list[dict] = []


class VIEResponseMeta(BaseModel):
    model_config = {"populate_by_name": True}

    video_id: str = Field("", alias="videoId")
    video_title: str = Field("", alias="videoTitle")
    creator: str = ""
    content_tags: list[str] = Field([], alias="contentTags")
    modifiers: list[str] = []
    primary_tag: str = Field("learning", alias="primaryTag")
    user_goal: str = Field("", alias="userGoal")


class VIEResponse(BaseModel):
    model_config = {"populate_by_name": True}

    meta: VIEResponseMeta
    tabs: list[TabDefinition] = []
    sections: list[SectionDefinition] = []

    # Domain data (only populated domains present)
    travel: TravelData | None = None
    food: FoodData | None = None
    tech: TechData | None = None
    fitness: FitnessData | None = None
    music: MusicData | None = None
    learning: LearningData | None = None
    review: ReviewData | None = None
    project: ProjectData | None = None
    language: LanguageData | None = None
    science: ScienceData | None = None

    # Modifiers
    narrative: NarrativeData | None = None
    finance: FinanceData | None = None

    # Enrichment
    quizzes: list[dict] | None = None
    scenarios: list[dict] | None = None
    flashcards: list[dict] | None = None


# ─────────────────────────────────────────────────────
# Domain Model Registry
# ─────────────────────────────────────────────────────

DOMAIN_MODELS: dict[str, type[BaseModel]] = {
    "travel": TravelData,
    "food": FoodData,
    "learning": LearningData,
    "review": ReviewData,
    "tech": TechData,
    "fitness": FitnessData,
    "music": MusicData,
    "project": ProjectData,
    "language": LanguageData,
    "science": ScienceData,
}

MODIFIER_MODELS: dict[str, type[BaseModel]] = {
    "narrative": NarrativeData,
    "finance": FinanceData,
}

VALID_CONTENT_TAGS = valid_content_tags()
VALID_MODIFIERS = valid_modifiers()


def validate_domain_output(content_tags: list[str], modifiers: list[str], data: dict) -> dict:
    """Validate LLM output against domain Pydantic models.

    Single tag: data validated directly against DOMAIN_MODELS[tag].
    Multi-tag: tries {tag}Data wrappers first, then {tag} keys, then
    falls back to validating the flat data against each domain model
    (lets Pydantic pick up matching fields and ignore the rest).
    Returns validated dict ready for storage/SSE.
    """
    validated: dict = {}

    if len(content_tags) == 1:
        tag = content_tags[0]
        model_cls = DOMAIN_MODELS.get(tag)
        if model_cls:
            try:
                instance = model_cls.model_validate(data)
                validated[tag] = instance.model_dump(by_alias=True)
            except ValidationError as e:
                logger.warning("Validation failed for tag %s, passing data through: %s", tag, e)
                validated[tag] = data
        else:
            logger.warning("No domain model for tag: %s — data passed through unvalidated", tag)
            validated[tag] = data
    else:
        for tag in content_tags:
            wrapper_key = f"{tag}Data"
            tag_data = data.get(wrapper_key) or data.get(tag)
            if tag_data and isinstance(tag_data, dict):
                model_cls = DOMAIN_MODELS.get(tag)
                if model_cls:
                    try:
                        instance = model_cls.model_validate(tag_data)
                        validated[tag] = instance.model_dump(by_alias=True)
                    except ValidationError as e:
                        logger.warning("Validation failed for tag %s, passing data through: %s", tag, e)
                        validated[tag] = tag_data
                else:
                    logger.warning("No domain model for tag: %s — data passed through unvalidated", tag)
                    validated[tag] = tag_data

        # Fallback: for any tags missing a wrapped key, try validating flat data against the model.
        # This handles LLMs that wrap some domains but leave others at the top level.
        missing_tags = [tag for tag in content_tags if tag not in validated]
        if missing_tags:
            logger.info("Missing wrapped keys for tags %s — trying flat validation fallback", missing_tags)
            for tag in missing_tags:
                model_cls = DOMAIN_MODELS.get(tag)
                if model_cls:
                    try:
                        instance = model_cls.model_validate(data)
                        dumped = instance.model_dump(by_alias=True)
                        # Only include if the model actually extracted non-empty data
                        if any(v for v in dumped.values() if v and v != [] and v != {}):
                            validated[tag] = dumped
                    except ValidationError as e:
                        logger.warning(
                            "Flat validation failed for missing tag %s — fields: %s, errors: %s",
                            tag,
                            list(data.keys()) if isinstance(data, dict) else "non-dict",
                            str(e)[:300],
                        )

    for modifier in modifiers:
        wrapper_key = f"{modifier}Data"
        mod_data = data.get(wrapper_key) or data.get(modifier)
        if mod_data and isinstance(mod_data, dict):
            model_cls = MODIFIER_MODELS.get(modifier)
            if model_cls:
                try:
                    instance = model_cls.model_validate(mod_data)
                    validated[modifier] = instance.model_dump(by_alias=True)
                except ValidationError as e:
                    logger.warning("Modifier validation failed for %s, passing through: %s", modifier, e)
                    validated[modifier] = mod_data
            else:
                logger.warning("No modifier model for: %s — data passed through unvalidated", modifier)
                validated[modifier] = mod_data

    return validated
