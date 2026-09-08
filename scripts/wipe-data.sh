#!/usr/bin/env bash
# Wipe all video data so the library can be reprocessed from scratch.
#
# Wipes (in this order — S3 first so an S3 failure aborts before the DB goes):
#   1. S3 raw transcripts: ONLY keys matching exactly videos/<id>/transcript.json
#      (depth 3). The same videos/<id>/ prefix also holds scenes-v3/, scenes/,
#      scenes-v2/ and frames/ — those are never touched (no prefix deletes).
#      Without this step every reprocessed video reports transcriptMeta.source
#      "s3" forever, because the fetcher hits the cached blob first.
#   2. MongoDB video collections (videoSummaryCache, userVideos, llm_usage,
#      folders, memorizedItems, userChats, shareLikes).
#   3. Redis FLUSHALL — also clears the response cache (vie:response:*) and the
#      caption-429 negative-cache marker (vie:captions:429).
# Keeps: users, health_history, Qdrant vectors (not touched), S3 scene frames.
#
# The S3 bucket is REAL AWS (vie-transcripts, eu-north-1). Deletion is not
# reversible. Without --yes this is a DRY RUN that only prints counts.
#
# Usage:
#   scripts/wipe-data.sh            # dry run: print what would be deleted
#   scripts/wipe-data.sh --yes      # delete S3 transcripts + Mongo + Redis
#   scripts/wipe-data.sh --yes --keep-s3   # skip the S3 step
#
# The S3 step runs Python inside the summarizer image (boto3 + AWS_* env live
# there; the host has no aws CLI): the running vie-summarizer container when
# available, otherwise a one-off `docker compose run`.

set -euo pipefail

# docker compose needs the repo root (compose files live there) for the fallback.
cd "$(dirname "$0")/.."

usage() {
  sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
}

YES=0
KEEP_S3=0
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --keep-s3) KEEP_S3=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

MODE="dry-run"
if [[ "$YES" == "1" ]]; then
  MODE="delete"
fi
echo "=== wipe-data: mode=$MODE keep_s3=$KEEP_S3 ==="

# ── 1. S3 raw transcripts ────────────────────────────────────────────────────
S3_PY='
import os
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError

mode = sys.argv[1]
bucket = os.environ["S3_BUCKET"]
kwargs = {"region_name": os.environ.get("AWS_REGION") or None}
if os.environ.get("AWS_ENDPOINT_URL"):
    kwargs["endpoint_url"] = os.environ["AWS_ENDPOINT_URL"]
s3 = boto3.client("s3", **kwargs)

matched = []
try:
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="videos/"):
        for obj in page.get("Contents", []):
            parts = obj["Key"].split("/")
            if len(parts) == 3 and parts[0] == "videos" and parts[2] == "transcript.json":
                matched.append(obj["Key"])
except (BotoCoreError, ClientError) as exc:
    print(f"S3 listing failed ({type(exc).__name__}): {exc}", file=sys.stderr)
    sys.exit(1)

print(f"S3 {bucket}: {len(matched)} transcript keys match videos/<id>/transcript.json")
for key in matched[:3]:
    print(f"  e.g. {key}")
if mode != "delete":
    print("  (dry run — nothing deleted)")
    sys.exit(0)

deleted = 0
for i in range(0, len(matched), 1000):
    batch = [{"Key": k} for k in matched[i : i + 1000]]
    try:
        resp = s3.delete_objects(Bucket=bucket, Delete={"Objects": batch, "Quiet": True})
    except (BotoCoreError, ClientError) as exc:
        print(f"  S3 delete failed after {deleted} keys ({type(exc).__name__}): {exc}", file=sys.stderr)
        sys.exit(1)
    errors = resp.get("Errors", [])
    if errors:
        print(f"  S3 delete errors after {deleted} keys: {errors[:3]}", file=sys.stderr)
        sys.exit(1)
    deleted += len(batch)
print(f"  deleted {deleted} S3 transcript keys")
'

if [[ "$KEEP_S3" == "1" ]]; then
  echo "--- S3: skipped (--keep-s3)"
else
  echo "--- S3 raw transcripts"
  if [[ "$(docker inspect -f '{{.State.Running}}' vie-summarizer 2>/dev/null || true)" == "true" ]]; then
    docker exec -i vie-summarizer python - "$MODE" <<<"$S3_PY"
  else
    echo "  vie-summarizer not running; using a one-off compose container"
    docker compose run --rm --no-deps -T vie-summarizer python - "$MODE" <<<"$S3_PY"
  fi
fi

# ── 2. MongoDB ───────────────────────────────────────────────────────────────
echo ""
echo "--- MongoDB (video-insight-engine)"
if [[ "$MODE" == "delete" ]]; then
  MONGO_OP='deleteMany({})'
else
  MONGO_OP='countDocuments({})'
fi
docker exec vie-mongodb mongosh --quiet --eval "
db = db.getSiblingDB('video-insight-engine');
for (const c of ['videoSummaryCache', 'userVideos', 'llm_usage', 'folders', 'memorizedItems', 'userChats', 'shareLikes']) {
  print(c + ':', JSON.stringify(db.getCollection(c).$MONGO_OP));
}
"

# ── 3. Redis ─────────────────────────────────────────────────────────────────
echo ""
echo "--- Redis"
if [[ "$MODE" == "delete" ]]; then
  docker exec vie-redis redis-cli FLUSHALL
else
  # Captured separately so an unreachable Redis fails the dry run too.
  REDIS_KEYS="$(docker exec vie-redis redis-cli DBSIZE)"
  echo "  keys that would be flushed: $REDIS_KEYS"
fi

echo ""
if [[ "$MODE" == "delete" ]]; then
  echo "Done. Users, health_history, Qdrant vectors and S3 scene frames preserved."
else
  echo "Dry run complete. Re-run with --yes to delete."
fi
