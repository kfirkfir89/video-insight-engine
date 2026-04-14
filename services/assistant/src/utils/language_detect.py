"""Language detection utility for the assistant service."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


def detect_language(text: str) -> str:
    """Detect language of text, returning ISO 639-1 code.

    Uses langdetect library if available, falls back to script-based detection.
    Returns "en" as default if detection fails or text is too short.
    """
    if not text or len(text.strip()) < 10:
        return "en"

    # Try langdetect first
    try:
        from langdetect import detect
        code = detect(text[:2000])
        if code and len(code) >= 2:
            return code[:2].lower()
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: script-based detection
    lang = _detect_by_script(text)
    return lang or "en"


# ─────────────────────────────────────────────────────────────────────────────
# Script-based detection (zero dependencies)
# ─────────────────────────────────────────────────────────────────────────────

_HEBREW_RE = re.compile(r"[\u0590-\u05FF]")
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
_CJK_RE = re.compile(r"[\u4E00-\u9FFF\u3400-\u4DBF]")
_HANGUL_RE = re.compile(r"[\uAC00-\uD7AF\u1100-\u11FF]")
_HIRAGANA_KATAKANA_RE = re.compile(r"[\u3040-\u309F\u30A0-\u30FF]")
_CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")


def _detect_by_script(text: str) -> str | None:
    """Detect language from Unicode script ranges."""
    sample = text[:2000]
    total = max(len(sample), 1)

    checks = [
        (_HEBREW_RE, "he"),
        (_ARABIC_RE, "ar"),
        (_CJK_RE, "zh"),
        (_HANGUL_RE, "ko"),
        (_HIRAGANA_KATAKANA_RE, "ja"),
        (_CYRILLIC_RE, "ru"),
    ]

    for pattern, lang in checks:
        if len(pattern.findall(sample)) / total > 0.1:
            return lang

    return None
