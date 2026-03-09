"""Pydantic models for all 10 output types."""

from __future__ import annotations

from typing import Literal, get_args

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────
# Output Type
# ─────────────────────────────────────────────────────

OutputType = Literal[
    "explanation",
    "recipe",
    "code_walkthrough",
    "study_kit",
    "trip_planner",
    "workout",
    "verdict",
    "highlights",
    "music_guide",
    "project_guide",
]

OUTPUT_TYPE_VALUES: list[str] = list(get_args(OutputType))

OUTPUT_TYPE_LEGACY_MAP: dict[str, str] = {
    "summary": "explanation",
    "recipe": "recipe",
    "tutorial": "code_walkthrough",
    "study_guide": "study_kit",
    "travel_plan": "trip_planner",
    "workout": "workout",
    "review": "verdict",
    "podcast_notes": "highlights",
    "diy_guide": "project_guide",
    "music_guide": "music_guide",
    "game_guide": "explanation",
}


# ─────────────────────────────────────────────────────
# Intent Detection
# ─────────────────────────────────────────────────────

class OutputSection(BaseModel):
    id: str
    label: str
    emoji: str
    description: str


class IntentResult(BaseModel):
    output_type: OutputType = Field(alias="outputType")
    confidence: float = Field(ge=0.0, le=1.0)
    user_goal: str = Field(alias="userGoal")
    sections: list[OutputSection]

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Synthesis
# ─────────────────────────────────────────────────────

class SynthesisResult(BaseModel):
    tldr: str
    key_takeaways: list[str] = Field(alias="keyTakeaways")
    master_summary: str = Field(alias="masterSummary")
    seo_description: str = Field(alias="seoDescription")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Explanation Output (default fallback)
# ─────────────────────────────────────────────────────

class ExplanationKeyPoint(BaseModel):
    emoji: str
    title: str
    detail: str
    timestamp: int | None = None


class ExplanationConcept(BaseModel):
    name: str
    definition: str
    emoji: str


class ExplanationTimestamp(BaseModel):
    time: str
    seconds: int
    label: str


class ExplanationOutput(BaseModel):
    key_points: list[ExplanationKeyPoint] = Field(alias="keyPoints")
    concepts: list[ExplanationConcept]
    takeaways: list[str]
    timestamps: list[ExplanationTimestamp] = []

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Recipe Output
# ─────────────────────────────────────────────────────

class RecipeIngredient(BaseModel):
    name: str
    amount: str | None = None
    unit: str | None = None
    group: str | None = None
    notes: str | None = None


class RecipeStep(BaseModel):
    number: int
    instruction: str
    duration: int | None = None
    tips: str | None = None
    timestamp: int | None = None


class RecipeTip(BaseModel):
    type: Literal["chef_tip", "warning", "substitution", "storage"] = "chef_tip"
    text: str

    @field_validator("type", mode="before")
    @classmethod
    def _default_type(cls, v):
        return v if v in ("chef_tip", "warning", "substitution", "storage") else "chef_tip"


class RecipeNutrition(BaseModel):
    nutrient: str
    amount: str
    unit: str | None = None


class RecipeSubstitution(BaseModel):
    original: str
    substitute: str
    notes: str | None = None


class RecipeMeta(BaseModel):
    prep_time: int | None = Field(None, alias="prepTime")
    cook_time: int | None = Field(None, alias="cookTime")
    total_time: int | None = Field(None, alias="totalTime")
    servings: int | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    cuisine: str | None = None

    model_config = {"populate_by_name": True}


class RecipeOutput(BaseModel):
    meta: RecipeMeta
    ingredients: list[RecipeIngredient]
    steps: list[RecipeStep]
    tips: list[RecipeTip] = []
    substitutions: list[RecipeSubstitution] = []
    nutrition: list[RecipeNutrition] = []
    equipment: list[str] = []


# ─────────────────────────────────────────────────────
# Code Walkthrough Output
# ─────────────────────────────────────────────────────

class CodeDependency(BaseModel):
    name: str
    version: str | None = None


