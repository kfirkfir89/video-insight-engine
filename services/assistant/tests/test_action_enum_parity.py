"""Action-enum parity test (project-score-9 4.2b).

The assistant action channel's canonical action list exists twice:

- TS: ``ASSISTANT_ACTIONS`` in ``api/src/services/assistant-client.ts``
  (drives the AssistantAction union + every route Zod enum), and
- Python: the ``ActionName`` Literal in ``src/models/requests.py``
  (drives request validation + the dispatcher).

The 2026-07-05 audit flagged that nothing machine-checks the two lists. This
test parses the checked-in TS array (order-sensitive) and compares it to the
Literal — any drift (add/remove/rename/reorder) fails CI on the Python side.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import get_args

import pytest

from src.models.requests import ActionName

_ASSISTANT_CLIENT_TS = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "api"
    / "src"
    / "services"
    / "assistant-client.ts"
)


def _ts_actions() -> list[str]:
    if not _ASSISTANT_CLIENT_TS.exists():
        pytest.fail(f"assistant-client.ts not found at {_ASSISTANT_CLIENT_TS}")
    src = _ASSISTANT_CLIENT_TS.read_text(encoding="utf-8")
    match = re.search(
        r"export const ASSISTANT_ACTIONS\s*=\s*\[(.*?)\]\s*as const",
        src,
        re.DOTALL,
    )
    assert match, "ASSISTANT_ACTIONS array not found in assistant-client.ts"
    return re.findall(r"'([a-z_]+)'", match.group(1))


def test_action_lists_match_exactly():
    ts_actions = _ts_actions()
    py_actions = list(get_args(ActionName))
    assert ts_actions == py_actions, (
        "assistant action enums drifted:\n"
        f"  TS  (assistant-client.ts): {ts_actions}\n"
        f"  PY  (requests.py Literal): {py_actions}\n"
        "Update BOTH sides together — the action channel validates against "
        "each independently."
    )


def test_eleven_actions_expected():
    """The audit-era contract is exactly 11 actions. Growing the list is fine —
    bump this count deliberately in the same change that adds the action."""
    assert len(list(get_args(ActionName))) == 11
