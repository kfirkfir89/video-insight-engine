"""Embedding-model parity tripwire (project-score-9 Phase 7).

The encoder name exists on both sides of the vector store:

- index side: ``EMBEDDING_MODEL_NAME`` in ``services/summarizer/src/config.py``
  (embeds chunks written to Qdrant), and
- query side: ``EMBEDDING_MODEL_NAME`` in the assistant's ``src/config.py``
  (embeds chat/search queries against those chunks).

If the defaults drift, queries are encoded in a different vector space than
the index and every cosine score — including the RAG_MIN_SCORE relevance
floor — becomes meaningless. Same text-level parsing technique as
``test_action_enum_parity.py``: parse the checked-in summarizer source and
compare against the assistant's Pydantic default.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings

_SUMMARIZER_CONFIG = (
    Path(__file__).resolve().parent.parent.parent / "summarizer" / "src" / "config.py"
)


def _summarizer_embedding_default() -> str:
    if not _SUMMARIZER_CONFIG.exists():
        pytest.fail(f"summarizer config not found at {_SUMMARIZER_CONFIG}")
    src = _SUMMARIZER_CONFIG.read_text(encoding="utf-8")
    match = re.search(
        r'EMBEDDING_MODEL_NAME:\s*str\s*=\s*"([^"]+)"',
        src,
    )
    assert match, (
        "EMBEDDING_MODEL_NAME default not found in summarizer config.py — "
        "if its declaration changed shape, update this parser too."
    )
    return match.group(1)


def test_embedding_model_defaults_match_summarizer():
    summarizer_default = _summarizer_embedding_default()
    assistant_default = Settings.model_fields["EMBEDDING_MODEL_NAME"].default
    assert assistant_default == summarizer_default, (
        "Embedding model defaults drifted between services:\n"
        f"  summarizer (index side): {summarizer_default!r}\n"
        f"  assistant  (query side): {assistant_default!r}\n"
        "Queries and indexed chunks MUST use the same encoder or cosine "
        "scores (and the RAG_MIN_SCORE floor) are meaningless. Update BOTH "
        "config defaults together — and remember both services read the same "
        "EMBEDDING_MODEL_NAME env var, so deployments must set it globally."
    )
