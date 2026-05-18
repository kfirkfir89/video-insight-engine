import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  UserCostRepository,
  getUtcDateKey,
  getNextUtcMidnightIso,
} from '../user-cost.repository.js';

describe('UserCostRepository', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: UserCostRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('test');
    repo = new UserCostRepository(db);

    await db.collection('userCosts').createIndex(
      { userId: 1, date: 1 },
      { unique: true },
    );
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('userCosts').deleteMany({});
    await db.collection('userCostAdjustments').deleteMany({});
  });

  const userId = new ObjectId().toString();
  const today = getUtcDateKey();

  describe('getUtcDateKey', () => {
    it('should format a date as YYYY-MM-DD in UTC', () => {
      const date = new Date('2026-01-05T03:30:00Z');
      expect(getUtcDateKey(date)).toBe('2026-01-05');
    });

    it('should pad single-digit months and days with zeros', () => {
      const date = new Date('2026-09-09T00:00:00Z');
      expect(getUtcDateKey(date)).toBe('2026-09-09');
    });
  });

  describe('getNextUtcMidnightIso', () => {
    it('should return the next UTC midnight after the given date', () => {
      const date = new Date('2026-05-14T12:00:00Z');
      expect(getNextUtcMidnightIso(date)).toBe('2026-05-15T00:00:00.000Z');
    });
  });

  describe('findByUserAndDate', () => {
    it('should return null when the user has no record for the day', async () => {
      const result = await repo.findByUserAndDate(userId, today);
      expect(result).toBeNull();
    });

    it('should return the record after an increment', async () => {
      await repo.incrementDailyCost(userId, today, 1.25);
      const found = await repo.findByUserAndDate(userId, today);
      expect(found?.totalCostUsd).toBeCloseTo(1.25);
    });
  });

  describe('incrementDailyCost', () => {
    it('should upsert a new doc when none exists', async () => {
      await repo.incrementDailyCost(userId, today, 0.42, true);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.totalCostUsd).toBeCloseTo(0.42);
      expect(doc?.videoCount).toBe(1);
      expect(doc?.creditAdjustmentUsd).toBe(0);
    });

    it('should accumulate cost across calls atomically', async () => {
      await Promise.all([
        repo.incrementDailyCost(userId, today, 0.1, true),
        repo.incrementDailyCost(userId, today, 0.2, true),
        repo.incrementDailyCost(userId, today, 0.3, true),
      ]);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.totalCostUsd).toBeCloseTo(0.6);
      expect(doc?.videoCount).toBe(3);
    });

    it('should skip the write when cost is 0 and video count flag is off', async () => {
      await repo.incrementDailyCost(userId, today, 0);
      expect(await repo.findByUserAndDate(userId, today)).toBeNull();
    });
  });

  describe('getEffectiveCost', () => {
    it('should return 0 when there is no record', async () => {
      expect(await repo.getEffectiveCost(userId, today)).toBe(0);
    });

    it('should add totalCostUsd and creditAdjustmentUsd', async () => {
      await repo.incrementDailyCost(userId, today, 5);
      await repo.addAdjustment(userId, today, -2, 'goodwill', new ObjectId().toString());

      expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(3);
    });
  });

  describe('addAdjustment', () => {
    it('should write an adjustment row and update the daily doc', async () => {
      const adminId = new ObjectId().toString();
      await repo.addAdjustment(userId, today, -1.5, 'manual credit', adminId);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.creditAdjustmentUsd).toBeCloseTo(-1.5);

      const adjustments = await repo.findAdjustments(userId);
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].amountUsd).toBeCloseTo(-1.5);
      expect(adjustments[0].reason).toBe('manual credit');
      expect(adjustments[0].adminId.toString()).toBe(adminId);
    });
  });

  describe('setDailyCost', () => {
    it('should overwrite the day totals while preserving adjustments', async () => {
      await repo.addAdjustment(userId, today, -1, 'previous credit', new ObjectId().toString());
      await repo.setDailyCost(userId, today, 4.2, 2);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.totalCostUsd).toBeCloseTo(4.2);
      expect(doc?.videoCount).toBe(2);
      expect(doc?.creditAdjustmentUsd).toBeCloseTo(-1);
    });
  });

  describe('incrementAndReturnEffective', () => {
    it('should return the post-increment effective cost (totals + adjustments)', async () => {
      await repo.addAdjustment(userId, today, -0.5, 'credit', new ObjectId().toString());
      const result = await repo.incrementAndReturnEffective(userId, today, 1.0, true);
      expect(result.totalCostUsd).toBeCloseTo(1.0);
      expect(result.creditAdjustmentUsd).toBeCloseTo(-0.5);
      expect(result.effectiveUsd).toBeCloseTo(0.5);
    });

    it('should give each concurrent caller a distinct ordered post-state', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => repo.incrementAndReturnEffective(userId, today, 0.1, true)),
      );
      const totals = results.map((r) => r.totalCostUsd).sort((a, b) => a - b);
      // Each successive operation should observe a strictly larger post-state
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i]).toBeGreaterThan(totals[i - 1]);
      }
      expect(totals[totals.length - 1]).toBeCloseTo(1.0);
    });
  });

  describe('refundReservation', () => {
    it('should decrement both cost and videoCount atomically', async () => {
      await repo.incrementDailyCost(userId, today, 0.15, true);
      await repo.incrementDailyCost(userId, today, 0.15, true);

      await repo.refundReservation(userId, today, 0.15);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.totalCostUsd).toBeCloseTo(0.15);
      expect(doc?.videoCount).toBe(1);
    });

    it('should be a no-op when costUsd is zero or negative', async () => {
      await repo.incrementDailyCost(userId, today, 0.5, true);
      await repo.refundReservation(userId, today, 0);
      await repo.refundReservation(userId, today, -1);

      const doc = await repo.findByUserAndDate(userId, today);
      expect(doc?.totalCostUsd).toBeCloseTo(0.5);
      expect(doc?.videoCount).toBe(1);
    });
  });

  describe('findRange', () => {
    it('should return docs for the trailing window', async () => {
      const otherUserId = new ObjectId().toString();
      await repo.incrementDailyCost(userId, today, 1, true);
      await repo.incrementDailyCost(otherUserId, today, 9, true);

      const rows = await repo.findRange(userId, 7);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId.toString()).toBe(userId);
    });
  });

  describe('aggregateUsersOverRange', () => {
    it('should sort users by effective spend descending', async () => {
      const lowSpender = new ObjectId().toString();
      const highSpender = new ObjectId().toString();

      await repo.incrementDailyCost(lowSpender, today, 1, true);
      await repo.incrementDailyCost(highSpender, today, 5, true);

      const rows = await repo.aggregateUsersOverRange(7);
      expect(rows).toHaveLength(2);
      expect(rows[0].userId).toBe(highSpender);
      expect(rows[0].effectiveUsd).toBeCloseTo(5);
      expect(rows[1].userId).toBe(lowSpender);
    });

    it('should subtract credit adjustments from effective spend', async () => {
      const adminId = new ObjectId().toString();
      await repo.incrementDailyCost(userId, today, 4, true);
      await repo.addAdjustment(userId, today, -3, 'credit', adminId);

      const rows = await repo.aggregateUsersOverRange(7);
      expect(rows[0].effectiveUsd).toBeCloseTo(1);
    });
  });
});
