"""Tests for usage route helper functions.

These test the pure extraction/serialization helpers, not the async route handlers
(which are covered by E2E Playwright tests).
"""

from datetime import UTC, datetime

from bson import ObjectId

from src.routes.usage import _serialize_doc, _serialize_value


class TestSerializeValue:
    """_serialize_value handles all MongoDB types recursively."""

    def test_objectid(self):
        oid = ObjectId("507f1f77bcf86cd799439011")
        assert _serialize_value(oid) == "507f1f77bcf86cd799439011"

    def test_datetime(self):
        dt = datetime(2026, 3, 1, 12, 0, 0, tzinfo=UTC)
        assert _serialize_value(dt) == "2026-03-01T12:00:00+00:00"

    def test_nested_dict(self):
        doc = {"_id": ObjectId("507f1f77bcf86cd799439011"), "name": "test"}
        result = _serialize_value(doc)
        assert result == {"_id": "507f1f77bcf86cd799439011", "name": "test"}

    def test_list_with_mixed_types(self):
        items = [
            ObjectId("507f1f77bcf86cd799439011"),
            datetime(2026, 1, 1, tzinfo=UTC),
            "plain",
            42,
        ]
        result = _serialize_value(items)
        assert result == [
            "507f1f77bcf86cd799439011",
            "2026-01-01T00:00:00+00:00",
            "plain",
            42,
        ]

    def test_list_of_dicts(self):
        items = [
            {"_id": ObjectId("507f1f77bcf86cd799439011"), "v": 1},
            {"_id": ObjectId("607f1f77bcf86cd799439012"), "v": 2},
        ]
        result = _serialize_value(items)
        assert result[0]["_id"] == "507f1f77bcf86cd799439011"
        assert result[1]["_id"] == "607f1f77bcf86cd799439012"

    def test_plain_values_passthrough(self):
        assert _serialize_value("hello") == "hello"
        assert _serialize_value(42) == 42
        assert _serialize_value(3.14) == 3.14
        assert _serialize_value(None) is None
        assert _serialize_value(True) is True


class TestSerializeDoc:
    """_serialize_doc handles full MongoDB documents."""

    def test_full_document(self):
        doc = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "timestamp": datetime(2026, 3, 1, tzinfo=UTC),
            "model": "claude-sonnet-4-20250514",
            "cost_usd": 0.05,
            "tags": ["a", "b"],
        }
        result = _serialize_doc(doc)
        assert result["_id"] == "507f1f77bcf86cd799439011"
        assert result["timestamp"] == "2026-03-01T00:00:00+00:00"
        assert result["model"] == "claude-sonnet-4-20250514"
        assert result["cost_usd"] == 0.05
        assert result["tags"] == ["a", "b"]

    def test_nested_list_of_subdocuments(self):
        """Regression: lists of subdocuments with ObjectIds must serialize."""
        doc = {
            "calls": [
                {"_id": ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"), "ts": datetime(2026, 1, 1, tzinfo=UTC)},
                {"_id": ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"), "ts": datetime(2026, 1, 2, tzinfo=UTC)},
            ]
        }
        result = _serialize_doc(doc)
        assert result["calls"][0]["_id"] == "aaaaaaaaaaaaaaaaaaaaaaaa"
        assert result["calls"][1]["ts"] == "2026-01-02T00:00:00+00:00"
