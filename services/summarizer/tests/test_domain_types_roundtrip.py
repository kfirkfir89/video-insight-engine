"""Round-trip regression tests for domain_types drift (project-score-9 4.1).

The 2026-07-05 audit found live drift between ``packages/types/src/vie-response.ts``
and the Pydantic mirrors in ``domain_types.py``:

- ``TravelSpot`` lacked ``currency``, ``bookingSearch``, ``specs``, ``rating``,
  ``thumbnailUrl`` (all declared on TS ``SpotItem``).
- The food-side ``StepItem`` mirror (``FoodStep``) lacked ``safetyNote`` (and
  ``title``/``thumbnailUrl``).

Undeclared Pydantic fields silently drop on ``model_dump`` — same failure class
as the shipped connections/group data-loss bug (fixed 2026-06-07). Each test
feeds a fixture carrying every TS-declared field through the REAL validation
path (``validate_domain_output``) and asserts the fields survive.
"""

from __future__ import annotations

from src.models.domain_types import (
    FoodData,
    ProjectData,
    TravelData,
    validate_domain_output,
)


class TestTravelSpotRoundTrip:
    """TS SpotItem: cost, currency, duration, mapQuery, bookingSearch, tips,
    specs, rating, thumbnailUrl must all survive travel validation."""

    _SPOT = {
        "name": "Senso-ji Temple",
        "emoji": "⛩️",
        "description": "Tokyo's oldest temple",
        "cost": "Free",
        "currency": "JPY",
        "duration": "1-2 hours",
        "mapQuery": "Senso-ji Temple Tokyo",
        "bookingSearch": "Senso-ji guided tour",
        "tips": "Go early to beat the crowds",
        "specs": "Open 6:00-17:00",
        "rating": 4.7,
        "thumbnailUrl": "https://cdn.example.com/sensoji.jpg",
    }

    def _dump_spot(self) -> dict:
        data = {"itinerary": [{"day": 1, "city": "Tokyo", "spots": [self._SPOT]}]}
        validated = validate_domain_output(["travel"], [], data)
        return validated["travel"]["itinerary"][0]["spots"][0]

    def test_new_fields_survive_validation(self):
        spot = self._dump_spot()
        assert spot["currency"] == "JPY"
        assert spot["bookingSearch"] == "Senso-ji guided tour"
        assert spot["specs"] == "Open 6:00-17:00"
        assert spot["rating"] == 4.7
        assert spot["thumbnailUrl"] == "https://cdn.example.com/sensoji.jpg"

    def test_full_ts_field_set_survives(self):
        spot = self._dump_spot()
        for key, value in self._SPOT.items():
            assert spot[key] == value, f"SpotItem.{key} was dropped or mangled"

    def test_direct_model_round_trip(self):
        data = {"itinerary": [{"day": 1, "spots": [self._SPOT]}]}
        dumped = TravelData.model_validate(data).model_dump(by_alias=True)
        spot = dumped["itinerary"][0]["spots"][0]
        for key, value in self._SPOT.items():
            assert spot[key] == value


class TestStepItemRoundTrip:
    """TS StepItem: safetyNote (audit finding) + title/thumbnailUrl must survive."""

    _FOOD_STEP = {
        "number": 3,
        "title": "Sear the steak",
        "instruction": "Sear 90 seconds per side on high heat",
        "duration": 3,
        "tips": "Pat the steak dry first",
        "safetyNote": "Hot oil spatters — keep the pan lid nearby",
        "timestamp": 245,
        "thumbnailUrl": "https://cdn.example.com/sear.jpg",
    }

    def test_food_step_safety_note_survives(self):
        validated = validate_domain_output(["food"], [], {"steps": [self._FOOD_STEP]})
        step = validated["food"]["steps"][0]
        assert step["safetyNote"] == self._FOOD_STEP["safetyNote"]

    def test_food_step_full_field_set_survives(self):
        dumped = FoodData.model_validate({"steps": [self._FOOD_STEP]}).model_dump(by_alias=True)
        step = dumped["steps"][0]
        for key, value in self._FOOD_STEP.items():
            assert step[key] == value, f"StepItem.{key} was dropped or mangled"

    def test_project_step_safety_note_still_survives(self):
        """Regression guard — ProjectStep already declared safetyNote; keep it that way."""
        data = {
            "projectName": "Bookshelf",
            "steps": [
                {
                    "number": 1,
                    "title": "Cut the boards",
                    "instruction": "Cut four boards to 80cm",
                    "safetyNote": "Wear eye protection",
                    "thumbnailUrl": "https://cdn.example.com/cut.jpg",
                },
            ],
        }
        dumped = ProjectData.model_validate(data).model_dump(by_alias=True)
        step = dumped["steps"][0]
        assert step["safetyNote"] == "Wear eye protection"
        assert step["thumbnailUrl"] == "https://cdn.example.com/cut.jpg"


class TestFoodMetaRoundTrip:
    """TS FoodMeta declares totalTime — surfaced by the 4.2 parity sweep."""

    def test_total_time_survives(self):
        data = {"meta": {"prepTime": 10, "cookTime": 20, "totalTime": 30}}
        dumped = FoodData.model_validate(data).model_dump(by_alias=True)
        assert dumped["meta"]["totalTime"] == 30
