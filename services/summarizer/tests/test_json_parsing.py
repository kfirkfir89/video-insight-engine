"""Tests for JSON parsing utilities."""

from src.utils.json_parsing import parse_json_response, parse_json_array_response


class TestParseJsonResponse:
    """Tests for parse_json_response (existing behavior)."""

    def test_basic_json_object(self):
        result = parse_json_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_with_surrounding_text(self):
        result = parse_json_response('Here is the result: {"score": 10} done.')
        assert result == {"score": 10}

    def test_fallback_on_invalid(self):
        result = parse_json_response("no json here", {"default": True})
        assert result == {"default": True}

    def test_empty_fallback(self):
        result = parse_json_response("no json here")
        assert result == {}


class TestParseJsonArrayResponse:
    """Tests for parse_json_array_response."""

    def test_parse_json_array_basic(self):
        result = parse_json_array_response('[1, 2, 3]')
        assert result == [1, 2, 3]

    def test_parse_json_array_with_nested_objects(self):
        text = 'Here are the items: [{"name": "foo", "value": 1}, {"name": "bar", "value": 2}]'
        result = parse_json_array_response(text)
        assert len(result) == 2
        assert result[0]["name"] == "foo"
        assert result[1]["name"] == "bar"

    def test_parse_json_array_fallback_on_invalid(self):
        result = parse_json_array_response("no array here", ["fallback"])
        assert result == ["fallback"]

    def test_parse_json_array_fallback_default(self):
        result = parse_json_array_response("no array here")
        assert result == []

    def test_parse_json_array_ignores_preceding_object(self):
        text = '{"ignore": true} then [{"a": 1}]'
        result = parse_json_array_response(text)
        assert result == [{"a": 1}]

    def test_parse_json_array_nested_arrays(self):
        text = '[[1, 2], [3, 4]]'
        result = parse_json_array_response(text)
        assert result == [[1, 2], [3, 4]]

    def test_parse_json_array_with_strings_containing_brackets(self):
        text = '[{"text": "use [brackets] carefully"}]'
        result = parse_json_array_response(text)
        assert result == [{"text": "use [brackets] carefully"}]
