"""Shared pipeline types used across synthesis, enrichment, and manifest stages."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class SynthesisResult(BaseModel):
    tldr: str
    key_takeaways: list[str] = Field(alias="keyTakeaways")
    master_summary: str = Field(alias="masterSummary")
    seo_description: str = Field(alias="seoDescription")

    model_config = {"populate_by_name": True}


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int = Field(alias="correctIndex")
    explanation: str

    model_config = {"populate_by_name": True}


class Flashcard(BaseModel):
    front: str
    back: str


class CodeCheatSheetItem(BaseModel):
    title: str
    code: str
    description: str


class ScenarioOption(BaseModel):
    text: str
    correct: bool = False
    explanation: str = ""


class ScenarioItem(BaseModel):
    question: str
    emoji: str = ""
    options: list[ScenarioOption] = []


class EnrichmentData(BaseModel):
    quiz: list[QuizQuestion] | None = None
    flashcards: list[Flashcard] | None = None
    cheat_sheet: list[CodeCheatSheetItem] | None = Field(None, alias="cheatSheet")
    scenarios: list[ScenarioItem] | None = None

    model_config = {"populate_by_name": True}


# ── Manifest Stage ──


class ItemCounts(BaseModel):
    steps: int = 0
    spots: int = 0
    exercises: int = 0
    ingredients: int = 0
    songs: int = 0
    tips: int = 0
    products: int = 0

    @field_validator("*", mode="before")
    @classmethod
    def coerce_int(cls, v):
        if v is None:
            return 0
        return int(v)


class ManifestSection(BaseModel):
    model_config = {"populate_by_name": True}

    title: str = ""
    start_percent: int = Field(0, alias="startPercent")
    end_percent: int = Field(100, alias="endPercent")
    density: str = "medium"


class ManifestFlags(BaseModel):
    model_config = {"populate_by_name": True}

    has_storytelling: bool = Field(False, alias="hasStorytelling")
    has_budget_discussion: bool = Field(False, alias="hasBudgetDiscussion")
    has_code_snippets: bool = Field(False, alias="hasCodeSnippets")
    has_recipe: bool = Field(False, alias="hasRecipe")
    has_workout: bool = Field(False, alias="hasWorkout")
    speaker_count: int = Field(1, alias="speakerCount")


class ManifestResult(BaseModel):
    model_config = {"populate_by_name": True}

    summary: str = ""
    content_type: str = Field("", alias="contentType")
    main_topics: list[str] = Field([], alias="mainTopics")
    item_counts: ItemCounts = Field(default_factory=ItemCounts, alias="itemCounts")
    sections: list[ManifestSection] = []
    key_names: list[str] = Field([], alias="keyNames")
    flags: ManifestFlags = Field(default_factory=ManifestFlags)
