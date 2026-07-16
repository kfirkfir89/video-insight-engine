#!/usr/bin/env bash
# Restore a backup produced by scripts/backup.sh (MongoDB archive + Qdrant snapshots).
#
# Usage:
#   ./scripts/restore.sh backups/<timestamp>                      # restore into the live stack
#   MONGO_CONTAINER=scratch-mongo ./scripts/restore.sh <dir>      # drill against a scratch container
#
# MongoDB restore uses --drop (replaces existing collections in the target DB).
# Qdrant restore uploads each snapshot with priority=snapshot (snapshot wins over
# any existing collection data).

set -euo pipefail

if [[ $# -lt 1 || ! -d "$1" ]]; then
  echo "usage: $0 <backup-directory>" >&2
  exit 1
fi

SRC="$(cd "$1" && pwd)"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
MONGO_CONTAINER="${MONGO_CONTAINER:-vie-mongodb}"
MONGO_DB="${MONGO_DB:-video-insight-engine}"

[[ -f "$SRC/manifest.json" ]] || { echo "no manifest.json in $SRC — not a backup dir?" >&2; exit 1; }
echo "=== Restore from $SRC ==="
jq . "$SRC/manifest.json"

ARCHIVE=$(jq -r '.mongo_archive' "$SRC/manifest.json")
if [[ -f "$SRC/$ARCHIVE" ]]; then
  echo "--- MongoDB → container $MONGO_CONTAINER, db $MONGO_DB (--drop) ---"
  # Auth args come from the container's own root-user env (set by the prod
  # compose file; absent in dev where Mongo runs authless) — no secrets cross
  # the host boundary and the same command works against both stacks.
  docker exec -i -e MONGO_DB="$MONGO_DB" "$MONGO_CONTAINER" sh -c '
    exec mongorestore --archive --gzip --drop --nsInclude "$MONGO_DB.*" \
      ${MONGO_INITDB_ROOT_USERNAME:+--username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin}
  ' < "$SRC/$ARCHIVE"
  echo "mongorestore done"
else
  echo "WARNING: mongo archive $ARCHIVE missing — skipping Mongo restore" >&2
fi

echo "--- Qdrant snapshots ---"
FOUND_SNAPSHOT=false
for SNAP in "$SRC"/qdrant-*.snapshot; do
  [[ -e "$SNAP" ]] || continue
  FOUND_SNAPSHOT=true
  COLLECTION=$(basename "$SNAP" .snapshot)
  COLLECTION="${COLLECTION#qdrant-}"
  echo "restoring collection: $COLLECTION"
  # No explicit Content-Type header: curl's -F sets multipart/form-data WITH
  # the boundary parameter itself (verified 2026-07-16 against an echo server).
  if ! RESPONSE=$(curl -sfS -X POST \
      "$QDRANT_URL/collections/$COLLECTION/snapshots/upload?priority=snapshot" \
      -F "snapshot=@$SNAP"); then
    echo "ERROR: snapshot upload failed for collection $COLLECTION (QDRANT_URL=$QDRANT_URL)" >&2
    exit 1
  fi
  echo "$RESPONSE" | jq -r '.status // "ok"'
done
$FOUND_SNAPSHOT || echo "no Qdrant snapshots in backup — nothing to restore"

echo ""
echo "Restore complete. Verify counts:"
VERIFY_JS="
db = db.getSiblingDB('$MONGO_DB');
db.getCollectionNames().sort().forEach(function(c) {
  print(c + ': ' + db.getCollection(c).countDocuments());
});
"
docker exec -e VERIFY_JS="$VERIFY_JS" "$MONGO_CONTAINER" sh -c '
  exec mongosh --quiet \
    ${MONGO_INITDB_ROOT_USERNAME:+--username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin} \
    --eval "$VERIFY_JS"
'
