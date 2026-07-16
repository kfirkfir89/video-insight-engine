"""Retrieval eval harness — recall@k + MRR over a golden query→chunk set.

Exercises the real RAG retrieval path end to end with NO LLM spend:

    transcript  ─chunk_transcript()→  chunks
                ─embed_texts()      →  384-d vectors      (local SentenceTransformer)
                ─upsert            →  throwaway Qdrant collection
    query       ─embed_query()      →  vector
                ─query_points()     →  top-k chunk indices  (search() was removed)

For each golden query the fixture names an ``answer_span`` — a distinctive
substring that identifies the gold chunk(s). Retrieval is scored by whether a
gold chunk appears in the top-k results (recall@k) and how highly it ranks
(reciprocal rank → MRR). Aggregate metrics are asserted against hard floors so
a chunker/embedding regression fails the job.

Ephemerality: every run creates a uniquely-named collection and deletes it in
teardown, so it never touches the production ``transcript_chunks`` collection.

Requires a reachable Qdrant (``QDRANT_HOST``/``QDRANT_PORT``): a service
container in CI, or the local dev stack at localhost:6333. Skips (does not
fail) when Qdrant is unreachable so devs without the stack aren't blocked; CI
provides the container so the floor is always enforced there.
"""

from __future__ import annotations

# The embedding model must run on CPU: CI has no GPU, and older dev GPUs
# (e.g. sm_61) are incompatible with the packaged torch build. Set before any
# import can trigger the lazy SentenceTransformer load.
import os

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

import json
import uuid
from pathlib import Path
from typing import Any

import pytest

from src.config import settings
from src.services.vector.chunking import chunk_transcript
from src.services.vector.embedding import embed_query, embed_texts

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "retrieval_golden.json"

VECTOR_SIZE = 384


def _load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text())


# ─── Gold-chunk resolution ──────────────────────────────────────────────
def _chunk_with_span(chunks: list[dict], answer_span: str) -> list[int]:
    """Indices of chunks whose text contains ``answer_span`` (case-insensitive).

    With overlapping chunks a span can land in two adjacent chunks; any of them
    counts as a correct retrieval.
    """
    needle = answer_span.lower()
    return [i for i, c in enumerate(chunks) if needle in c["text"].lower()]


# ─── Always-on fixture validation (no Qdrant, no embeddings) ────────────
class TestGoldenRetrievalFixture:
    def test_has_enough_queries(self):
        data = _load_fixture()
        total = sum(len(v["queries"]) for v in data["videos"])
        assert total >= 15, f"need 15+ golden queries, have {total}"
        assert len(data["videos"]) >= 3

    def test_every_answer_span_hits_exactly_one_region(self):
        """Each span must resolve to at least one chunk (and not the whole
        transcript) so the query has a well-defined gold target."""
        data = _load_fixture()
        for video in data["videos"]:
            chunks = chunk_transcript(video["transcript"])
            assert chunks, f"{video['video_id']} produced no chunks"
            for q in video["queries"]:
                gold = _chunk_with_span(chunks, q["answer_span"])
                assert gold, f"{q['id']}: answer_span not found in any chunk of {video['video_id']}"
                assert len(gold) < len(chunks), (
                    f"{q['id']}: answer_span matches every chunk — not distinctive"
                )

    def test_query_ids_are_unique(self):
        data = _load_fixture()
        ids = [q["id"] for v in data["videos"] for q in v["queries"]]
        assert len(ids) == len(set(ids)), "duplicate query ids"


# ─── Qdrant-backed retrieval eval ───────────────────────────────────────
def _qdrant_client_or_skip():
    """Return a live QdrantClient or skip the test when unreachable."""
    from qdrant_client import QdrantClient

    try:
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            timeout=5,
        )
        client.get_collections()  # forces a connection
    except Exception as exc:  # noqa: BLE001 — any transport failure = not available
        pytest.skip(f"Qdrant not reachable at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}: {exc}")
    return client


