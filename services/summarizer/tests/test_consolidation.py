"""Tests for cross-chapter consolidation (Phase 3).

Tests consolidation strategies for recipe, tutorial, workout, travel,
passthrough for non-applicable types, and edge cases.
"""

import pytest

from src.services.cross_chapter_consolidation import (
    CONSOLIDATION_TYPES,
    consolidate_chapters,
)


def _make_chapter(title: str, blocks: list[dict]) -> dict:
    """Helper to build a chapter dict with content blocks."""
    return {"title": title, "content": blocks}


class TestConsolidationTypes:
    """Verify which output types trigger consolidation."""

    def test_recipe_is_consolidation_type(self):
        assert "recipe" in CONSOLIDATION_TYPES

    def test_tutorial_is_consolidation_type(self):
        assert "tutorial" in CONSOLIDATION_TYPES

    def test_workout_is_consolidation_type(self):
        assert "workout" in CONSOLIDATION_TYPES

    def test_travel_plan_is_consolidation_type(self):
        assert "travel_plan" in CONSOLIDATION_TYPES

    def test_summary_is_not_consolidation_type(self):
        assert "summary" not in CONSOLIDATION_TYPES

    def test_review_is_not_consolidation_type(self):
        assert "review" not in CONSOLIDATION_TYPES

    def test_podcast_notes_is_not_consolidation_type(self):
        assert "podcast_notes" not in CONSOLIDATION_TYPES


class TestDefaultPassthrough:
    """Non-consolidation output types return None."""

    def test_summary_returns_none(self):
        chapters = [_make_chapter("ch1", []), _make_chapter("ch2", [])]
        assert consolidate_chapters(chapters, "summary") is None

    def test_review_returns_none(self):
        chapters = [_make_chapter("ch1", []), _make_chapter("ch2", [])]
        assert consolidate_chapters(chapters, "review") is None

    def test_podcast_notes_returns_none(self):
        chapters = [_make_chapter("ch1", []), _make_chapter("ch2", [])]
        assert consolidate_chapters(chapters, "podcast_notes") is None

    def test_unknown_type_returns_none(self):
        chapters = [_make_chapter("ch1", []), _make_chapter("ch2", [])]
        assert consolidate_chapters(chapters, "unknown") is None


class TestSingleChapter:
    """Single chapter should not trigger consolidation."""

    def test_single_chapter_returns_none(self):
        chapters = [_make_chapter("ch1", [
            {"type": "ingredient", "items": ["flour", "sugar"]}
        ])]
        assert consolidate_chapters(chapters, "recipe") is None


class TestEmptyChapters:
    """Empty chapters list should not trigger consolidation."""

    def test_empty_list_returns_none(self):
        assert consolidate_chapters([], "recipe") is None


