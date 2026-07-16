"""Round-trip regression tests for TabEntry drift (project-score-9 4.1).

The 2026-07-05 audit found ``TabEntry`` in ``vie_response_v2.py`` lacked the
``goal`` and ``attachments`` fields declared on the TS side
(``packages/types/src/vie-response.ts``). Undeclared Pydantic fields silently
drop on ``model_dump`` — the same failure class as the shipped
connections/group data-loss bug (fixed 2026-06-07). These tests feed a fixture
carrying every TS-declared TabEntry field through validate → dump and assert
nothing is lost.
"""

from __future__ import annotations

from src.models.vie_response_v2 import TabEntry, VIEResponseMeta, VIEResponseV2

_FIXTURE = {
    "id": "spots",
    "label": "12 Spots",
    "emoji": "📍",
    "component": "spot_explorer",
    "props": {"spots": [{"name": "Louvre"}]},
    "goal": "Explore every stop on the itinerary",
    "crossTabLinks": [{"targetTab": "budget", "label": "See the budget"}],
    "attachments": [
        {
            "slot": "top",
            "component": "summary_header",
            "props": {"summary": "One-line orientation"},
            "size": "banner",
        },
    ],
}


class TestTabEntryRoundTrip:
    """TS TabEntry: id, label, emoji, component, props, goal, crossTabLinks, attachments."""

    def test_goal_survives_model_dump(self):
        dumped = TabEntry.model_validate(_FIXTURE).model_dump(by_alias=True)
        assert dumped["goal"] == "Explore every stop on the itinerary"

    def test_attachments_survive_model_dump(self):
        dumped = TabEntry.model_validate(_FIXTURE).model_dump(by_alias=True)
        assert dumped["attachments"] == _FIXTURE["attachments"]

    def test_full_fixture_survives_intact(self):
        dumped = TabEntry.model_validate(_FIXTURE).model_dump(by_alias=True)
        for key, value in _FIXTURE.items():
            assert dumped[key] == value, f"TabEntry.{key} was dropped or mangled"

    def test_attachments_default_to_none_for_flat_tabs(self):
        flat = {k: v for k, v in _FIXTURE.items() if k != "attachments"}
        dumped = TabEntry.model_validate(flat).model_dump(by_alias=True)
        assert dumped["attachments"] is None

    def test_envelope_round_trip(self):
        envelope = {"meta": {"videoId": "abc123def45"}, "tabs": [_FIXTURE]}
        dumped = VIEResponseV2.model_validate(envelope).model_dump(by_alias=True)
        assert dumped["tabs"][0]["goal"] == _FIXTURE["goal"]
        assert dumped["tabs"][0]["attachments"] == _FIXTURE["attachments"]


class TestVIEResponseMetaRoundTrip:
    """TS VIEResponseMeta gained `degraded` (3.6) and always declared the
    synthesis block (tldr/keyTakeaways/masterSummary/seoDescription) plus
    language/isRTL — the Pydantic mirror must not silently drop any of them."""

    _META_FIXTURE = {
        "videoId": "abc123def45",
        "videoTitle": "How to Make Ramen",
        "creator": "Chef Channel",
        "contentTags": ["food"],
        "modifiers": [],
        "primaryTag": "food",
        "userGoal": "Cook it tonight",
        "tldr": "Quick ramen at home.",
        "keyTakeaways": ["Use fresh noodles"],
        "masterSummary": "Long-form summary...",
        "seoDescription": "Learn ramen fast.",
        "language": "en",
        "isRTL": False,
        "degraded": True,
    }

    def test_degraded_survives_model_dump(self):
        dumped = VIEResponseMeta.model_validate(self._META_FIXTURE).model_dump(by_alias=True)
        assert dumped["degraded"] is True

    def test_full_ts_field_set_survives(self):
        dumped = VIEResponseMeta.model_validate(self._META_FIXTURE).model_dump(by_alias=True)
        for key, value in self._META_FIXTURE.items():
            assert dumped[key] == value, f"VIEResponseMeta.{key} was dropped or mangled"
