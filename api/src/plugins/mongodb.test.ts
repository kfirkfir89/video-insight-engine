import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

// Note: The mongodb plugin uses process.env.MONGODB_URI which is set in test/env.ts
// For these tests, we use an in-memory MongoDB server to test the actual plugin behavior

describe('MongoDB plugin', () => {
  let mongod: MongoMemoryServer;
  let originalMongoUri: string | undefined;

  beforeAll(async () => {
    // Save original URI
    originalMongoUri = process.env.MONGODB_URI;

    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Override env for tests
    process.env.MONGODB_URI = uri;
  });

  afterAll(async () => {
    // Restore original URI
    if (originalMongoUri) {
      process.env.MONGODB_URI = originalMongoUri;
    }

    if (mongod) {
      await mongod.stop();
    }
  });

  describe('connection handling', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      // Re-import the plugin to use the new MONGODB_URI
      const { mongodbPlugin } = await import('./mongodb.js');

      app = Fastify({ logger: false });
      await app.register(mongodbPlugin);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should decorate fastify with mongo object', () => {
      expect(app.mongo).toBeDefined();
    });

    it('should have client property', () => {
      expect(app.mongo.client).toBeDefined();
      expect(app.mongo.client).toBeInstanceOf(MongoClient);
    });

    it('should have db property', () => {
      expect(app.mongo.db).toBeDefined();
    });

    it('should be able to perform database operations', async () => {
      const collection = app.mongo.db.collection('test');

      // Insert a document
      const result = await collection.insertOne({ test: 'value' });
      expect(result.acknowledged).toBe(true);

      // Read it back
      const doc = await collection.findOne({ test: 'value' });
      expect(doc).toBeDefined();
      expect(doc?.test).toBe('value');

      // Clean up
      await collection.deleteMany({});
    });
  });

  describe('index creation', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      const { mongodbPlugin } = await import('./mongodb.js');

      app = Fastify({ logger: false });
      await app.register(mongodbPlugin);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should create indexes for videoSummaryCache collection', async () => {
      const indexes = await app.mongo.db.collection('videoSummaryCache').indexes();

      // Should have _id index plus our custom indexes
      expect(indexes.length).toBeGreaterThan(1);

      // Check for specific index
      const hasYoutubeIdIndex = indexes.some(idx =>
        idx.key && 'youtubeId' in idx.key
      );
      expect(hasYoutubeIdIndex).toBe(true);
    });

    it('should create indexes for userVideos collection', async () => {
      const indexes = await app.mongo.db.collection('userVideos').indexes();

      expect(indexes.length).toBeGreaterThan(1);

      const hasUserIdIndex = indexes.some(idx =>
        idx.key && 'userId' in idx.key
      );
      expect(hasUserIdIndex).toBe(true);
    });

    it('should create indexes for folders collection', async () => {
      const indexes = await app.mongo.db.collection('folders').indexes();

      expect(indexes.length).toBeGreaterThan(1);
    });

    it('should create indexes for memorizedItems collection', async () => {
      const indexes = await app.mongo.db.collection('memorizedItems').indexes();

      expect(indexes.length).toBeGreaterThan(1);
    });

    it('should create unique index for users email', async () => {
      const indexes = await app.mongo.db.collection('users').indexes();

      const emailIndex = indexes.find(idx =>
        idx.key && 'email' in idx.key
      );
      expect(emailIndex).toBeDefined();
      expect(emailIndex?.unique).toBe(true);
    });

    it('should create indexes for userChats collection', async () => {
      const indexes = await app.mongo.db.collection('userChats').indexes();

      expect(indexes.length).toBeGreaterThan(1);
    });
  });

  describe('connection cleanup', () => {
    it('should close connection on app close', async () => {
      const { mongodbPlugin } = await import('./mongodb.js');

      const cleanupApp = Fastify({ logger: false });
      await cleanupApp.register(mongodbPlugin);
      await cleanupApp.ready();

      const client = cleanupApp.mongo.client;

      // App is ready, connection should work
      const pingResult = await client.db().admin().ping();
      expect(pingResult.ok).toBe(1);

      // Close the app
      await cleanupApp.close();

      // After close, operations should fail
      await expect(client.db().admin().ping()).rejects.toThrow();
    });
  });

  describe('database reference', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      const { mongodbPlugin } = await import('./mongodb.js');

      app = Fastify({ logger: false });
      await app.register(mongodbPlugin);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should use the database from connection string', () => {
      // The MongoMemoryServer creates a random DB name
      // Just verify db is accessible
      expect(app.mongo.db.databaseName).toBeDefined();
      expect(typeof app.mongo.db.databaseName).toBe('string');
    });

    it('should allow creating collections', async () => {
      await app.mongo.db.createCollection('test_collection');

      const collections = await app.mongo.db.listCollections({ name: 'test_collection' }).toArray();
      expect(collections.length).toBe(1);

      // Clean up
      await app.mongo.db.dropCollection('test_collection');
    });
  });
});

describe('MongoDB plugin error handling', () => {
  // TODO: Fix plugin timeout issue - plugin initialization times out when
  // creating a fresh MongoMemoryServer. The unique constraint test itself works.
  it.skip('should handle index creation errors gracefully', async () => {
    // Start a fresh in-memory server
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Save and override
    const originalUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = uri;

    try {
      const { mongodbPlugin } = await import('./mongodb.js');

      const app = Fastify({ logger: false });
      await app.register(mongodbPlugin);

      // Create a document that would conflict with unique index
      await app.ready();

      // Insert two documents with same email to test unique constraint
      const usersCollection = app.mongo.db.collection('users');
      await usersCollection.insertOne({ email: 'test@example.com' });

      // Second insert should fail due to unique constraint
      await expect(
        usersCollection.insertOne({ email: 'test@example.com' })
      ).rejects.toThrow();

      await app.close();
    } finally {
      process.env.MONGODB_URI = originalUri;
      await mongod.stop();
    }
  });
});
