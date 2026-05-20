import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { IdempotencyRepository, type ReserveHashInput } from '../idempotency.repository.js';

describe('IdempotencyRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: IdempotencyRepository;

  const makeReserveInput = (overrides: Partial<ReserveHashInput> = {}): ReserveHashInput => ({
    hash: 'h-' + new ObjectId().toString(),
    userId: new ObjectId().toString(),
    youtubeId: 'dQw4w9WgXcQ',
    pipelineVersion: 'v1',
    ttlSeconds: 86400,
    ...overrides,
  });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('test');
    repo = new IdempotencyRepository(db);

    await db.collection('idempotencyKeys').createIndex({ hash: 1 }, { unique: true });
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('idempotencyKeys').deleteMany({});
  });

  describe('findByHash', () => {
    it('should return null when the hash has not been reserved', async () => {
      const result = await repo.findByHash('nonexistent');
      expect(result).toBeNull();
    });

    it('should return the placeholder doc after reserveHash', async () => {
      const input = makeReserveInput({ hash: 'abc123' });
      await repo.reserveHash(input);

      const found = await repo.findByHash('abc123');
      expect(found).not.toBeNull();
      expect(found?.hash).toBe('abc123');
      expect(found?.youtubeId).toBe('dQw4w9WgXcQ');
      expect(found?.status).toBe('pending');
      expect(found?.userId.toString()).toBe(input.userId);
    });
  });

  describe('reserveHash', () => {
    it('should insert a pending placeholder with no videoSummaryId/userVideoId yet', async () => {
      const result = await repo.reserveHash(makeReserveInput({ hash: 'p1' }));
      expect(result.created).toBe(true);
      expect(result.doc.status).toBe('pending');
      expect(result.doc.videoSummaryId).toBeUndefined();
      expect(result.doc.userVideoId).toBeUndefined();
    });

    it('should set expiresAt based on ttlSeconds', async () => {
      const before = Date.now();
      const result = await repo.reserveHash(makeReserveInput({ ttlSeconds: 60 }));
      const after = Date.now();

      const doc = result.doc;
      const ttlMs = doc.expiresAt.getTime() - doc.createdAt.getTime();
      expect(ttlMs).toBe(60_000);
      expect(doc.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(doc.createdAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should return { created: false, doc: existing } when the hash collides (race)', async () => {
      const sharedHash = 'race-hash';
      const first = await repo.reserveHash(makeReserveInput({ hash: sharedHash, youtubeId: 'first00000' }));
      const second = await repo.reserveHash(makeReserveInput({ hash: sharedHash, youtubeId: 'second0000' }));

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.doc._id.toString()).toBe(first.doc._id.toString());
      expect(second.doc.youtubeId).toBe('first00000');
    });

    it('should serialize concurrent reserveHash calls — exactly one row inserted', async () => {
      const sharedHash = 'concurrent-hash';
      const results = await Promise.all(
        Array.from({ length: 5 }, () => repo.reserveHash(makeReserveInput({ hash: sharedHash }))),
      );

      const winners = results.filter((r) => r.created);
      expect(winners).toHaveLength(1);

      const uniqueIds = new Set(results.map((r) => r.doc._id.toString()));
      expect(uniqueIds.size).toBe(1);

      const count = await db.collection('idempotencyKeys').countDocuments({ hash: sharedHash });
      expect(count).toBe(1);
    });

    it('should snapshot pipelineVersion on the placeholder', async () => {
      const result = await repo.reserveHash(makeReserveInput({ pipelineVersion: 'v42' }));
      expect(result.doc.pipelineVersion).toBe('v42');
    });
  });

  describe('completeHash', () => {
    it('should promote a pending row to completed with the IDs', async () => {
      const hash = 'to-complete';
      await repo.reserveHash(makeReserveInput({ hash }));

      const summaryId = new ObjectId().toString();
      const userVideoId = new ObjectId().toString();
      await repo.completeHash({ hash, videoSummaryId: summaryId, userVideoId });

      const after = await repo.findByHash(hash);
      expect(after?.status).toBe('completed');
      expect(after?.videoSummaryId?.toString()).toBe(summaryId);
      expect(after?.userVideoId?.toString()).toBe(userVideoId);
    });

    it('should be idempotent — re-completing produces the same end state', async () => {
      const hash = 'double-complete';
      await repo.reserveHash(makeReserveInput({ hash }));
      const summaryId = new ObjectId().toString();
      const userVideoId = new ObjectId().toString();

      await repo.completeHash({ hash, videoSummaryId: summaryId, userVideoId });
      await repo.completeHash({ hash, videoSummaryId: summaryId, userVideoId });

      const after = await repo.findByHash(hash);
      expect(after?.status).toBe('completed');
      expect(after?.videoSummaryId?.toString()).toBe(summaryId);
    });

    it('should NOT overwrite an already-completed row (status-scoped)', async () => {
      // Guards against a race where the stale-hit cleanup deletes the original
      // row and a parallel request re-reserves+completes a fresh one. A late
      // completeHash from the original request must not stomp the new owner.
      const hash = 'no-overwrite';
      await repo.reserveHash(makeReserveInput({ hash }));
      const firstSummary = new ObjectId().toString();
      const firstUserVideo = new ObjectId().toString();
      await repo.completeHash({ hash, videoSummaryId: firstSummary, userVideoId: firstUserVideo });

      const otherSummary = new ObjectId().toString();
      const otherUserVideo = new ObjectId().toString();
      await repo.completeHash({ hash, videoSummaryId: otherSummary, userVideoId: otherUserVideo });

      const after = await repo.findByHash(hash);
      expect(after?.videoSummaryId?.toString()).toBe(firstSummary);
      expect(after?.userVideoId?.toString()).toBe(firstUserVideo);
    });
  });

  describe('invalidateByHash', () => {
    it('should remove a single key', async () => {
      const hash = 'to-remove';
      await repo.reserveHash(makeReserveInput({ hash }));

      await repo.invalidateByHash(hash);
      expect(await repo.findByHash(hash)).toBeNull();
    });

    it('should be a no-op when the hash is unknown', async () => {
      await expect(repo.invalidateByHash('never-existed')).resolves.toBeUndefined();
    });
  });

  describe('invalidateStaleCompleted', () => {
    it('should delete only when status is completed AND videoSummaryId matches', async () => {
      const hash = 'stale-hit';
      const summaryId = new ObjectId().toString();
      const userVideoId = new ObjectId().toString();
      await repo.reserveHash(makeReserveInput({ hash }));
      await repo.completeHash({ hash, videoSummaryId: summaryId, userVideoId });

      await repo.invalidateStaleCompleted(hash, summaryId);
      expect(await repo.findByHash(hash)).toBeNull();
    });

    it('should leave a fresh pending row untouched (race-safe)', async () => {
      // Simulates: observed completed row was already replaced by a fresh
      // pending reservation. The stale cleanup must not delete the new row.
      const hash = 'race-safe';
      const summaryId = new ObjectId().toString();
      await repo.reserveHash(makeReserveInput({ hash }));

      await repo.invalidateStaleCompleted(hash, summaryId);

      const doc = await repo.findByHash(hash);
      expect(doc).not.toBeNull();
      expect(doc?.status).toBe('pending');
    });

    it('should leave a completed row with a different summaryId untouched', async () => {
      const hash = 'different-summary';
      const otherSummary = new ObjectId().toString();
      const userVideoId = new ObjectId().toString();
      await repo.reserveHash(makeReserveInput({ hash }));
      await repo.completeHash({ hash, videoSummaryId: otherSummary, userVideoId });

      await repo.invalidateStaleCompleted(hash, new ObjectId().toString());

      const doc = await repo.findByHash(hash);
      expect(doc).not.toBeNull();
      expect(doc?.videoSummaryId?.toString()).toBe(otherSummary);
    });
  });

  describe('invalidateByVideoSummaryId', () => {
    it('should remove every completed key pointing at the given summary id', async () => {
      const summaryId = new ObjectId().toString();
      const userVideoId = new ObjectId().toString();

      await repo.reserveHash(makeReserveInput({ hash: 'h1' }));
      await repo.completeHash({ hash: 'h1', videoSummaryId: summaryId, userVideoId });

      await repo.reserveHash(makeReserveInput({ hash: 'h2' }));
      await repo.completeHash({ hash: 'h2', videoSummaryId: summaryId, userVideoId });

      await repo.reserveHash(makeReserveInput({ hash: 'other' }));
      await repo.completeHash({
        hash: 'other',
        videoSummaryId: new ObjectId().toString(),
        userVideoId: new ObjectId().toString(),
      });

      await repo.invalidateByVideoSummaryId(summaryId);

      expect(await repo.findByHash('h1')).toBeNull();
      expect(await repo.findByHash('h2')).toBeNull();
      expect(await repo.findByHash('other')).not.toBeNull();
    });

    it('should leave pending rows alone (no videoSummaryId yet)', async () => {
      await repo.reserveHash(makeReserveInput({ hash: 'pending-row' }));
      const summaryId = new ObjectId().toString();

      await repo.invalidateByVideoSummaryId(summaryId);

      expect(await repo.findByHash('pending-row')).not.toBeNull();
    });

    it('should be a no-op when no keys match', async () => {
      const summaryId = new ObjectId().toString();
      await expect(repo.invalidateByVideoSummaryId(summaryId)).resolves.toBeUndefined();
    });
  });
});
