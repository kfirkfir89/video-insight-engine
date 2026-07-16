"""Assembler unit tests — canvas family (concept_canvas, connect_canvas)."""

from src.services.pipeline.assembly import (
    assemble_connect_canvas,
    assemble_concept_canvas,
)


# ─── resolve_data_source ───


# ─── ConnectCanvas (P3B) — answer key derived from concept connections ───


class TestAssembleConnectCanvas:
    def _concepts(self) -> list[dict]:
        return [
            {
                "name": "Embedding",
                "definition": "Maps tokens to vectors.",
                "connections": ["Attention"],
            },
            {
                "name": "Attention",
                "definition": "Weights tokens.",
                "connections": ["Embedding", "Residual"],
            },
            {"name": "Residual", "definition": "Skip connection.", "connections": ["Attention"]},
        ]

    def test_derives_pairs_from_connections(self):
        result = assemble_connect_canvas({}, self._concepts(), {}, None)
        assert result is not None
        pairs = result["pairs"]
        assert len(pairs) >= 2
        for pair in pairs:
            assert pair["prompt"]
            assert pair["match"]
            # match must resolve to a real concept name (the answer key)
            assert pair["match"] in {"Embedding", "Attention", "Residual"}
            assert pair["match"] != pair["prompt"]

    def test_answer_key_matches_a_real_connection(self):
        result = assemble_connect_canvas({}, self._concepts(), {}, None)
        by_prompt = {p["prompt"]: p["match"] for p in result["pairs"]}
        # Embedding connects to Attention in the source graph
        assert by_prompt["Embedding"] == "Attention"

    def test_returns_none_without_resolvable_connections(self):
        concepts = [
            {"name": "A", "definition": "x", "connections": ["Nonexistent"]},
            {"name": "B", "definition": "y", "connections": []},
        ]
        assert assemble_connect_canvas({}, concepts, {}, None) is None

    def test_returns_none_below_min_pairs(self):
        concepts = [{"name": "A", "definition": "x", "connections": ["B"]}]
        assert assemble_connect_canvas({}, concepts, {}, None) is None

    def test_accepts_dict_wrapped_concepts(self):
        result = assemble_connect_canvas({}, {"concepts": self._concepts()}, {}, None)
        assert result is not None and len(result["pairs"]) >= 2


# ─── ConceptCanvas (canvas-interactive-overhaul) — typed edges + groups ───


class TestAssembleConceptCanvas:
    def test_normalizes_typed_connections(self):
        data = [
            {
                "name": "Embedding",
                "definition": "Maps tokens.",
                "group": "Inputs",
                "connections": [{"to": "Attention", "type": "requires"}],
            },
            {
                "name": "Attention",
                "definition": "Weights tokens.",
                "group": "Core",
                "connections": [{"to": "Embedding", "type": "relatesTo"}],
            },
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        conn = result["concepts"][0]["connections"][0]
        assert conn == {"to": "Attention", "type": "requires"}

    def test_coerces_legacy_string_connections_to_relates_to(self):
        data = [
            {"name": "Embedding", "definition": "Maps tokens.", "connections": ["Attention"]},
            {"name": "Attention", "definition": "Weights tokens.", "connections": ["Embedding"]},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert result["concepts"][0]["connections"][0] == {"to": "Attention", "type": "relatesTo"}

    def test_falls_back_to_relates_to_on_invalid_type(self):
        data = [
            {"name": "A", "definition": "x", "connections": [{"to": "B", "type": "bogus"}]},
            {"name": "B", "definition": "y", "connections": []},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert result["concepts"][0]["connections"][0]["type"] == "relatesTo"

    def test_clamps_connections_to_three(self):
        targets = ["B", "C", "D", "E", "F"]
        data = [{"name": "A", "definition": "x", "connections": targets}]
        data += [{"name": t, "definition": "y", "connections": []} for t in targets]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert len(result["concepts"][0]["connections"]) == 3

    def test_drops_hallucinated_and_self_connections(self):
        data = [
            {
                "name": "A",
                "definition": "x",
                "connections": [
                    {"to": "A", "type": "causes"},
                    {"to": "Ghost", "type": "causes"},
                    {"to": "B", "type": "causes"},
                ],
            },
            {"name": "B", "definition": "y", "connections": []},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert result["concepts"][0]["connections"] == [{"to": "B", "type": "causes"}]

    def test_returns_ordered_deduped_groups(self):
        data = [
            {"name": "A", "definition": "x", "group": "Foundations", "connections": []},
            {"name": "B", "definition": "y", "group": "Mechanics", "connections": []},
            {"name": "C", "definition": "z", "group": "Foundations", "connections": []},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert result["groups"] == ["Foundations", "Mechanics"]

    def test_defaults_missing_group_when_some_present(self):
        data = [
            {"name": "A", "definition": "x", "group": "Foundations", "connections": []},
            {"name": "B", "definition": "y", "connections": []},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert result["concepts"][1]["group"] == "Concepts"
        assert "Concepts" in result["groups"]

    def test_synthesizes_clusters_when_no_group(self):
        # Two disconnected components: {A,B} and {C,D}.
        data = [
            {"name": "A", "definition": "x", "connections": ["B"]},
            {"name": "B", "definition": "y", "connections": ["A"]},
            {"name": "C", "definition": "z", "connections": ["D"]},
            {"name": "D", "definition": "w", "connections": ["C"]},
        ]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        groups = {c["name"]: c["group"] for c in result["concepts"]}
        assert groups["A"] == groups["B"]
        assert groups["C"] == groups["D"]
        assert groups["A"] != groups["C"]
        assert len(result["groups"]) == 2

    def test_caps_at_thirty_concepts(self):
        data = [{"name": f"N{i}", "definition": "d", "connections": []} for i in range(40)]
        result = assemble_concept_canvas({}, data, {}, None)
        assert result is not None
        assert len(result["concepts"]) == 30

    def test_returns_none_below_two_concepts(self):
        assert assemble_concept_canvas({}, [{"name": "A", "definition": "x"}], {}, None) is None
