"""Tests for the eval runner's scoring logic.

The eval runner lives in ``scripts/run_eval.py`` (top of repo, outside the
summarizer package) so we import it dynamically.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


def _import_run_eval():
    repo_root = Path(__file__).resolve().parents[3]
    script = repo_root / "scripts" / "run_eval.py"
    spec = importlib.util.spec_from_file_location("run_eval_test", script)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["run_eval_test"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def runner():
    return _import_run_eval()


def _expected(**overrides) -> dict:
    base = {
        "id": "test-vid",
        "domain": "tech",
        "expectedTabs": ["overview", "code", "patterns", "cheat_sheet"],
        "requiredComponents": ["overview", "code_explorer"],
        "keyContent": ["useState", "useEffect", "render"],
    }
    base.update(overrides)
    return base


def _actual(tabs: list[dict] | None = None) -> dict:
    return {"meta": {}, "tabs": tabs or []}


def test_scoring_perfect_match(runner):
    """All expectations satisfied → overall score is 1.0."""
    actual = _actual([
        {"id": "overview", "component": "overview", "props": {"items": [
            {"text": "useState"}, {"text": "useEffect"}, {"text": "render"},
        ]}},
        {"id": "code", "component": "code_explorer", "props": {"items": [{}]}},
        {"id": "patterns", "component": "info_grid", "props": {"items": [{}]}},
        {"id": "cheat_sheet", "component": "info_grid", "props": {"items": [{}]}},
    ])
    result = runner.score_entry(_expected(), actual)
    assert result.overall == 1.0
    assert result.component_coverage == 1.0
    assert result.content_coverage == 1.0


def test_scoring_missing_components(runner):
    """Required component missing → component_coverage drops."""
    actual = _actual([
        {"id": "overview", "component": "overview", "props": {"items": [{"text": "useState useEffect render"}]}},
    ])
    result = runner.score_entry(_expected(), actual)
    assert result.component_coverage == 0.5  # 1 of 2 required components


def test_scoring_missing_content(runner):
    """Key content missing → content_coverage drops."""
    actual = _actual([
        {"id": "overview", "component": "overview", "props": {"items": [{"text": "nothing here"}]}},
        {"id": "code", "component": "code_explorer", "props": {"items": [{}]}},
    ])
    result = runner.score_entry(_expected(), actual)
    assert result.content_coverage == 0.0


def test_scoring_tab_count_drift(runner):
    """Tab count off by 2 → tab_count_score = 0.5."""
    actual = _actual([
        {"id": "overview", "component": "overview", "props": {}},
        {"id": "code", "component": "code_explorer", "props": {}},
    ])
    result = runner.score_entry(_expected(), actual)
    # expected 4 tabs, got 2 → |delta|=2 → 1 - 0.25*2 = 0.5
    assert result.tab_count_score == 0.5


def test_scoring_empty_tab_detected(runner):
    """Empty 'items' list in props is detected as an empty tab."""
    actual = _actual([
        {"id": "overview", "component": "overview", "props": {"items": []}},
        {"id": "code", "component": "code_explorer", "props": {}},
    ])
    result = runner.score_entry(_expected(), actual)
    assert result.empty_tab_count == 1


def test_scoring_handles_no_tabs(runner):
    """Empty assembled response → all scores zero but no exception."""
    result = runner.score_entry(_expected(), _actual([]))
    assert result.tab_count == 0
    assert result.component_coverage == 0.0
    assert result.content_coverage == 0.0


def test_scoring_handles_empty_expectations(runner):
    """When expected lists are empty, sub-scores cap at 1.0."""
    result = runner.score_entry(
        {"id": "x", "domain": "tech", "expectedTabs": [], "requiredComponents": [],
         "keyContent": []},
        _actual([]),
    )
    assert result.component_coverage == 1.0
    assert result.content_coverage == 1.0


def test_load_dataset_parses_golden_videos(runner):
    """The golden dataset YAML loads and has 20 entries with stable shape."""
    records = runner.load_dataset()
    assert len(records) == 20
    for r in records:
        assert "id" in r and "url" in r and "domain" in r
        assert isinstance(r.get("expectedTabs"), list)
        assert isinstance(r.get("requiredComponents"), list)
        assert isinstance(r.get("keyContent"), list)


def test_stub_actual_satisfies_expected_perfectly(runner):
    """The dry-run stub produces a response that hits every expectation."""
    exp = _expected()
    actual = runner._stub_actual(exp)
    result = runner.score_entry(exp, actual)
    assert result.overall >= 0.95


# ─── URL allowlist (added 2026-05-20 sign-off) ──────────────────────────
def test_is_allowed_video_url_accepts_youtube(runner):
    assert runner._is_allowed_video_url("https://www.youtube.com/watch?v=abc") is True
    assert runner._is_allowed_video_url("https://youtu.be/abc") is True
    assert runner._is_allowed_video_url("http://m.youtube.com/watch?v=abc") is True


def test_is_allowed_video_url_rejects_internal_host(runner):
    """A swapped URL pointing at an internal host must be rejected."""
    assert runner._is_allowed_video_url("https://internal.example.com/admin") is False
    assert runner._is_allowed_video_url("http://localhost:8080/x") is False


def test_is_allowed_video_url_rejects_non_http_schemes(runner):
    assert runner._is_allowed_video_url("file:///etc/passwd") is False
    assert runner._is_allowed_video_url("javascript:alert(1)") is False


def test_is_allowed_video_url_handles_garbage(runner):
    assert runner._is_allowed_video_url("") is False
    assert runner._is_allowed_video_url(None) is False  # type: ignore[arg-type]
    assert runner._is_allowed_video_url("not a url") is False
