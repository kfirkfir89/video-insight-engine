"""Transcript provenance persistence (transcript-meta 2.2).

``transcriptMeta`` is written once per run from the pipeline runner and must
survive the repository's allowlist. Two dedicated writers exist because the
block is written MID-run, not at the end:

- ``set_transcript_meta`` — ``$set`` only; must NOT ``$unset`` ``forceRefresh``
  the way ``save_structured_result`` does (the bypassCache marker is consumed
  when a run completes, not before assembly)
- ``clear_transcript_meta`` — ``$unset`` only; no ``updatedAt`` bump, since that
  field is the stall sweeper's liveness signal
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

from bson import ObjectId

from src.repositories.mongodb_repository import MongoDBVideoRepository

_VIDEO_SUMMARY_ID = "0" * 24
_META = {
    "outcome": "ok",
    "source": "yt-dlp",
    "type": "auto-generated",
    "attempted": ["s3", "yt-dlp"],
}


def _build_repo() -> tuple[MongoDBVideoRepository, MagicMock]:
    """Repository over a MagicMock collection so update_one args can be read back."""
    collection = MagicMock()
    database = MagicMock()
    database.videoSummaryCache = collection
    return MongoDBVideoRepository(database), collection


# ─── set_transcript_meta ─────────────────────────────────────────────────
def test_set_transcript_meta_targets_row_by_object_id() -> None:
    repo, collection = _build_repo()

    repo.set_transcript_meta(_VIDEO_SUMMARY_ID, _META)

    collection.update_one.assert_called_once()
    assert collection.update_one.call_args.args[0] == {"_id": ObjectId(_VIDEO_SUMMARY_ID)}


def test_set_transcript_meta_sets_block_and_bumps_updated_at() -> None:
    repo, collection = _build_repo()

    repo.set_transcript_meta(_VIDEO_SUMMARY_ID, _META)

    written = collection.update_one.call_args.args[1]["$set"]
    assert set(written) == {"transcriptMeta", "updatedAt"}
    assert written["transcriptMeta"] == _META
    assert isinstance(written["updatedAt"], datetime)
    assert written["updatedAt"].tzinfo is not None


def test_set_transcript_meta_does_not_consume_force_refresh() -> None:
    """Tripwire: a mid-run write must leave the API's bypassCache marker alone."""
    repo, collection = _build_repo()

    repo.set_transcript_meta(_VIDEO_SUMMARY_ID, _META)

    update = collection.update_one.call_args.args[1]
    assert "$unset" not in update


# ─── clear_transcript_meta ───────────────────────────────────────────────
def test_clear_transcript_meta_unsets_only_the_block() -> None:
    """No ``$set`` at all — so no ``updatedAt`` bump, the sweeper's liveness signal."""
    repo, collection = _build_repo()

    repo.clear_transcript_meta(_VIDEO_SUMMARY_ID)

    collection.update_one.assert_called_once()
    assert collection.update_one.call_args.args == (
        {"_id": ObjectId(_VIDEO_SUMMARY_ID)},
        {"$unset": {"transcriptMeta": ""}},
    )


# ─── Repository allowlist ────────────────────────────────────────────────
def test_transcript_meta_is_allowlisted() -> None:
    """Tripwire: a result-dict writer must not have the block silently dropped."""
    assert "transcriptMeta" in MongoDBVideoRepository._ALLOWED_RESULT_KEYS


def test_save_structured_result_persists_transcript_meta() -> None:
    repo, collection = _build_repo()

    repo.save_structured_result(
        _VIDEO_SUMMARY_ID, {"transcriptMeta": _META, "meta": {}, "userId": "evil"}
    )

    written = collection.update_one.call_args.args[1]["$set"]
    assert written["transcriptMeta"] == _META
    assert "userId" not in written  # allowlist still filters injections
