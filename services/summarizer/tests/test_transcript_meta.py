"""Unit tests for ``build_transcript_meta`` — the pure ``transcriptMeta`` builder.

The runner persists this dict for successful AND failed runs, so every branch
(ok / failed / S3 origin / type collapsing / missing inputs) is pinned here.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import src.services.transcription.transcript_meta as transcript_meta_module
from src.services.pipeline.pipeline_helpers import TranscriptData, TranscriptTrail
from src.services.transcription.transcript_meta import build_transcript_meta

EXPECTED_KEYS = {
    "outcome",
    "source",
    "type",
    "origin",
    "captionTrack",
    "captionLang",
    "captionFetchError",
    "captionApiSkipped",
    "attempted",
    "segments",
    "chars",
    "fetchWallMs",
    "errorCode",
}


def _video_data(
    caption_track: str | None = "manual",
    caption_lang: str | None = "en",
    caption_fetch_error: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        caption_track=caption_track,
        caption_lang=caption_lang,
        caption_fetch_error=caption_fetch_error,
    )


def _data(transcript_type: str = "manual", source: str = "ytdlp") -> TranscriptData:
    return TranscriptData(
        segments=[
            {"text": "hi", "start": 0.0, "duration": 1.0},
            {"text": "there", "start": 1.0, "duration": 1.0},
        ],
        raw_text="hi there",
        transcript_type=transcript_type,
        source=source,
        language="en",
    )


class TestBuildTranscriptMetaShape:
    def test_should_emit_exactly_the_documented_keys(self):
        meta = build_transcript_meta(_data(), _video_data(), TranscriptTrail())

        assert set(meta) == EXPECTED_KEYS

    def test_should_not_read_settings(self):
        """The builder is pure — no config coupling (assembly tests stub settings)."""
        assert not hasattr(transcript_meta_module, "settings")


class TestBuildTranscriptMetaOk:
    def test_should_describe_a_manual_ytdlp_caption_run(self):
        trail = TranscriptTrail(fetch_wall_ms=12)

        meta = build_transcript_meta(_data(), _video_data(), trail)

        assert meta == {
            "outcome": "ok",
            "source": "ytdlp",
            "type": "manual",
            "origin": None,
            "captionTrack": "manual",
            "captionLang": "en",
            "captionFetchError": None,
            "captionApiSkipped": False,
            "attempted": [],
            "segments": 2,
            "chars": len("hi there"),
            "fetchWallMs": 12,
            "errorCode": None,
        }

    def test_should_record_layers_that_ran_before_the_winner(self):
        trail = TranscriptTrail(attempted=["ytdlp", "api"], caption_api_skipped=False)
        video_data = _video_data(caption_track="auto-generated", caption_fetch_error="http_429")

        meta = build_transcript_meta(_data("whisper", "whisper"), video_data, trail)

        assert meta["attempted"] == ["ytdlp", "api"]
        assert meta["captionFetchError"] == "http_429"
        assert meta["source"] == "whisper"

    def test_should_copy_attempted_so_later_trail_mutation_does_not_alias(self):
        trail = TranscriptTrail(attempted=["api"])

        meta = build_transcript_meta(_data(), _video_data(), trail)
        trail.attempted.append("whisper")

        assert meta["attempted"] == ["api"]

    def test_should_flag_the_caption_api_skip(self):
        trail = TranscriptTrail(caption_api_skipped=True)

        meta = build_transcript_meta(_data("whisper", "whisper"), _video_data(None, None), trail)

        assert meta["captionApiSkipped"] is True


class TestBuildTranscriptMetaFailed:
    def test_should_describe_a_run_where_every_layer_failed(self):
        trail = TranscriptTrail(
            attempted=["api", "whisper", "gemini"], fetch_wall_ms=4321, error_code="NO_TRANSCRIPT"
        )

        meta = build_transcript_meta(None, _video_data(None, None, None), trail)

        assert meta == {
            "outcome": "failed",
            "source": None,
            "type": None,
            "origin": None,
            "captionTrack": None,
            "captionLang": None,
            "captionFetchError": None,
            "captionApiSkipped": False,
            "attempted": ["api", "whisper", "gemini"],
            "segments": None,
            "chars": None,
            "fetchWallMs": 4321,
            "errorCode": "NO_TRANSCRIPT",
        }

    def test_should_survive_missing_video_data_and_trail(self):
        meta = build_transcript_meta(None, None, None)

        assert meta["outcome"] == "failed"
        assert meta["attempted"] == []
        assert meta["captionApiSkipped"] is False
        assert meta["fetchWallMs"] is None
        assert meta["errorCode"] is None


class TestBuildTranscriptMetaOrigin:
    def test_should_report_the_blob_origin_for_an_s3_hit(self):
        trail = TranscriptTrail(origin="whisper")

        meta = build_transcript_meta(_data("cached-whisper", "s3"), _video_data(), trail)

        assert meta["source"] == "s3"
        assert meta["type"] == "cached"
        assert meta["origin"] == "whisper"

    def test_should_null_the_origin_when_the_blob_already_decayed_to_s3(self):
        trail = TranscriptTrail(origin="s3")

        meta = build_transcript_meta(_data("cached-s3", "s3"), _video_data(), trail)

        assert meta["origin"] is None

    def test_should_ignore_origin_when_the_source_is_not_s3(self):
        trail = TranscriptTrail(origin="whisper")

        meta = build_transcript_meta(_data("whisper", "whisper"), _video_data(), trail)

        assert meta["origin"] is None


class TestBuildTranscriptMetaTypeMapping:
    @pytest.mark.parametrize(
        ("transcript_type", "expected"),
        [
            ("manual", "manual"),
            ("auto-generated", "auto-generated"),
            ("whisper", "asr"),
            ("gemini", "asr"),
            ("metadata", "metadata"),
            ("cached-ytdlp", "cached"),
            ("yt-dlp", None),  # legacy constant no longer emitted by the chain
        ],
    )
    def test_should_collapse_chain_labels_to_research_kinds(self, transcript_type, expected):
        meta = build_transcript_meta(_data(transcript_type), _video_data(), TranscriptTrail())

        assert meta["type"] == expected


class TestBuildTranscriptMetaCaptionFields:
    def test_should_null_non_string_caption_fields_from_test_doubles(self):
        """MagicMock attrs are truthy objects — they must not reach Mongo."""
        meta = build_transcript_meta(_data(), MagicMock(), TranscriptTrail())

        assert meta["captionTrack"] is None
        assert meta["captionLang"] is None
        assert meta["captionFetchError"] is None

    def test_should_report_empty_caption_fetch_as_its_own_error(self):
        video_data = _video_data(caption_track="auto-generated", caption_fetch_error="empty")

        meta = build_transcript_meta(_data("whisper", "whisper"), video_data, TranscriptTrail())

        assert meta["captionFetchError"] == "empty"
