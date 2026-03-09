"""Per-output-type accuracy rules extracted from persona completeness guidelines.

Each output type has domain-specific rules that enforce completeness and
fidelity. These are injected into extraction prompts via {accuracy_rules}.
"""

# Mapping from output_type to domain-specific accuracy rules.
# Generic rules live in prompts/accuracy_rules.txt — these ADD type-specific constraints.
ACCURACY_RULES: dict[str, str] = {
    "explanation": (
        "- MUST include ALL key concepts, definitions, and examples\n"
        "- Preserve teaching progression: if concept A is built before B, maintain that order\n"
        "- Keep ALL analogies and examples — they are teaching tools, not decoration\n"
        "- Preserve exact terminology: if they say 'polymorphism' don't write 'code flexibility'\n"
        "- Include ALL items when the speaker enumerates: 'there are 5 types...' → list all 5\n"
        "- Definition blocks must use the instructor's actual definition, not your paraphrase"
    ),
    "recipe": (
        "- MUST include ALL ingredients with EXACT measurements — a missing ingredient makes the recipe useless\n"
        "- MUST include ALL preparation steps in exact order — rearranging steps ruins the recipe\n"
        "- ALL temperatures with units: '375°F' or '190°C' — never 'medium heat' if specific temp given\n"
        "- ALL timing with specifics: 'bake 25-30 minutes' not 'bake until done'\n"
        "- Preserve the chef's specific tips: 'fold, don't stir' not 'mix gently'\n"
        "- Servings/yield must match what the chef states"
    ),
    "code_walkthrough": (
        "- MUST include ALL code snippets and ALL commands shown in the video\n"
        "- Preserve EXACT variable names, function names, class names, and imports\n"
        "- Include actual output/console results when shown, not approximations\n"
        "- Package names must be exact: 'express' not 'Express.js framework'\n"
        "- Version numbers must be preserved: 'React 18' not 'latest React'\n"
        "- Error messages should be quoted exactly when discussed\n"
        "- Every step should be reproducible — no skipping 'obvious' setup"
    ),
    "study_kit": (
        "- MUST include ALL key concepts, definitions, and examples\n"
        "- Preserve the teaching progression: if the instructor builds concept A before B, maintain that order\n"
        "- Keep ALL analogies and examples — they are the instructor's teaching tools\n"
        "- Preserve exact terminology: if they say 'polymorphism' don't write 'code flexibility'\n"
        "- Include ALL items when the instructor enumerates: 'there are 5 types...' → list all 5\n"
        "- Definition blocks must use the instructor's actual definition, not your paraphrase"
    ),
    "trip_planner": (
        "- MUST include ALL locations, costs, and transportation details\n"
        "- Location names must be exact: 'Shibuya Crossing' not 'a famous crossing in Tokyo'\n"
        "- ALL prices with currency: '¥1,500 ($10)' not 'inexpensive'\n"
        "- Hours of operation when mentioned: 'open 9am-6pm' not 'daytime hours'\n"
        "- Transportation details: 'JR Yamanote Line, ¥170' not 'take the train'\n"
        "- Distances and travel times: '20 min walk' or '3 stops on the metro'\n"
        "- Reservation requirements when mentioned: 'book 2 weeks ahead'"
    ),
    "workout": (
        "- MUST include ALL exercises with sets, reps, and rest periods\n"
        "- Exercise names must be exact: 'Bulgarian Split Squats' not 'single-leg squats'\n"
        "- Form cues must be preserved: 'keep elbows at 45 degrees' not 'keep arms bent'\n"
        "- Include ALL modifications mentioned (beginner/advanced alternatives)\n"
        "- Tempo when specified: '3 seconds down, 1 second up'\n"
        "- Weight recommendations when given: 'start with 10-15 lbs'\n"
        "- Warm-up and cooldown must be included if the instructor covers them"
    ),
    "verdict": (
        "- MUST include ALL pros AND cons — never drop cons to soften the review\n"
        "- ALL specs with actual numbers: '6.7-inch AMOLED, 120Hz' not 'large display'\n"
        "- Exact prices: '$999' not 'premium price point'\n"
        "- Exact ratings/scores: '8.5/10' not 'highly rated'\n"
        "- Comparison specs must use real values: '5000mAh vs 4500mAh' not 'bigger battery'\n"
        "- Preserve the reviewer's verdict: if they say 'skip it', don't soften\n"
        "- Include model numbers and specific product names exactly"
    ),
    "highlights": (
        "- WHO said WHAT: always attribute statements to the correct speaker\n"
        "- Use verbatim quotes for impactful statements — don't paraphrase memorable lines\n"
        "- Guest credentials must be preserved: 'CEO of Stripe' not 'tech executive'\n"
        "- ALL topics discussed must be represented — don't skip topics\n"
        "- Preserve the conversational flow: if guest disagrees with host, capture that dynamic\n"
        "- Numbers and claims must be attributed: 'According to [guest], revenue grew 300%'"
    ),
    "music_guide": (
        "- Lyrics must be accurate — quote exactly or don't quote at all\n"
        "- ALL credits: featured artists, producers, songwriters when mentioned\n"
        "- Genre must be specific: 'melodic trap' not just 'hip-hop'\n"
        "- Production details when discussed: '808 bass', 'auto-tune', 'live drums'\n"
        "- Album/EP name and release info when mentioned\n"
        "- Samples and interpolations when identified: 'samples [song] by [artist]'\n"
        "- Chart positions and streaming numbers when cited"
    ),
    "project_guide": (
        "- MUST include ALL materials, tools, and safety warnings\n"
        "- Measurements must be exact: '2x4 lumber, 8 feet' not 'some wood'\n"
        "- ALL steps in correct order with specific details\n"
        "- Tool specifications when given: '#2 Phillips screwdriver' not 'a screwdriver'\n"
        "- Safety warnings must be preserved verbatim\n"
        "- Time estimates for each step when mentioned"
    ),
}


def get_accuracy_rules(output_type: str) -> str:
    """Get domain-specific accuracy rules for an output type.

    Returns type-specific rules if available, empty string otherwise.
    Generic accuracy rules from accuracy_rules.txt are loaded separately.
    """
    return ACCURACY_RULES.get(output_type, "")
