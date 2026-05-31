"""Unit tests for density enforcement + info_grid string normalization (1B)."""

from src.services.pipeline.assembly import assemble_info_grid, enforce_density


class TestEnforceDensity:
    def test_caps_long_info_grid_value(self):
        props = {"items": [{"key": "Feature", "value": "x" * 200}]}
        out = enforce_density("info_grid", props)
        assert out is not None
        assert len(out["items"][0]["value"]) == 120
        assert out["items"][0]["value"].endswith("…")

    def test_caps_long_info_grid_key(self):
        props = {"items": [{"key": "k" * 200, "value": "short"}]}
        out = enforce_density("info_grid", props)
        assert len(out["items"][0]["key"]) == 120

    def test_short_cells_untouched(self):
        props = {"items": [{"key": "Display", "value": "6.7 inch"}]}
        out = enforce_density("info_grid", props)
        assert out["items"][0]["value"] == "6.7 inch"

    def test_unknown_component_passes_through(self):
        props = {"steps": [{"instruction": "x" * 300}]}
        out = enforce_density("step_player", props)
        assert out is props

    def test_caps_evidence_field(self):
        props = {"items": [{"key": "K", "value": "v", "evidence": "e" * 200}]}
        out = enforce_density("info_grid", props)
        assert len(out["items"][0]["evidence"]) == 120


class TestInfoGridStringNormalization:
    def test_em_dash_string_splits_into_pair(self):
        result = assemble_info_grid({}, ["ReLU — Rectified Linear Unit"], {}, None)
        assert result is not None
        assert result["items"][0] == {"key": "ReLU", "value": "Rectified Linear Unit"}

    def test_colon_string_splits_into_pair(self):
        result = assemble_info_grid({}, ["Battery: 5000mAh"], {}, None)
        assert result["items"][0] == {"key": "Battery", "value": "5000mAh"}

    def test_long_delimiterless_string_is_dropped(self):
        # The audited wall-of-empty-grid bug: a 150-char sentence dumped into
        # `key` with empty `value`. Must drop, not ship an empty card.
        paragraph = "This is a long explanatory sentence " * 5
        result = assemble_info_grid({}, [paragraph], {}, None)
        assert result is None

    def test_short_label_survives_as_key_chip(self):
        result = assemble_info_grid({}, ["Waterproof"], {}, None)
        assert result["items"][0] == {"key": "Waterproof", "value": ""}

    def test_mixed_list_drops_only_paragraphs(self):
        paragraph = "A long delimiterless explanatory sentence about nothing " * 4
        result = assemble_info_grid({}, ["Speed: fast", paragraph], {}, None)
        assert result is not None
        assert len(result["items"]) == 1
        assert result["items"][0]["key"] == "Speed"
