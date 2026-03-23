"""VIEResponse v2 — component-addressed tab layout.

Each tab specifies a component name (registry key) and pre-assembled props.
The frontend renders: registry[tab.component](tab.props).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CrossTabLink(BaseModel):
    """A link from one tab to another."""

    target_tab: str = Field(alias="targetTab")
    label: str

    model_config = {"populate_by_name": True}


class TabEntry(BaseModel):
    """A single tab with component-addressed props."""

    model_config = {"populate_by_name": True}

    id: str
    label: str
    emoji: str = ""
    component: str  # Registry key (e.g., "spot_explorer", "checklist")
    props: dict[str, Any] = {}
    cross_tab_links: list[CrossTabLink] = Field([], alias="crossTabLinks")


class VIEResponseMeta(BaseModel):
    """Metadata about the video and its analysis."""

    model_config = {"populate_by_name": True}

    video_id: str = Field("", alias="videoId")
    title: str = ""
    creator: str = ""
    duration: int | None = None
    content_tags: list[str] = Field([], alias="contentTags")
    modifiers: list[str] = []
    primary_tag: str = Field("learning", alias="primaryTag")
    user_goal: str = Field("", alias="userGoal")


class VIEResponseV2(BaseModel):
    """The new component-addressed VIEResponse."""

    model_config = {"populate_by_name": True}

    meta: VIEResponseMeta
    tabs: list[TabEntry] = []
