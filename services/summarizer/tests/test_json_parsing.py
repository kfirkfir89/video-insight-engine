"""Tests for JSON parsing utilities."""

from src.utils.json_parsing import (
    parse_json_response,
    parse_json_array_response,
    _strip_json_comments,
)


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


class TestStripJsonComments:
    """Tests for _strip_json_comments."""

    def test_strips_line_comment(self):
        text = '{"key": "value" // this is a comment\n}'
        result = _strip_json_comments(text)
        assert result == '{"key": "value" \n}'

    def test_preserves_url_in_string(self):
        text = '{"url": "https://example.com/path"}'
        result = _strip_json_comments(text)
        assert result == text

    def test_strips_multiple_comments(self):
        text = '{\n  "a": 1, // first\n  "b": 2  // second\n}'
        result = _strip_json_comments(text)
        assert '"a": 1,' in result
        assert '"b": 2' in result
        assert "first" not in result
        assert "second" not in result

    def test_strips_comment_only_lines(self):
        text = '{\n  // this is a full-line comment\n  "key": "val"\n}'
        result = _strip_json_comments(text)
        assert "full-line comment" not in result
        assert '"key": "val"' in result

    def test_no_comments_unchanged(self):
        text = '{"key": "value", "num": 42}'
        assert _strip_json_comments(text) == text

    def test_comment_at_end_of_text(self):
        text = '{"key": "value"} // trailing'
        result = _strip_json_comments(text)
        assert result == '{"key": "value"} '

    def test_double_slash_inside_string_preserved(self):
        text = '{"path": "C:\\\\Users\\\\test", "note": "use // carefully"}'
        result = _strip_json_comments(text)
        assert result == text


class TestParseJsonWithComments:
    """Integration tests: parse_json_response with // comments."""

    def test_parses_json_with_line_comments(self):
        text = """{
  "content": [
    // Array of content blocks
    {"type": "paragraph", "text": "Hello"}
    // Mix block types
  ]
}"""
        result = parse_json_response(text)
        assert result["content"] == [{"type": "paragraph", "text": "Hello"}]

    def test_parses_array_with_comments(self):
        text = """[
  // first item
  {"name": "foo"},
  // second item
  {"name": "bar"}
]"""
        result = parse_json_array_response(text)
        assert len(result) == 2
        assert result[0]["name"] == "foo"
