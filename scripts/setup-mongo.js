// Run with: mongosh mongodb://localhost:27017/video-insight-engine scripts/setup-mongo.js
//
// IMPORTANT: If migrating from a previous version, run migrate-versioning.js first:
//   mongosh mongodb://localhost:27017/video-insight-engine scripts/migrate-versioning.js

// System Cache
// Versioning: allow multiple versions per youtubeId for A/B testing prompts
db.videoSummaryCache.createIndex({ youtubeId: 1, version: 1 }, { unique: true });
db.videoSummaryCache.createIndex({ youtubeId: 1, isLatest: 1 }); // Fast lookup for latest
db.videoSummaryCache.createIndex({ status: 1 });

db.systemExpansionCache.createIndex(
  { videoSummaryId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);
db.systemExpansionCache.createIndex({ status: 1 });

// User Data
db.users.createIndex({ email: 1 }, { unique: true });

db.folders.createIndex({ userId: 1, type: 1, path: 1 });
db.folders.createIndex({ userId: 1, parentId: 1 });

db.userVideos.createIndex({ userId: 1, youtubeId: 1, folderId: 1 }, { unique: true });
db.userVideos.createIndex({ userId: 1, folderId: 1 });
db.userVideos.createIndex({ userId: 1, createdAt: -1 });

db.memorizedItems.createIndex({ userId: 1, folderId: 1 });
db.memorizedItems.createIndex({ userId: 1, 'source.videoSummaryId': 1 });
db.memorizedItems.createIndex({ userId: 1, tags: 1 });
db.memorizedItems.createIndex({ userId: 1, createdAt: -1 });

db.userChats.createIndex({ userId: 1, memorizedItemId: 1 });
db.userChats.createIndex({ userId: 1, updatedAt: -1 });

print('✅ All indexes created');
