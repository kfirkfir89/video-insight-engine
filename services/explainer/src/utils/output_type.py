"""Output type labels and framing hints for explainer prompts.

Keys match the canonical OutputType values in:
  packages/types/src/output-types.ts
  services/summarizer/src/models/output_types.py
"""

# Maps outputType → (human label, framing hint for LLM prompts)
OUTPUT_TYPE_LABELS: dict[str, tuple[str, str]] = {
    # Canonical names (intent-driven pipeline)
    "explanation": ("Explanation", "Frame explanations around the video's main points and arguments"),
    "recipe": ("Recipe", "Frame explanations around cooking steps, ingredients, and techniques"),
    "code_walkthrough": ("Code Walkthrough", "Frame explanations around code, architecture, and implementation details"),
    "study_kit": ("Study Kit", "Frame explanations around academic concepts, theories, and key takeaways"),
    "trip_planner": ("Trip Planner", "Frame explanations around destinations, logistics, and experiences"),
    "workout": ("Workout Plan", "Frame explanations around exercises, form cues, and training goals"),
    "verdict": ("Verdict", "Frame explanations around evaluations, comparisons, and recommendations"),
    "highlights": ("Highlights", "Frame explanations around perspectives, questions, and insights shared"),
    "music_guide": ("Music Guide", "Frame explanations around musical elements, lyrics, and artistic choices"),
    "project_guide": ("Project Guide", "Frame explanations around materials, steps, and techniques"),
}

# Default for unknown output types
_DEFAULT_LABEL = OUTPUT_TYPE_LABELS["explanation"]


def get_output_type_label(output_type: str) -> str:
    """Get the human-readable label for an output type."""
    return OUTPUT_TYPE_LABELS.get(output_type, _DEFAULT_LABEL)[0]


def get_output_type_hint(output_type: str) -> str:
    """Get the framing hint for an output type."""
    return OUTPUT_TYPE_LABELS.get(output_type, _DEFAULT_LABEL)[1]
