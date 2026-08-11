#!/usr/bin/env bash
# Wipe all video data, cache, and Redis from local Docker containers.
# Keeps: users, health_history collections.

set -euo pipefail

echo "=== Wiping MongoDB (video-insight-engine) ==="
docker exec vie-mongodb mongosh --quiet --eval '
db = db.getSiblingDB("video-insight-engine");
print("videoSummaryCache:", JSON.stringify(db.videoSummaryCache.deleteMany({})));
print("userVideos:", JSON.stringify(db.userVideos.deleteMany({})));
print("llm_usage:", JSON.stringify(db.llm_usage.deleteMany({})));
print("folders:", JSON.stringify(db.folders.deleteMany({})));
print("memorizedItems:", JSON.stringify(db.memorizedItems.deleteMany({})));
print("userChats:", JSON.stringify(db.userChats.deleteMany({})));
print("shareLikes:", JSON.stringify(db.shareLikes.deleteMany({})));
'

echo ""
echo "=== Flushing Redis ==="
docker exec vie-redis redis-cli FLUSHALL

echo ""
echo "Done. Users and health_history preserved."
