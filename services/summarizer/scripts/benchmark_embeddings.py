"""Cross-video discrimination benchmark for the embedding model.

Run from the summarizer service root:

    python -m scripts.benchmark_embeddings

The script assumes 5 representative videos have already been ingested into
the running ``vie-qdrant`` instance. It does NOT ingest videos. If you swap
``settings.EMBEDDING_MODEL_NAME`` you must re-ingest the fixtures with the
new model so vectors and the query encoder agree.

Pass criteria (advisory, manual interpretation):
* "React coding" — ≥7/10 top-10 hits from the React video
* "reactivity system" — ≤3/10 from React; Vue/Svelte should dominate
* "async data fetching" — sensible spread, no single video dominates
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from dataclasses import dataclass

from src.services.vector.embedding import embed_query
from src.services.vector.qdrant_service import VectorService


@dataclass
class VideoFixture:
    youtube_id: str
    label: str  # human-readable, used in printed report


# Edit these to match what's actually ingested in your Qdrant.
DEFAULT_FIXTURES: list[VideoFixture] = [
    VideoFixture("REACT_VIDEO_ID", "React (function components, hooks, JSX)"),
    VideoFixture("VUE_VIDEO_ID", "Vue (reactivity system, refs, computed)"),
    VideoFixture("SVELTE_VIDEO_ID", "Svelte (compile-step reactivity, runes)"),
    VideoFixture("NODE_VIDEO_ID", "Node/Express (HTTP, middleware, async I/O)"),
    VideoFixture("JS_VIDEO_ID", "JavaScript fundamentals (closures, prototypes)"),
]

DEFAULT_QUERIES: list[str] = [
    "React coding",
    "component state management",
    "reactivity system",
    "async data fetching",
]


def run_benchmark(
    fixtures: list[VideoFixture],
    queries: list[str],
    top_k: int = 10,
) -> int:
    """Print per-query top-k breakdown grouped by fixture. Returns exit code."""
    label_by_id = {f.youtube_id: f.label for f in fixtures}
    video_ids = [f.youtube_id for f in fixtures]

    service = VectorService()
    print(f"Benchmark: {len(video_ids)} videos, {len(queries)} queries, top_k={top_k}")
    print("=" * 72)

    for query in queries:
        print(f'\nQuery: "{query}"')
        try:
            embedding = embed_query(query)
        except Exception as exc:  # pragma: no cover — operator-facing error path
            print(f"  ! embed failed: {exc}")
            return 2

        results = service.search_multi_video(embedding, video_ids, limit=top_k)
        if not results:
            print("  (no results — Qdrant empty or unreachable)")
            continue

        counts = Counter(r["video_id"] for r in results)
        for vid, count in counts.most_common():
            label = label_by_id.get(vid, vid)
            print(f"  {count:>2}/{top_k}  {label}  ({vid})")

        # Top-3 individual results for inspection.
        print("  ── top hits ──")
        for r in results[:3]:
            label = label_by_id.get(r["video_id"], r["video_id"])
            text = r["text"]
            preview = (text[:100] + "...") if len(text) > 100 else text
            print(f"    score={r['score']:.3f}  {label}: {preview}")

    print("\n" + "=" * 72)
    print("Pass criteria (advisory):")
    print('  * "React coding"      → ≥7/10 from React')
    print('  * "reactivity system" → ≤3/10 from React; Vue/Svelte dominate')
    print('  * "async data fetching" → sensible spread')
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top-k", type=int, default=10)
    args = parser.parse_args()

    exit_code = run_benchmark(DEFAULT_FIXTURES, DEFAULT_QUERIES, top_k=args.top_k)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
