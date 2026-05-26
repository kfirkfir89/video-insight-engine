"""Language detection and utility functions for multi-language pipeline support."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ISO 639-1 codes for right-to-left languages
RTL_LANGUAGES = frozenset({"he", "ar", "fa", "ur", "yi"})

# ISO 639-1 language name mapping (common languages)
_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "he": "Hebrew",
    "ar": "Arabic",
    "fa": "Persian",
    "ur": "Urdu",
    "yi": "Yiddish",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "hi": "Hindi",
    "tr": "Turkish",
    "pl": "Polish",
    "nl": "Dutch",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
    "el": "Greek",
    "cs": "Czech",
    "ro": "Romanian",
    "hu": "Hungarian",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "ms": "Malay",
    "uk": "Ukrainian",
    "bg": "Bulgarian",
    "hr": "Croatian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "lt": "Lithuanian",
    "lv": "Latvian",
    "et": "Estonian",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "ml": "Malayalam",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "sw": "Swahili",
    "af": "Afrikaans",
    "ca": "Catalan",
    "eu": "Basque",
    "gl": "Galician",
    "sr": "Serbian",
}


def is_rtl(language: str) -> bool:
    """Check if a language code is RTL."""
    return language in RTL_LANGUAGES


def is_sound_only_video(
    is_music: bool,
    language: str | None,
    raw_text: str,
    duration: int,
    wps_threshold: float,
) -> bool:
    """True when a music-category video has essentially no speech.

    A music video with a few hallucinated words across many minutes is almost
    always instrumental (trance, opera passages, ambient, piano sonata). Vocal
    songs sit well above the threshold because Whisper transcribes real lyrics.
    """
    if not is_music or not language or language == "en":
        return False
    word_count = len(raw_text.split())
    safe_duration = max(duration or 1, 1)
    return (word_count / safe_duration) < wps_threshold


def get_language_name(code: str) -> str:
    """Get human-readable language name from ISO 639-1 code."""
    return _LANGUAGE_NAMES.get(code, code.upper())


def normalize_language_code(raw: str | None) -> str | None:
    """Normalize a language code to 2-letter ISO 639-1.

    Handles codes like 'en-US', 'zh-Hans', 'pt-BR', etc.
    Returns None for empty/invalid input.
    """
    if not raw:
        return None
    # Take first 2 chars, lowercase
    code = raw.strip().lower()[:2]
    if len(code) == 2 and code.isalpha():
        return code
    return None


def detect_language_from_text(text: str) -> str | None:
    """Detect language from text using langdetect library.

    Returns ISO 639-1 code or None on failure.
    Falls back to None if langdetect is not installed or detection fails.
    """
    if not text or len(text.strip()) < 50:
        return None

    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0  # Deterministic results
        code = detect(text[:5000])
        return normalize_language_code(code)
    except ImportError:
        logger.debug("langdetect not installed, skipping text-based language detection")
        return None
    except Exception as e:
        logger.debug("Language detection failed: %s", e)
        return None


def build_language_instruction(language: str) -> str:
    """Build a language instruction string for LLM prompts.

    Returns empty string for English (no extra instruction needed).
    For other languages, returns instruction to produce content in that language.
    """
    if language == "en":
        return ""

    name = get_language_name(language)
    return (
        f"IMPORTANT — LANGUAGE INSTRUCTION: This video is in {name}. "
        f"All content values (titles, descriptions, tips, names, labels) MUST be in {name}. "
        f"JSON field names and tab IDs MUST stay in English. "
        f"Do NOT translate content to English — keep it in the original {name}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Character-set heuristic (fast, no external dependency)
# ─────────────────────────────────────────────────────────────────────────────

# Regex patterns for script detection
_HEBREW_RE = re.compile(r"[\u0590-\u05FF]")
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
_CJK_RE = re.compile(r"[\u4E00-\u9FFF\u3400-\u4DBF]")
_HANGUL_RE = re.compile(r"[\uAC00-\uD7AF\u1100-\u11FF]")
_HIRAGANA_KATAKANA_RE = re.compile(r"[\u3040-\u309F\u30A0-\u30FF]")
_CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_THAI_RE = re.compile(r"[\u0E00-\u0E7F]")


def detect_language_by_script(text: str) -> str | None:
    """Fast script-based language detection using Unicode ranges.

    Less accurate than langdetect but zero dependencies and instant.
    Returns ISO 639-1 code or None if cannot determine.
    """
    if not text or len(text) < 20:
        return None

    sample = text[:3000]
    total = len(sample)

    checks: list[tuple[re.Pattern, str]] = [
        (_HEBREW_RE, "he"),
        (_ARABIC_RE, "ar"),
        (_CJK_RE, "zh"),
        (_HANGUL_RE, "ko"),
        (_HIRAGANA_KATAKANA_RE, "ja"),
        (_CYRILLIC_RE, "ru"),
        (_DEVANAGARI_RE, "hi"),
        (_THAI_RE, "th"),
    ]

    for pattern, lang in checks:
        matches = len(pattern.findall(sample))
        if matches / max(total, 1) > 0.1:
            return lang

    return None
