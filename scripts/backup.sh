#!/usr/bin/env bash
# Full data backup: MongoDB (mongodump archive) + Qdrant (per-collection snapshots).
# Output: backups/<UTC-timestamp>/ (or $1 if given). Prune policy: keeps last 14 by default.
#
# Usage:
#   ./scripts/backup.sh                # backup to backups/<timestamp>/
#   ./scripts/backup.sh /path/to/dir   # backup to a custom directory
#   BACKUP_KEEP=30 ./scripts/backup.sh # keep 30 most recent backups
#
# Restore with: ./scripts/restore.sh backups/<timestamp>

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
MONGO_CONTAINER="${MONGO_CONTAINER:-vie-mongodb}"
MONGO_DB="${MONGO_DB:-video-insight-engine}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${1:-$PROJECT_ROOT/backups}"
DEST="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$DEST"

echo "=== Backup → $DEST ==="

echo "--- MongoDB ($MONGO_DB) ---"
# Auth args come from the container's own root-user env (set by the prod
# compose file; absent in dev where Mongo runs authless) — no secrets cross
# the host boundary and the same command works against both stacks.
docker exec -e MONGO_DB="$MONGO_DB" "$MONGO_CONTAINER" sh -c '
  exec mongodump --db "$MONGO_DB" --archive --gzip \
    ${MONGO_INITDB_ROOT_USERNAME:+--username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin}
' > "$DEST/mongo-$MONGO_DB.archive.gz"
MONGO_SIZE=$(du -h "$DEST/mongo-$MONGO_DB.archive.gz" | cut -f1)
echo "mongodump archive written ($MONGO_SIZE)"

echo "--- Qdrant snapshots ---"
# In prod Qdrant publishes no host port — point QDRANT_URL at a tunnel, or set
# QDRANT_SKIP=1 for a Mongo-only backup (Qdrant vectors are re-derivable).
COLLECTIONS=""
if COLLECTIONS_JSON=$(curl -sfS "$QDRANT_URL/collections"); then
  COLLECTIONS=$(echo "$COLLECTIONS_JSON" | jq -r '.result.collections[].name')
elif [[ "${QDRANT_SKIP:-0}" == "1" ]]; then
  echo "WARNING: Qdrant unreachable at $QDRANT_URL — Mongo-only backup (QDRANT_SKIP=1)" >&2
else
  echo "ERROR: Qdrant unreachable at $QDRANT_URL — aborting (set QDRANT_SKIP=1 for Mongo-only)" >&2
  exit 1
fi
if [[ -z "$COLLECTIONS" ]]; then
  echo "no Qdrant collections present — skipping (recorded in manifest)"
else
  for COLLECTION in $COLLECTIONS; do
    echo "snapshotting collection: $COLLECTION"
    SNAPSHOT_NAME=$(curl -sf -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots" \
      | jq -r '.result.name')
    curl -sf "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" \
      -o "$DEST/qdrant-$COLLECTION.snapshot"
    # Remove the server-side copy so snapshots don't accumulate in the container
    curl -sf -X DELETE "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" > /dev/null
    echo "saved $(du -h "$DEST/qdrant-$COLLECTION.snapshot" | cut -f1)"
  done
fi

cat > "$DEST/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "mongo_db": "$MONGO_DB",
  "mongo_archive": "mongo-$MONGO_DB.archive.gz",
  "qdrant_collections": $(printf '%s\n' "$COLLECTIONS" | jq -R 'select(length > 0)' | jq -s .),
  "created_by": "scripts/backup.sh"
}
EOF

echo "--- Pruning (keep $BACKUP_KEEP) ---"
# Match ONLY timestamp-named backup dirs (20260716T122600Z). A custom
# BACKUP_ROOT may contain unrelated directories — never rm -rf those.
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z' \
  | sort | head -n -"$BACKUP_KEEP" | while read -r OLD; do
  echo "pruning $OLD"
  rm -rf "$OLD"
done

echo ""
echo "Backup complete: $DEST"
ls -lh "$DEST"