class CodeEnvVar(BaseModel):
    name: str
    description: str
    example: str | None = None


class CodeSetup(BaseModel):
    commands: list[str] = []
    dependencies: list[CodeDependency] = []
    env_vars: list[CodeEnvVar] = Field([], alias="envVars")

    model_config = {"populate_by_name": True}


class CodeSnippet(BaseModel):
    filename: str | None = None
    language: str
    code: str
    explanation: str
    timestamp: int | None = None


class CodePattern(BaseModel):
    title: str
    do_example: str = Field(alias="doExample")
    dont_example: str = Field(alias="dontExample")
    explanation: str

    model_config = {"populate_by_name": True}


class CodeCheatSheetItem(BaseModel):
    title: str
    code: str
    description: str


class CodeWalkthroughOutput(BaseModel):
    languages: list[str] = []
    frameworks: list[str] = []
    concepts: list[str] = []
    setup: CodeSetup
    snippets: list[CodeSnippet] = []
    patterns: list[CodePattern] = []
    cheat_sheet: list[CodeCheatSheetItem] = Field([], alias="cheatSheet")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Study Kit Output
# ─────────────────────────────────────────────────────

class StudyConcept(BaseModel):
    name: str
    emoji: str
    definition: str
    example: str | None = None
    analogy: str | None = None
    connections: list[str] = []


class StudyTimelineEvent(BaseModel):
    date: str | None = None
    title: str
    description: str


class StudyKitOutput(BaseModel):
    key_question: str = Field(alias="keyQuestion")
    concepts: list[StudyConcept]
    key_facts: list[str] = Field(alias="keyFacts")
    timeline: list[StudyTimelineEvent] = []
    summary: str

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Trip Planner Output
# ─────────────────────────────────────────────────────

class TripSpot(BaseModel):
    name: str
    emoji: str
    description: str
    cost: str | None = None
    duration: str | None = None
    map_query: str | None = Field(None, alias="mapQuery")
    booking_url: str | None = Field(None, alias="bookingUrl")
    tips: str | None = None

    model_config = {"populate_by_name": True}


class TripDay(BaseModel):
    day: int
    city: str | None = None
    theme: str | None = None
    daily_cost: str | None = Field(None, alias="dailyCost")
    spots: list[TripSpot] = []
    tips: list[str] = []

    model_config = {"populate_by_name": True}


class TripBudgetItem(BaseModel):
    category: str
    amount: float
    currency: str
    notes: str | None = None


class TripPackingItem(BaseModel):
    item: str
    category: str
    essential: bool = False


class TripBudget(BaseModel):
    total: float
    currency: str
    breakdown: list[TripBudgetItem] = []

    @field_validator("total", mode="before")
    @classmethod
    def coerce_total(cls, v):
        if v is None:
            return 0.0
        return float(v)

    @field_validator("currency", mode="before")
    @classmethod
    def coerce_currency(cls, v):
        if not v:
            return "USD"
        return str(v)


class TripPlannerOutput(BaseModel):
    destination: str
    total_days: int = Field(alias="totalDays")
    best_season: str | None = Field(None, alias="bestSeason")
    days: list[TripDay]
    budget: TripBudget
    packing_list: list[TripPackingItem] = Field([], alias="packingList")

    model_config = {"populate_by_name": True}

    @field_validator("total_days", mode="before")
    @classmethod
    def coerce_total_days(cls, v):
        if v is None:
            return 1
        return int(v)


# ─────────────────────────────────────────────────────
# Workout Output
# ─────────────────────────────────────────────────────

class ExerciseModification(BaseModel):
    label: str
    description: str


class WorkoutExercise(BaseModel):
    name: str
    emoji: str = "💪"
    sets: int | None = None
    reps: str | None = None
    duration: str | None = None
    rest: str | None = None
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    form_cues: list[str] = Field([], alias="formCues")
    modifications: list[ExerciseModification] = []
    superset_with: str | None = Field(None, alias="supersetWith")
    timestamp: int | None = None

    model_config = {"populate_by_name": True}


