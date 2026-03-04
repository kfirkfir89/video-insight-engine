"""Output type determination from video category.

Category = content classification ("cooking", "coding") — used for detection.
OutputType = what the system produces ("recipe", "tutorial") — used for prompts + UI.

They map 1:1 today but are separate concerns that could diverge.
"""

from typing import Literal

# All valid output types produced by the summarizer
OutputType = Literal[
    "recipe",
    "tutorial",
    "workout",
    "study_guide",
    "travel_plan",
    "review",
    "podcast_notes",
    "diy_guide",
    "game_guide",
    "music_guide",
    "summary",
]

# Maps detected category → output type
CATEGORY_TO_OUTPUT_TYPE: dict[str, str] = {
    "cooking": "recipe",
    "coding": "tutorial",
    "fitness": "workout",
    "education": "study_guide",
    "travel": "travel_plan",
    "reviews": "review",
    "podcast": "podcast_notes",
    "diy": "diy_guide",
    "gaming": "game_guide",
    "music": "music_guide",
}

DEFAULT_OUTPUT_TYPE = "summary"

# Human-readable labels for UI display
OUTPUT_TYPE_LABELS: dict[str, str] = {
    "recipe": "Recipe",
    "tutorial": "Tutorial",
    "workout": "Workout Plan",
    "study_guide": "Study Guide",
    "travel_plan": "Travel Plan",
    "review": "Review",
    "podcast_notes": "Podcast Notes",
    "diy_guide": "DIY Guide",
    "game_guide": "Game Guide",
    "music_guide": "Music Guide",
    "summary": "Summary",
}


def determine_output_type(category: str) -> str:
    """Map a video category to its output type.

    Args:
        category: Detected video category (e.g. "cooking", "coding").

    Returns:
        Output type string (e.g. "recipe", "tutorial").
        Defaults to "summary" for unknown categories.
    """
    if not category:
        return DEFAULT_OUTPUT_TYPE
    return CATEGORY_TO_OUTPUT_TYPE.get(category, DEFAULT_OUTPUT_TYPE)


def get_output_type_label(output_type: str) -> str:
    """Get human-readable label for an output type.

    Args:
        output_type: Output type string (e.g. "recipe").

    Returns:
        Display label (e.g. "Recipe"). Defaults to title-cased input.
    """
    return OUTPUT_TYPE_LABELS.get(output_type, output_type.replace("_", " ").title())
