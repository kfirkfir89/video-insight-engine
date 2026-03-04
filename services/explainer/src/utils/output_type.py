"""Output type labels and framing hints for explainer prompts.

Keys MUST match the summarizer's OutputType values in:
  services/summarizer/src/services/output_type.py
"""

# Maps outputType → (human label, framing hint for LLM prompts)
OUTPUT_TYPE_LABELS: dict[str, tuple[str, str]] = {
    "summary": ("Summary", "Frame explanations around the video's main points and arguments"),
    "recipe": ("Recipe", "Frame explanations around cooking steps, ingredients, and techniques"),
    "tutorial": ("Tutorial", "Frame explanations around instructions, procedures, and learning objectives"),
    "workout": ("Workout Plan", "Frame explanations around exercises, form cues, and training goals"),
    "study_guide": ("Study Guide", "Frame explanations around academic concepts, theories, and key takeaways"),
    "travel_plan": ("Travel Plan", "Frame explanations around destinations, logistics, and experiences"),
    "review": ("Review", "Frame explanations around evaluations, comparisons, and recommendations"),
    "podcast_notes": ("Podcast Notes", "Frame explanations around perspectives, questions, and insights shared"),
    "diy_guide": ("DIY Guide", "Frame explanations around materials, steps, and techniques"),
    "game_guide": ("Game Guide", "Frame explanations around mechanics, strategies, and progression"),
    "music_guide": ("Music Guide", "Frame explanations around musical elements, lyrics, and artistic choices"),
}

# Default for unknown output types
_DEFAULT_LABEL = OUTPUT_TYPE_LABELS["summary"]


def get_output_type_label(output_type: str) -> str:
    """Get the human-readable label for an output type."""
    return OUTPUT_TYPE_LABELS.get(output_type, _DEFAULT_LABEL)[0]


def get_output_type_hint(output_type: str) -> str:
    """Get the framing hint for an output type."""
    return OUTPUT_TYPE_LABELS.get(output_type, _DEFAULT_LABEL)[1]
