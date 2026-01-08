"""LLM service for vie-explainer using Anthropic Claude."""

from pathlib import Path

import anthropic

from src.config import settings

# Anthropic client
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Prompts directory
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file.

    Args:
        name: Name of the prompt file (without .txt extension)

    Returns:
        Contents of the prompt template file
    """
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


async def generate_expansion(template_name: str, context: dict) -> str:
    """Generate expansion using template.

    Args:
        template_name: Name of the prompt template to use
        context: Dictionary of variables to substitute in template

    Returns:
        Generated markdown content from Claude
    """
    template = load_prompt(template_name)

    # Format bullets if present (convert list to string)
    if "bullets" in context and isinstance(context["bullets"], list):
        context = {**context, "bullets": "\n".join(f"- {b}" for b in context["bullets"])}

    prompt = template.format(**context)

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text


async def chat_completion(system_prompt: str, messages: list[dict]) -> str:
    """Complete chat with context.

    Args:
        system_prompt: System prompt with context about the memorized item
        messages: List of message dicts with 'role' and 'content'

    Returns:
        Assistant's response text
    """
    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text
