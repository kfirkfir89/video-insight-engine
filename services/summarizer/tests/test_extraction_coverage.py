"""Tests for the extraction-coverage critical signal.

When timestamped extraction covers only a tiny fraction of the video, the
transcript itself was almost certainly truncated (the Gemini-fallback
signature: a 57-min video whose timestamps stop at 3:20 → ratio 0.058). That
is flagged ``critical`` on the coverage metric and logged at error level, so it
is distinguishable from a normal long-tail thinning.
"""

from __future__ import annotations

from types import SimpleNamespace

from src.services.pipeline.phases.extraction import _record_extraction_coverage


def _ctx(duration: int, extraction_data: dict) -> SimpleNamespace:
    return SimpleNamespace(
        video_data=SimpleNamespace(duration=duration),
        extraction_data=extraction_data,
        video_summary_id="vsid",
        extraction_coverage=None,
    )


class TestRecordExtractionCoverage:
    def test_critically_low_coverage_is_flagged(self):
        """57-min video whose timestamps stop at 3:20 → critical."""
        ctx = _ctx(3465, {"learning": {"timestamps": [{"seconds": 0}, {"seconds": 200}]}})

        _record_extraction_coverage(ctx, batches_total=None, batches_succeeded=None)

        assert ctx.extraction_coverage is not None
        assert ctx.extraction_coverage["ratio"] < 0.5
        assert ctx.extraction_coverage["critical"] is True

    def test_under_gate_but_not_critical(self):
        """A ratio between the critical and gate thresholds is not critical."""
        ctx = _ctx(1000, {"learning": {"timestamps": [{"seconds": 0}, {"seconds": 600}]}})

        _record_extraction_coverage(ctx, batches_total=None, batches_succeeded=None)

        assert ctx.extraction_coverage is not None
        assert 0.5 <= ctx.extraction_coverage["ratio"] < 0.85
        assert ctx.extraction_coverage["critical"] is False

    def test_full_coverage_not_critical(self):
        """Near-complete coverage is not flagged."""
        ctx = _ctx(16789, {"learning": {"timestamps": [{"seconds": 0}, {"seconds": 16000}]}})

        _record_extraction_coverage(ctx, batches_total=None, batches_succeeded=None)

        assert ctx.extraction_coverage is not None
        assert ctx.extraction_coverage["critical"] is False
