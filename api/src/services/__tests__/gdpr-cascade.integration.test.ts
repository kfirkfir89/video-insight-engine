import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import type { FastifyBaseLogger } from 'fastify';
import bcrypt from 'bcrypt';

import { UserRepository } from '../../repositories/user.repository.js';
import { UserDeletionRepository } from '../../repositories/user-deletion.repository.js';
import { UserDeletionService, hashEmail } from '../user-deletion.service.js';

/**
 * Compliance-grade end-to-end integration test for the GDPR cascade.
 *
 * Seeds a user with rows in **every** user-scoped collection in the
 * inventory, fires the immediate-delete path, and asserts:
 *  - zero rows remain in every user-scoped collection
 *  - the audit row exists with the right hashed email and counts
 *  - other users' data is left untouched
 *  - Qdrant + S3 hooks return zero (placeholder steps documented in the
 *    inventory report; verified here to keep the contract honest).
 *
 * This is the single most important test for compliance — Phase 7 of the
 * task plan calls it out as the regression gate for every future change.
 */

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => silentLogger),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

describe('GDPR cascade deletion — end-to-end integration', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let userRepo: UserRepository;
  let deletionRepo: UserDeletionRepository;
  let service: UserDeletionService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('gdpr-e2e');
    userRepo = new UserRepository(db);
    deletionRepo = new UserDeletionRepository(db);
    service = new UserDeletionService(db, userRepo, deletionRepo, silentLogger);
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const collections = await db.listCollections().toArray();
    for (const c of collections) await db.collection(c.name).deleteMany({});
  });

  it('removes every user-scoped row, leaves other users alone, and writes an audit', async () => {
    // ─── Seed the doomed user across the entire inventory ─────────────────
    const doomed = await userRepo.create({
      email: 'doomed@example.com',
      passwordHash: await bcrypt.hash('correct horse battery staple', 4),
      name: 'Doomed User',
    });
    const doomedId = doomed._id;

    // Three videos (the canonical Phase 7 ask: "Create user + 3 videos…")
    const videoSummaryIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    for (const [i, vsid] of videoSummaryIds.entries()) {
      await db.collection('userVideos').insertOne({
        userId: doomedId,
        videoSummaryId: vsid,
        youtubeId: `yt-${i}`,
        title: `Video ${i}`,
        status: 'completed',
        folderId: null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Two folders + one nested
    await db.collection('folders').insertMany([
      { userId: doomedId, name: 'Work', path: '/Work', level: 0 },
      { userId: doomedId, name: 'Personal', path: '/Personal', level: 0 },
      { userId: doomedId, name: 'Notes', path: '/Work/Notes', level: 1 },
    ]);

    // Daily cost row + adjustment
    await db.collection('userCosts').insertOne({
      userId: doomedId,
      date: '2026-05-20',
      rawUsd: 4.2,
      adjustmentUsd: -1,
      effectiveUsd: 3.2,
    });
    await db.collection('userCostAdjustments').insertOne({
      userId: doomedId,
      date: '2026-05-20',
      amount: -1,
      reason: 'goodwill',
    });

    // Idempotency rows
    await db.collection('idempotencyKeys').insertMany([
      { userId: doomedId, hash: 'h1', status: 'completed', expiresAt: new Date(Date.now() + 86400000) },
      { userId: doomedId, hash: 'h2', status: 'pending', expiresAt: new Date(Date.now() + 86400000) },
    ]);

    // Assistant notes — stored with userId as a string in the agent service.
    await db.collection('agentNotes').insertMany([
      { _id: 'n1', userId: doomedId.toString(), videoId: 'yt-0', text: 'Important', createdAt: new Date() } as unknown as Document,
      { _id: 'n2', userId: doomedId.toString(), videoId: 'yt-1', text: 'Bookmark', createdAt: new Date() } as unknown as Document,
      { _id: 'n3', userId: doomedId.toString(), videoId: 'yt-2', text: 'Highlight', createdAt: new Date() } as unknown as Document,
    ]);

    // ─── Seed a second user whose data MUST NOT be touched ────────────────
    const witness = await userRepo.create({
      email: 'witness@example.com',
      passwordHash: await bcrypt.hash('not relevant', 4),
      name: 'Witness',
    });
    await db.collection('userVideos').insertOne({
      userId: witness._id,
      videoSummaryId: new ObjectId(),
      youtubeId: 'wit-1',
      status: 'completed',
      folderId: null,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection('folders').insertOne({
      userId: witness._id,
      name: 'WitnessFolder',
      path: '/WitnessFolder',
      level: 0,
    });
    await db.collection('userCosts').insertOne({
      userId: witness._id,
      date: '2026-05-20',
      rawUsd: 0.5,
    });
    await db.collection('agentNotes').insertOne({
      _id: 'w1',
      userId: witness._id.toString(),
      videoId: 'wit-1',
      text: 'Witness note',
      createdAt: new Date(),
    } as unknown as Document);

    // ─── Shared cache row that BOTH users referenced. Must NOT be deleted ─
    await db.collection('videoSummaryCache').insertOne({
      _id: videoSummaryIds[0],
      youtubeId: 'yt-0',
      status: 'completed',
      isLatest: true,
      version: 1,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ─── Fire the cascade (admin immediate-delete path) ───────────────────
    const audit = await service.executeHardDelete(doomedId.toString(), {
      initiatedBy: 'admin',
      adminId: 'compliance-op-1',
      reason: 'GDPR request #4567',
    });

    // ─── 1. Doomed user is gone from every user-scoped collection ─────────
    expect(await userRepo.findById(doomedId.toString())).toBeNull();
    expect(await db.collection('userVideos').countDocuments({ userId: doomedId })).toBe(0);
    expect(await db.collection('folders').countDocuments({ userId: doomedId })).toBe(0);
    expect(await db.collection('userCosts').countDocuments({ userId: doomedId })).toBe(0);
    expect(await db.collection('userCostAdjustments').countDocuments({ userId: doomedId })).toBe(0);
    expect(await db.collection('idempotencyKeys').countDocuments({ userId: doomedId })).toBe(0);
    expect(await db.collection('agentNotes').countDocuments({ userId: doomedId.toString() })).toBe(0);

    // ─── 2. Audit row exists with hashed email and accurate counts ────────
    expect(audit.emailHash).toBe(hashEmail('doomed@example.com'));
    expect(audit.emailHash).not.toContain('doomed');
    expect(audit.emailHash).not.toContain('@');
    expect(audit.initiatedBy).toBe('admin');
    expect(audit.adminId).toBe('compliance-op-1');
    expect(audit.reason).toBe('GDPR request #4567');
    expect(audit.counts).toEqual({
      userVideos: 3,
      folders: 3,
      userCosts: 1,
      userCostAdjustments: 1,
      idempotencyKeys: 2,
      assistantNotes: 3,
      qdrantPoints: 0, // see reports/user-data-inventory.md — shared, not user-keyed
      s3Objects: 0,    // see reports/user-data-inventory.md — shared, not user-keyed
    });
    expect(audit.warnings ?? []).toEqual([]);
    expect(audit.durationMs).toBeGreaterThanOrEqual(0);

    // Audit row is queryable by hashed email — proof of cascade for legal.
    const byHash = await deletionRepo.findByEmailHash(audit.emailHash);
    expect(byHash?.originalUserId).toBe(doomedId.toString());

    // ─── 3. The witness user is fully intact ──────────────────────────────
    expect(await userRepo.findById(witness._id.toString())).not.toBeNull();
    expect(await db.collection('userVideos').countDocuments({ userId: witness._id })).toBe(1);
    expect(await db.collection('folders').countDocuments({ userId: witness._id })).toBe(1);
    expect(await db.collection('userCosts').countDocuments({ userId: witness._id })).toBe(1);
    expect(await db.collection('agentNotes').countDocuments({ userId: witness._id.toString() })).toBe(1);

    // ─── 4. Shared resources are untouched ────────────────────────────────
    expect(await db.collection('videoSummaryCache').countDocuments({})).toBe(1);
  });

  it('completes the full self-service flow: soft-delete → wait → scheduler hard-deletes', async () => {
    const target = await userRepo.create({
      email: 'self-flow@example.com',
      passwordHash: '$2b$10$fake',
      name: 'Self-flow',
    });
    await db.collection('userVideos').insertOne({
      userId: target._id,
      videoSummaryId: new ObjectId(),
      youtubeId: 'self-1',
      status: 'completed',
      folderId: null,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Step 1: user requests deletion → soft-deleted, hardDeleteAt in 30 days.
    const requestedAt = new Date('2026-05-20T12:00:00Z');
    const flow = new UserDeletionService(
      db,
      userRepo,
      deletionRepo,
      silentLogger,
      () => requestedAt,
    );
    const result = await flow.requestDeletion(target._id.toString());
    expect(result.scheduledHardDeleteAt).toEqual(new Date('2026-06-19T12:00:00Z'));

    const afterSoftDelete = await userRepo.findById(target._id.toString());
    expect(afterSoftDelete?.deletedAt).toEqual(requestedAt);
    // Data still exists in the grace window — recovery must be possible.
    expect(await db.collection('userVideos').countDocuments({ userId: target._id })).toBe(1);

    // Step 2: scheduler runs at T+15 days (still in grace) — must not delete.
    const fifteenDaysLater = new Date('2026-06-04T12:00:00Z');
    const earlyRun = await flow.runScheduledDeletions(fifteenDaysLater);
    expect(earlyRun.processed).toBe(0);
    expect(await userRepo.findById(target._id.toString())).not.toBeNull();

    // Step 3: scheduler runs at T+31 days — past the grace window → cascade.
    const thirtyOneDaysLater = new Date('2026-06-20T12:00:00Z');
    const lateRun = await flow.runScheduledDeletions(thirtyOneDaysLater);
    expect(lateRun.processed).toBe(1);
    expect(lateRun.succeeded).toBe(1);

    // Step 4: every trace of the user is gone, audit exists.
    expect(await userRepo.findById(target._id.toString())).toBeNull();
    expect(await db.collection('userVideos').countDocuments({ userId: target._id })).toBe(0);
    const audit = await deletionRepo.findByEmailHash(hashEmail('self-flow@example.com'));
    expect(audit).not.toBeNull();
    expect(audit?.initiatedBy).toBe('scheduler');
  });
});