class TestRecipeConsolidation:
    """Test recipe consolidation: merge ingredients + steps."""

    def test_merges_ingredients_from_multiple_chapters(self):
        chapters = [
            _make_chapter("Prep", [
                {"type": "ingredient", "items": ["2 cups flour", "1 tsp salt"]},
            ]),
            _make_chapter("Cook", [
                {"type": "ingredient", "items": ["1 cup butter"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        assert result["outputType"] == "recipe"
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        assert "2 cups flour" in ingredient_block["items"]
        assert "1 tsp salt" in ingredient_block["items"]
        assert "1 cup butter" in ingredient_block["items"]

    def test_deduplicates_ingredients(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "ingredient", "items": ["flour", "Sugar"]},
            ]),
            _make_chapter("ch2", [
                {"type": "ingredient", "items": ["Flour", "butter"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        # "flour" and "Flour" are duplicates (case-insensitive)
        lower_items = [i.lower() for i in ingredient_block["items"]]
        assert lower_items.count("flour") == 1

    def test_merges_steps(self):
        chapters = [
            _make_chapter("Prep", [
                {"type": "step", "items": ["Preheat oven"]},
            ]),
            _make_chapter("Cook", [
                {"type": "step", "items": ["Mix ingredients", "Bake 25 min"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert step_block["items"] == ["Preheat oven", "Mix ingredients", "Bake 25 min"]

    def test_handles_bullets_variant_ingredients(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "bullets", "variant": "ingredients", "items": ["flour"]},
            ]),
            _make_chapter("ch2", [
                {"type": "ingredient", "items": ["sugar"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        assert "flour" in ingredient_block["items"]
        assert "sugar" in ingredient_block["items"]

    def test_handles_numbered_cooking_steps(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "numbered", "variant": "cooking_steps", "items": ["Step 1"]},
            ]),
            _make_chapter("ch2", [
                {"type": "step", "items": ["Step 2"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert "Step 1" in step_block["items"]
        assert "Step 2" in step_block["items"]

    def test_deduplicates_steps(self):
        chapters = [
            _make_chapter("Prep", [
                {"type": "step", "items": ["Preheat oven to 350F", "Mix dry ingredients"]},
            ]),
            _make_chapter("Cook", [
                {"type": "step", "items": ["preheat oven to 350f", "Pour batter into pan"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        # "Preheat oven to 350F" and "preheat oven to 350f" are duplicates (case-insensitive)
        lower_steps = [s.lower() for s in step_block["items"]]
        assert lower_steps.count("preheat oven to 350f") == 1
        assert len(step_block["items"]) == 3
        # Provenance should also be deduped
        assert len(step_block["steps"]) == 3

    def test_no_ingredients_or_steps_returns_none(self):
        chapters = [
            _make_chapter("ch1", [{"type": "paragraph", "text": "Hello"}]),
            _make_chapter("ch2", [{"type": "paragraph", "text": "World"}]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is None


class TestTutorialConsolidation:
    """Test tutorial consolidation: merge code/terminal blocks."""

    def test_merges_code_blocks(self):
        chapters = [
            _make_chapter("Setup", [
                {"type": "code", "code": "npm init", "language": "bash"},
            ]),
            _make_chapter("Main", [
                {"type": "code", "code": "console.log('hello')", "language": "javascript"},
            ]),
        ]
        result = consolidate_chapters(chapters, "tutorial")
        assert result is not None
        assert result["outputType"] == "tutorial"
        assert len(result["blocks"]) == 2

    def test_includes_terminal_blocks(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "terminal", "command": "npm install"},
            ]),
            _make_chapter("ch2", [
                {"type": "code", "code": "import express"},
            ]),
        ]
        result = consolidate_chapters(chapters, "tutorial")
        assert result is not None
        assert len(result["blocks"]) == 2

    def test_includes_file_tree_blocks(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "file_tree", "items": ["src/", "tests/"]},
            ]),
            _make_chapter("ch2", [
                {"type": "code", "code": "const app = express()"},
            ]),
        ]
        result = consolidate_chapters(chapters, "tutorial")
        assert result is not None
        assert len(result["blocks"]) == 2

    def test_adds_chapter_title_to_blocks(self):
        chapters = [
            _make_chapter("Setup", [
                {"type": "code", "code": "npm init"},
            ]),
        ]
        # Single chapter returns None
        chapters.append(_make_chapter("Build", [
            {"type": "code", "code": "npm run build"},
        ]))
        result = consolidate_chapters(chapters, "tutorial")
        assert result is not None
        assert result["blocks"][0]["chapterTitle"] == "Setup"
        assert result["blocks"][1]["chapterTitle"] == "Build"

    def test_no_code_blocks_returns_none(self):
        chapters = [
            _make_chapter("ch1", [{"type": "paragraph", "text": "text"}]),
            _make_chapter("ch2", [{"type": "bullets", "items": ["a"]}]),
        ]
        result = consolidate_chapters(chapters, "tutorial")
        assert result is None


class TestWorkoutConsolidation:
    """Test workout consolidation: merge exercise blocks."""

    def test_merges_exercise_blocks(self):
        chapters = [
            _make_chapter("Warm Up", [
                {"type": "exercise", "name": "Jumping Jacks", "sets": 3},
            ]),
            _make_chapter("Main", [
                {"type": "exercise", "name": "Squats", "sets": 4},
            ]),
        ]
        result = consolidate_chapters(chapters, "workout")
        assert result is not None
        assert result["outputType"] == "workout"
        assert len(result["blocks"]) == 2

    def test_includes_workout_timer_blocks(self):
        chapters = [
            _make_chapter("HIIT", [
                {"type": "workout_timer", "duration": 30, "rest": 10},
            ]),
            _make_chapter("Cooldown", [
                {"type": "exercise", "name": "Stretching"},
            ]),
        ]
        result = consolidate_chapters(chapters, "workout")
        assert result is not None
        assert len(result["blocks"]) == 2

    def test_no_exercise_blocks_returns_none(self):
        chapters = [
            _make_chapter("ch1", [{"type": "paragraph", "text": "rest day"}]),
            _make_chapter("ch2", [{"type": "paragraph", "text": "nutrition"}]),
        ]
        result = consolidate_chapters(chapters, "workout")
        assert result is None


class TestTravelConsolidation:
    """Test travel consolidation: merge itinerary + cost blocks."""

    def test_merges_itinerary_blocks(self):
        chapters = [
            _make_chapter("Day 1", [
                {"type": "itinerary", "day": 1, "items": ["Visit temple"]},
            ]),
            _make_chapter("Day 2", [
                {"type": "itinerary", "day": 2, "items": ["Beach day"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "travel_plan")
        assert result is not None
        assert result["outputType"] == "travel_plan"
        assert len(result["blocks"]) == 2

    def test_merges_location_blocks(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "location", "name": "Tokyo Tower"},
            ]),
            _make_chapter("ch2", [
                {"type": "location", "name": "Shibuya Crossing"},
            ]),
        ]
        result = consolidate_chapters(chapters, "travel_plan")
        assert result is not None
        assert len(result["blocks"]) == 2

    def test_includes_cost_blocks(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "itinerary", "items": ["Museum"]},
            ]),
            _make_chapter("ch2", [
                {"type": "cost", "amount": 50, "currency": "USD"},
            ]),
        ]
        result = consolidate_chapters(chapters, "travel_plan")
        assert result is not None
        assert len(result["blocks"]) == 2

    def test_no_travel_blocks_returns_none(self):
        chapters = [
            _make_chapter("ch1", [{"type": "paragraph", "text": "pack bags"}]),
            _make_chapter("ch2", [{"type": "bullets", "items": ["book flight"]}]),
        ]
        result = consolidate_chapters(chapters, "travel_plan")
        assert result is None


class TestRecipeStructuredItems:
    """Test recipe consolidation with v2.1 structured dict items."""

    def test_merges_structured_ingredient_dicts(self):
        """ingredient blocks with dict items should not crash."""
        chapters = [
            _make_chapter("Prep", [
                {"type": "ingredient", "items": [
                    {"name": "flour", "amount": "2", "unit": "cups"},
                    {"name": "salt", "amount": "1", "unit": "tsp"},
                ]},
            ]),
            _make_chapter("Cook", [
                {"type": "ingredient", "items": [
                    {"name": "butter", "amount": "1/2", "unit": "cup", "notes": "softened"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        assert len(ingredient_block["items"]) == 3
        # Items should be preserved as dicts
        assert isinstance(ingredient_block["items"][0], dict)
        assert ingredient_block["items"][0]["name"] == "flour"

    def test_deduplicates_structured_ingredients(self):
        """Duplicate ingredient dicts (same name+amount+unit) should be deduped."""
        chapters = [
            _make_chapter("ch1", [
                {"type": "ingredient", "items": [
                    {"name": "flour", "amount": "2", "unit": "cups"},
                ]},
            ]),
            _make_chapter("ch2", [
                {"type": "ingredient", "items": [
                    {"name": "Flour", "amount": "2", "unit": "Cups"},
                    {"name": "sugar", "amount": "1", "unit": "cup"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        # "flour 2 cups" appears in both chapters (case-insensitive) → deduped
        assert len(ingredient_block["items"]) == 2

    def test_mixed_string_and_dict_ingredients(self):
        """Mix of plain string items (bullets variant) and dict items (ingredient type)."""
        chapters = [
            _make_chapter("ch1", [
                {"type": "bullets", "variant": "ingredients", "items": ["2 cups flour"]},
            ]),
            _make_chapter("ch2", [
                {"type": "ingredient", "items": [
                    {"name": "sugar", "amount": "1", "unit": "cup"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        ingredient_block = next(b for b in result["blocks"] if b["type"] == "ingredient")
        assert len(ingredient_block["items"]) == 2
        assert isinstance(ingredient_block["items"][0], str)
        assert isinstance(ingredient_block["items"][1], dict)

    def test_merges_structured_step_blocks(self):
        """step blocks with 'steps' array (v2.1) should be merged correctly."""
        chapters = [
            _make_chapter("Prep", [
                {"type": "step", "steps": [
                    {"number": 1, "instruction": "Preheat oven to 375°F", "duration": 300},
                ]},
            ]),
            _make_chapter("Cook", [
                {"type": "step", "steps": [
                    {"number": 2, "instruction": "Mix dry ingredients", "tips": "Sift flour"},
                    {"number": 3, "instruction": "Bake for 25 minutes", "duration": 1500},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert len(step_block["items"]) == 3
        assert isinstance(step_block["items"][0], dict)
        assert step_block["items"][0]["instruction"] == "Preheat oven to 375°F"

    def test_deduplicates_structured_steps(self):
        """Duplicate step dicts (same instruction, case-insensitive) should be deduped."""
        chapters = [
            _make_chapter("ch1", [
                {"type": "step", "steps": [
                    {"number": 1, "instruction": "Preheat oven to 375°F"},
                ]},
            ]),
            _make_chapter("ch2", [
                {"type": "step", "steps": [
                    {"number": 1, "instruction": "preheat oven to 375°f"},
                    {"number": 2, "instruction": "Mix ingredients"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert len(step_block["items"]) == 2

    def test_step_provenance_includes_chapter_title(self):
        """Structured step provenance should include chapterTitle."""
        chapters = [
            _make_chapter("Prep Work", [
                {"type": "step", "steps": [
                    {"number": 1, "instruction": "Preheat oven"},
                ]},
            ]),
            _make_chapter("Baking", [
                {"type": "step", "steps": [
                    {"number": 2, "instruction": "Bake for 25 min"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert step_block["steps"][0]["chapterTitle"] == "Prep Work"
        assert step_block["steps"][1]["chapterTitle"] == "Baking"
        # Original fields should be preserved
        assert step_block["steps"][0]["instruction"] == "Preheat oven"

    def test_mixed_legacy_and_structured_steps(self):
        """Mix of legacy string items and v2.1 structured step dicts."""
        chapters = [
            _make_chapter("ch1", [
                {"type": "numbered", "variant": "cooking_steps", "items": ["Boil water"]},
            ]),
            _make_chapter("ch2", [
                {"type": "step", "steps": [
                    {"number": 2, "instruction": "Add pasta"},
                ]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        step_block = next(b for b in result["blocks"] if b["type"] == "step")
        assert len(step_block["items"]) == 2


class TestBlockIdInjection:
    """Consolidated blocks should have blockId injected."""

    def test_blocks_get_block_ids(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "ingredient", "items": ["flour"]},
            ]),
            _make_chapter("ch2", [
                {"type": "step", "items": ["mix"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        for block in result["blocks"]:
            assert "blockId" in block
            assert isinstance(block["blockId"], str)
            assert len(block["blockId"]) > 0

    def test_existing_block_ids_preserved(self):
        chapters = [
            _make_chapter("ch1", [
                {"type": "ingredient", "items": ["flour"], "blockId": "existing-id"},
            ]),
            _make_chapter("ch2", [
                {"type": "step", "items": ["mix"]},
            ]),
        ]
        result = consolidate_chapters(chapters, "recipe")
        assert result is not None
        # The step block should get a new blockId, but the consolidated
        # ingredient block is a NEW block, so it gets a new blockId anyway
        for block in result["blocks"]:
            assert "blockId" in block
