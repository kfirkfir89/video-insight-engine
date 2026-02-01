import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { VideoRepository } from './video.repository.js';

describe('VideoRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repository: VideoRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');
    repository = new VideoRepository(db);
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('videoSummaryCache').deleteMany({});
    await db.collection('userVideos').deleteMany({});
  });

  describe('userHasAccessToSummary', () => {
    it('should return true when user has access to video summary', async () => {
      const userId = new ObjectId().toString();
      const videoSummaryId = new ObjectId();

      // Create a cache entry first
      await db.collection('videoSummaryCache').insertOne({
        _id: videoSummaryId,
        youtubeId: 'test123',
        url: 'https://youtube.com/watch?v=test123',
        status: 'completed',
        version: 1,
        isLatest: true,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user video entry
      await db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId,
        youtubeId: 'test123',
        status: 'completed',
        folderId: null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const hasAccess = await repository.userHasAccessToSummary(userId, videoSummaryId.toString());
      expect(hasAccess).toBe(true);
    });

    it('should return false when user does not have access to video summary', async () => {
      const userId = new ObjectId().toString();
      const videoSummaryId = new ObjectId().toString();

      const hasAccess = await repository.userHasAccessToSummary(userId, videoSummaryId);
      expect(hasAccess).toBe(false);
    });

    it('should return false for different user', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();
      const videoSummaryId = new ObjectId();

      // Create user video for different user
      await db.collection('userVideos').insertOne({
        userId: new ObjectId(otherUserId),
        videoSummaryId,
        youtubeId: 'test123',
        status: 'completed',
        folderId: null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const hasAccess = await repository.userHasAccessToSummary(userId, videoSummaryId.toString());
      expect(hasAccess).toBe(false);
    });
  });

  describe('userOwnsVideo', () => {
    it('should return true when user owns video', async () => {
      const userId = new ObjectId().toString();
      const youtubeId = 'dQw4w9WgXcQ';

      await db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: new ObjectId(),
        youtubeId,
        status: 'completed',
        folderId: null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const owns = await repository.userOwnsVideo(userId, youtubeId);
      expect(owns).toBe(true);
    });

    it('should return false when user does not own video', async () => {
      const userId = new ObjectId().toString();
      const youtubeId = 'nonexistent';

      const owns = await repository.userOwnsVideo(userId, youtubeId);
      expect(owns).toBe(false);
    });
  });
});
