import json
import uuid
from pathlib import Path
from typing import Optional

import anthropic

from src.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def detect_sections(transcript: str, segments: list[dict]) -> list[dict]:
    """Detect logical sections in transcript."""
    prompt = load_prompt("section_detect").format(
        transcript=transcript[:15000]  # Token limit
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    # Parse JSON from response
    try:
        # Find JSON in response
        start = text.find("{")
        end = text.rfind("}") + 1
        data = json.loads(text[start:end])
        return data.get("sections", [])
    except json.JSONDecodeError:
        # Fallback: single section
        return [{
            "title": "Full Video",
            "startSeconds": 0,
            "endSeconds": int(segments[-1]["start"] + segments[-1]["duration"]) if segments else 0
        }]


def summarize_section(section_text: str, title: str) -> dict:
    """Generate summary and bullets for a section."""
    prompt = load_prompt("section_summary").format(
        title=title,
        content=section_text[:8000]
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {"summary": text, "bullets": []}


def extract_concepts(transcript: str) -> list[dict]:
    """Extract key concepts from transcript."""
    prompt = load_prompt("concept_extract").format(
        transcript=transcript[:15000]
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        data = json.loads(text[start:end])
        return data.get("concepts", [])
    except json.JSONDecodeError:
        return []


def synthesize_summary(sections: list[dict], concepts: list[dict]) -> dict:
    """Generate TLDR and key takeaways."""
    sections_text = "\n".join([
        f"- {s['title']}: {s.get('summary', '')}" for s in sections
    ])
    concepts_text = ", ".join([c["name"] for c in concepts])

    prompt = load_prompt("global_synthesis").format(
        sections=sections_text,
        concepts=concepts_text
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {"tldr": text[:500], "keyTakeaways": []}


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to MM:SS format."""
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def process_video(
    transcript: str,
    segments: list[dict],
    on_progress: Optional[callable] = None
) -> dict:
    """Full LLM processing pipeline."""

    if on_progress:
        on_progress(10, "Detecting sections...")

    # 1. Detect sections
    raw_sections = detect_sections(transcript, segments)

    if on_progress:
        on_progress(30, "Summarizing sections...")

    # 2. Summarize each section
    sections = []
    for i, raw in enumerate(raw_sections):
        # Get section text from segments
        start = raw.get("startSeconds", 0)
        end = raw.get("endSeconds", start + 300)

        section_segments = [
            s for s in segments
            if start <= s["start"] <= end
        ]
        section_text = " ".join([s["text"] for s in section_segments])

        summary_data = summarize_section(section_text, raw["title"])

        sections.append({
            "id": str(uuid.uuid4()),
            "timestamp": seconds_to_timestamp(start),
            "start_seconds": start,
            "end_seconds": end,
            "title": raw["title"],
            "summary": summary_data.get("summary", ""),
            "bullets": summary_data.get("bullets", []),
        })

        if on_progress:
            progress = 30 + int((i + 1) / len(raw_sections) * 40)
            on_progress(progress, f"Summarizing section {i + 1}/{len(raw_sections)}...")

    if on_progress:
        on_progress(70, "Extracting concepts...")

    # 3. Extract concepts
    raw_concepts = extract_concepts(transcript)
    concepts = [
        {
            "id": str(uuid.uuid4()),
            "name": c["name"],
            "definition": c.get("definition"),
            "timestamp": c.get("timestamp"),
        }
        for c in raw_concepts
    ]

    if on_progress:
        on_progress(90, "Generating summary...")

    # 4. Synthesize
    synthesis = synthesize_summary(sections, concepts)

    return {
        "tldr": synthesis.get("tldr", ""),
        "key_takeaways": synthesis.get("keyTakeaways", []),
        "sections": sections,
        "concepts": concepts,
    }