class WorkoutTimerInterval(BaseModel):
    name: str
    duration: int
    type: Literal["work", "rest", "warmup", "cooldown"]


class WorkoutTimer(BaseModel):
    intervals: list[WorkoutTimerInterval] = []
    rounds: int = 1

    @field_validator("rounds", mode="before")
    @classmethod
    def _default_rounds(cls, v):
        return v if v is not None else 1


class WorkoutMeta(BaseModel):
    type: str = "general"
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    duration: int = 0
    muscle_groups: list[str] = Field(default=[], alias="muscleGroups")
    equipment: list[str] = []
    calories_burned: int | None = Field(None, alias="caloriesBurned")

    model_config = {"populate_by_name": True}

    @field_validator("type", mode="before")
    @classmethod
    def _default_type(cls, v):
        return v if v is not None else "general"

    @field_validator("difficulty", mode="before")
    @classmethod
    def _default_difficulty(cls, v):
        return v if v in ("beginner", "intermediate", "advanced") else "intermediate"

    @field_validator("duration", mode="before")
    @classmethod
    def _default_duration(cls, v):
        return v if v is not None else 0


class WorkoutTip(BaseModel):
    type: Literal["form", "safety", "progression"] = "form"
    text: str

    @field_validator("type", mode="before")
    @classmethod
    def _default_type(cls, v):
        return v if v in ("form", "safety", "progression") else "form"


class WorkoutOutput(BaseModel):
    meta: WorkoutMeta
    warmup: list[WorkoutExercise] = []
    exercises: list[WorkoutExercise]
    cooldown: list[WorkoutExercise] = []
    timer: WorkoutTimer | None = None
    tips: list[WorkoutTip] = []


# ─────────────────────────────────────────────────────
# Verdict Output
# ─────────────────────────────────────────────────────

class VerdictSpec(BaseModel):
    key: str
    value: str


class VerdictComparison(BaseModel):
    feature: str
    this_product: str = Field(alias="thisProduct")
    competitor: str
    competitor_name: str = Field(alias="competitorName")

    model_config = {"populate_by_name": True}


class VerdictRating(BaseModel):
    score: float
    max_score: float = Field(alias="maxScore")
    label: str

    model_config = {"populate_by_name": True}

    @field_validator("score", mode="before")
    @classmethod
    def coerce_score(cls, v):
        if v is None:
            return 0.0
        return float(v)

    @field_validator("max_score", mode="before")
    @classmethod
    def coerce_max_score(cls, v):
        if v is None:
            return 10.0
        return float(v)


class VerdictDecision(BaseModel):
    badge: Literal["recommended", "not_recommended", "conditional", "best_in_class"]
    best_for: list[str] = Field(alias="bestFor")
    not_for: list[str] = Field(alias="notFor")
    bottom_line: str = Field(alias="bottomLine")

    model_config = {"populate_by_name": True}

    @field_validator("badge", mode="before")
    @classmethod
    def coerce_badge(cls, v):
        valid = ("recommended", "not_recommended", "conditional", "best_in_class")
        if v not in valid:
            return "recommended"
        return v


class VerdictOutput(BaseModel):
    product: str
    price: str | None = None
    rating: VerdictRating
    pros: list[str]
    cons: list[str]
    specs: list[VerdictSpec] = []
    comparisons: list[VerdictComparison] = []
    verdict: VerdictDecision


# ─────────────────────────────────────────────────────
# Highlights Output
# ─────────────────────────────────────────────────────

class HighlightsSpeaker(BaseModel):
    name: str
    role: str | None = None
    emoji: str


class HighlightsQuote(BaseModel):
    text: str
    speaker: str
    timestamp: int | None = None
    emoji: str


class HighlightsTopic(BaseModel):
    name: str
    emoji: str
    timestamp: int | None = None
    duration: int | None = None
    summary: str


class HighlightsOutput(BaseModel):
    speakers: list[HighlightsSpeaker]
    highlights: list[HighlightsQuote]
    topics: list[HighlightsTopic]


