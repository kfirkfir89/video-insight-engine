import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
  }
}

async function mongodb(fastify: FastifyInstance) {
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();

  const db = client.db();

  fastify.decorate('mongo', { client, db });

  // Create indexes on app ready
  fastify.addHook('onReady', async () => {
    try {
      // videoSummaryCache indexes
      await db.collection('videoSummaryCache').createIndexes([
        { key: { youtubeId: 1, isLatest: 1 } },
        { key: { youtubeId: 1, version: -1 } },
        { key: { status: 1 } },
        { key: { outputType: 1 } },
        { key: { shareSlug: 1 }, unique: true, sparse: true },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      ]);

      // userVideos indexes
      await db.collection('userVideos').createIndexes([
        { key: { userId: 1, videoSummaryId: 1 } },
        { key: { userId: 1, folderId: 1 } },
        { key: { userId: 1, youtubeId: 1, folderId: 1 } },
        { key: { userId: 1, createdAt: -1 } },
        { key: { userId: 1, 'playlistInfo.playlistId': 1 } },
      ]);

      // folders indexes
      await db.collection('folders').createIndexes([
        { key: { userId: 1, type: 1, path: 1 } },
        { key: { userId: 1, parentId: 1 } },
      ]);

      // memorizedItems indexes
      await db.collection('memorizedItems').createIndexes([
        { key: { userId: 1, folderId: 1 } },
        { key: { userId: 1, 'source.videoSummaryId': 1 } },
        { key: { userId: 1, createdAt: -1 } },
      ]);

      // users indexes
      await db.collection('users').createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { tier: 1 } },
      ]);

      // shareLikes indexes
      await db.collection('shareLikes').createIndexes([
        { key: { shareSlug: 1, ipHash: 1 }, unique: true },
      ]);

      // llm_usage indexes (auto-cleanup old records)
      await db.collection('llm_usage').createIndexes([
        { key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 60 * 60 }, // 90-day TTL
      ]);

      // userChats indexes
      await db.collection('userChats').createIndexes([
        { key: { userId: 1, memorizedItemId: 1 } },
        { key: { userId: 1, updatedAt: -1 } },
      ]);

      fastify.log.info('MongoDB indexes created');
    } catch (err) {
      fastify.log.warn({ err }, 'Some indexes may already exist or failed to create');
    }
  });

  fastify.addHook('onClose', async () => {
    await client.close();
  });

  fastify.log.info('MongoDB connected');
}

export const mongodbPlugin = fp(mongodb);
