"""Shared constants for vie-summarizer."""

import re

# Strict 11-character YouTube video ID pattern.
# Used for URL validation before subprocess calls and frame extraction.
YOUTUBE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# Generic quote attributions that should be replaced with highlight variant.
# LLMs often fabricate attributions like "Expert Name" or "Speaker" instead of
# using real names. These are caught post-generation by enforce_block_diversity().
GENERIC_ATTRIBUTIONS = frozenset([
    "expert name", "speaker", "engineer", "host", "expert",
    "the speaker", "the host", "interviewee", "presenter",
    "expert speaker", "engineering lead",
])
