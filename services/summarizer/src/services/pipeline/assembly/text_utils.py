"""Shared text helpers for assemblers.

Raw ``s[:N]`` slices cut mid-word with no ellipsis ("Rare, high-cost powe"),
which reads as a rendering bug rather than a truncation. Every user-visible
string cap in assembly goes through :func:`truncate_words` instead.
"""

from __future__ import annotations


def truncate_words(text: str, cap: int) -> str:
    """Truncate to at most ``cap`` chars on a word boundary, with an ellipsis.

    Breaks at the last space before the cap when one exists in the final
    two-thirds of the budget (avoids "a…" degenerate cuts for long words);
    otherwise falls back to a hard cut. Returns short strings unchanged.
    """
    if cap <= 0 or len(text) <= cap:
        return text
    head = text[: cap - 1]
    space = head.rfind(" ")
    if space >= (cap - 1) * 2 // 3:
        head = head[:space]
    return head.rstrip() + "…"