# ─────────────────────────────────────────────────────
# Music Guide Output
# ─────────────────────────────────────────────────────

class MusicCredit(BaseModel):
    role: str
    name: str


class MusicSection(BaseModel):
    name: str
    timestamp: int | None = None
    duration: int | None = None
    description: str


class MusicLyricLine(BaseModel):
    timestamp: int | None = None
    line: str


class MusicGuideOutput(BaseModel):
    title: str
    artist: str
    genre: list[str] = []
    credits: list[MusicCredit] = []
    analysis: str
    structure: list[MusicSection] = []
    lyrics: list[MusicLyricLine] = []
    themes: list[str] = []


# ─────────────────────────────────────────────────────
# Project Guide Output
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
    number: int
    title: str
    instruction: str
    duration: str | None = None
    tips: str | None = None
    safety_note: str | None = Field(None, alias="safetyNote")
    timestamp: int | None = None

    model_config = {"populate_by_name": True}


class ProjectGuideOutput(BaseModel):
    project_name: str = Field(default="Untitled Project", alias="projectName")
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    estimated_time: str = Field(default="unknown", alias="estimatedTime")
    estimated_cost: str | None = Field(None, alias="estimatedCost")
    materials: list[ProjectMaterial] = []
    tools: list[ProjectTool] = []
    steps: list[ProjectStep] = []
    safety_warnings: list[str] = Field([], alias="safetyWarnings")

    model_config = {"populate_by_name": True}

    @field_validator("project_name", mode="before")
    @classmethod
    def _default_name(cls, v):
        return v if v is not None else "Untitled Project"

    @field_validator("difficulty", mode="before")
    @classmethod
    def _default_difficulty(cls, v):
        return v if v in ("beginner", "intermediate", "advanced") else "intermediate"

    @field_validator("estimated_time", mode="before")
    @classmethod
    def _default_time(cls, v):
        return v if v is not None else "unknown"


# ─────────────────────────────────────────────────────
# Enrichment
# ─────────────────────────────────────────────────────

class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int = Field(alias="correctIndex")
    explanation: str

    model_config = {"populate_by_name": True}


class Flashcard(BaseModel):
    front: str
    back: str


class EnrichmentData(BaseModel):
    quiz: list[QuizQuestion] | None = None
    flashcards: list[Flashcard] | None = None
    cheat_sheet: list[CodeCheatSheetItem] | None = Field(None, alias="cheatSheet")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────
# Model Registry (for validation dispatching)
# ─────────────────────────────────────────────────────

OUTPUT_TYPE_MODELS: dict[str, type[BaseModel]] = {
    "explanation": ExplanationOutput,
    "recipe": RecipeOutput,
    "code_walkthrough": CodeWalkthroughOutput,
    "study_kit": StudyKitOutput,
    "trip_planner": TripPlannerOutput,
    "workout": WorkoutOutput,
    "verdict": VerdictOutput,
    "highlights": HighlightsOutput,
    "music_guide": MusicGuideOutput,
    "project_guide": ProjectGuideOutput,
}


def validate_output(output_type: str, data: dict) -> BaseModel:
    """Validate extraction output against the correct Pydantic model."""
    model_cls = OUTPUT_TYPE_MODELS.get(output_type)
    if not model_cls:
        raise ValueError(f"Unknown output type: {output_type}")
    return model_cls.model_validate(data)


# Mapping from output type to extraction prompt file name.
# Types not listed here use their own name (e.g. "recipe" → "extract_recipe.txt").
OUTPUT_TYPE_PROMPT_MAP: dict[str, str] = {
    "explanation": "smart",
    "code_walkthrough": "code",
    "study_kit": "study",
    "trip_planner": "trip",
    "music_guide": "music",
    "project_guide": "project",
}


def output_type_to_prompt_name(output_type: str) -> str:
    """Map output type to extraction prompt file name."""
    return OUTPUT_TYPE_PROMPT_MAP.get(output_type, output_type)