@pytest.fixture(scope="module")
def ephemeral_collection():
    """Create a uniquely-named collection, yield (client, name), then delete it."""
    from qdrant_client.models import Distance, VectorParams

    client = _qdrant_client_or_skip()
    name = f"eval_retrieval_{uuid.uuid4().hex[:12]}"
    client.create_collection(
        collection_name=name,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )
    try:
        yield client, name
    finally:
        try:
            client.delete_collection(collection_name=name)
        except Exception:  # noqa: BLE001 — cleanup best-effort
            pass


def _point_id(video_id: str, chunk_idx: int) -> int:
    """Stable 63-bit id per (video, chunk) — namespaced so videos never collide."""
    import hashlib

    key = f"{video_id}:{chunk_idx}"
    return int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big") & 0x7FFFFFFFFFFFFFFF


def _ingest(client, collection: str, videos: list[dict]) -> dict[str, list[dict]]:
    """Chunk + embed + upsert every video. Returns {video_id: chunks}."""
    from qdrant_client.models import PointStruct

    per_video: dict[str, list[dict]] = {}
    points: list[PointStruct] = []
    for video in videos:
        chunks = chunk_transcript(video["transcript"])
        per_video[video["video_id"]] = chunks
        vectors = embed_texts([c["text"] for c in chunks])
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
            points.append(
                PointStruct(
                    id=_point_id(video["video_id"], idx),
                    vector=vec,
                    payload={"video_id": video["video_id"], "chunk_index": idx},
                )
            )
    client.upsert(collection_name=collection, points=points)
    return per_video


def _retrieve_indices(client, collection: str, video_id: str, query: str, k: int) -> list[int]:
    """Top-k chunk indices for a query, filtered to one video (query_points API)."""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    response = client.query_points(
        collection_name=collection,
        query=embed_query(query),
        query_filter=Filter(
            must=[FieldCondition(key="video_id", match=MatchValue(value=video_id))],
        ),
        limit=k,
    )
    return [int(p.payload["chunk_index"]) for p in response.points]


class TestRetrievalMetrics:
    def test_recall_at_k_and_mrr_meet_floor(self, ephemeral_collection):
        client, collection = ephemeral_collection
        data = _load_fixture()
        k = data["recall_k"]
        per_video = _ingest(client, collection, data["videos"])

        recall_hits = 0
        reciprocal_ranks: list[float] = []
        total = 0
        misses: list[str] = []

        for video in data["videos"]:
            chunks = per_video[video["video_id"]]
            for q in video["queries"]:
                total += 1
                gold = set(_chunk_with_span(chunks, q["answer_span"]))
                retrieved = _retrieve_indices(
                    client,
                    collection,
                    video["video_id"],
                    q["query"],
                    k,
                )
                hit_rank = next(
                    (rank for rank, idx in enumerate(retrieved, start=1) if idx in gold),
                    None,
                )
                if hit_rank is not None:
                    recall_hits += 1
                    reciprocal_ranks.append(1.0 / hit_rank)
                else:
                    reciprocal_ranks.append(0.0)
                    misses.append(f"{q['id']} (retrieved {retrieved}, gold {sorted(gold)})")

        recall_at_k = recall_hits / total
        mrr = sum(reciprocal_ranks) / total
        print(f"\n[retrieval-eval] n={total} recall@{k}={recall_at_k:.3f} MRR={mrr:.3f}")
        if misses:
            print("[retrieval-eval] misses:\n  " + "\n  ".join(misses))

        floors = data["floors"]
        assert recall_at_k >= floors["recall_at_k"], (
            f"recall@{k} {recall_at_k:.3f} below floor {floors['recall_at_k']}: {misses}"
        )
        assert mrr >= floors["mrr"], f"MRR {mrr:.3f} below floor {floors['mrr']}: {misses}"
