"""Helper functions for extracting structured data from video documents."""

from __future__ import annotations


def extract_title(doc: dict) -> str:
    """Extract video title from a MongoDB document."""
    return doc.get("title", "")


def extract_creator(doc: dict) -> str:
    """Extract creator name from a MongoDB document."""
    return doc.get("creator", "")


def extract_summary(doc: dict) -> str:
    """Extract summary text from a MongoDB document.

    Looks in synthesis.summary first, falls back to output.summary.
    """
    synthesis = doc.get("synthesis")
    if isinstance(synthesis, dict):
        summary = synthesis.get("summary", "")
        if summary:
            return summary

    output = doc.get("output")
    if isinstance(output, dict):
        return output.get("summary", "")

    return ""


def extract_takeaways(doc: dict) -> list[str]:
    """Extract takeaway strings from a MongoDB document."""
    synthesis = doc.get("synthesis")
    if isinstance(synthesis, dict):
        raw = synthesis.get("takeaways", [])
        if isinstance(raw, list):
            return [str(t) for t in raw if t]
    return []


def extract_tabs_overview(doc: dict) -> list[dict]:
    """Extract tab overview data from a MongoDB document.

    Prefers v2 assembledTabs, falls back to triage.tabs.
    """
    assembled = doc.get("assembledTabs")
    if assembled and isinstance(assembled, list):
        return [
            {"id": t.get("id", ""), "label": t.get("label", ""), "emoji": t.get("emoji", "")}
            for t in assembled
            if isinstance(t, dict)
        ]

    triage = doc.get("triage")
    if isinstance(triage, dict):
        tabs = triage.get("tabs", [])
        if isinstance(tabs, list):
            return [
                {"id": t.get("id", ""), "label": t.get("label", ""), "emoji": t.get("emoji", "")}
                for t in tabs
                if isinstance(t, dict)
            ]

    return []


def format_tab_label(tab: dict) -> str:
    """Format a tab dict into a human-readable label string."""
    emoji = tab.get("emoji", "")
    label = tab.get("label", tab.get("id", "unknown"))
    if emoji:
        return f"{emoji} {label}"
    return label
