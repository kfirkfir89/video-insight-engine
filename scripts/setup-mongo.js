// Run with: mongosh mongodb://localhost:27017/video-insight-engine scripts/setup-mongo.js

// System Cache
db.videoSummaryCache.createIndex({ youtubeId: 1 }, { unique: true });
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

db.userVideos.createIndex({ userId: 1, videoSummaryId: 1 }, { unique: true });
db.userVideos.createIndex({ userId: 1, folderId: 1 });
db.userVideos.createIndex({ userId: 1, createdAt: -1 });

db.memorizedItems.createIndex({ userId: 1, folderId: 1 });
db.memorizedItems.createIndex({ userId: 1, 'source.videoSummaryId': 1 });
db.memorizedItems.createIndex({ userId: 1, tags: 1 });
db.memorizedItems.createIndex({ userId: 1, createdAt: -1 });

db.userChats.createIndex({ userId: 1, memorizedItemId: 1 });
db.userChats.createIndex({ userId: 1, updatedAt: -1 });

print('✅ All indexes created');
