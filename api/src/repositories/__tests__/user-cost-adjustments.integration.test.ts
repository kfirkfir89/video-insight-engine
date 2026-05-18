import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  UserCostRepository,
  getUtcDateKey,
} from '../user-cost.repository.js';

/** Integration test exercising the admin grant-credit audit trail end-to-end:
 *
 *  1. Admin grants $1.50 credit → effective spend drops by $1.50.
 *  2. Audit row is persisted with admin id, reason, and signed amount.
 *  3. A second grant compounds atomically (so concurrent admin grants don't overwrite).
 *  4. A negative grant (admin charges the user manually) flows through.
 */
describe('UserCostRepository — admin grant-credit audit', () => {
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
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.collection('userCosts').deleteMany({});
    await db.collection('userCostAdjustments').deleteMany({});
  });

  it('should reduce effective spend after a credit grant and write an audit row', async () => {
    const userId = new ObjectId().toString();
    const adminId = new ObjectId().toString();
    const today = getUtcDateKey();

    await repo.incrementDailyCost(userId, today, 1.8, true);
    expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(1.8);

    // Admin grants $1.00 credit (signed -1 in storage)
    await repo.addAdjustment(userId, today, -1, 'goodwill', adminId);

    expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(0.8);

    const adjustments = await repo.findAdjustments(userId);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({
      reason: 'goodwill',
      amountUsd: -1,
    });
    expect(adjustments[0].adminId.toString()).toBe(adminId);
  });

  it('should compound multiple grants atomically across concurrent admin actions', async () => {
    const userId = new ObjectId().toString();
    const admin1 = new ObjectId().toString();
    const admin2 = new ObjectId().toString();
    const today = getUtcDateKey();

    await Promise.all([
      repo.addAdjustment(userId, today, -1, 'concurrent grant A', admin1),
      repo.addAdjustment(userId, today, -2, 'concurrent grant B', admin2),
      repo.addAdjustment(userId, today, -0.5, 'concurrent grant C', admin1),
    ]);

    expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(-3.5);
    expect((await repo.findAdjustments(userId)).length).toBe(3);
  });

  it('should allow a positive adjustment that ADDS to effective spend (manual charge)', async () => {
    const userId = new ObjectId().toString();
    const adminId = new ObjectId().toString();
    const today = getUtcDateKey();

    await repo.incrementDailyCost(userId, today, 0.5, true);
    await repo.addAdjustment(userId, today, 0.25, 'manual charge for misuse', adminId);

    expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(0.75);
  });

  it('should isolate adjustments per UTC date', async () => {
    const userId = new ObjectId().toString();
    const adminId = new ObjectId().toString();
    const today = getUtcDateKey();
    const yesterday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      return getUtcDateKey(d);
    })();

    await repo.addAdjustment(userId, yesterday, -10, 'yesterday credit', adminId);
    await repo.addAdjustment(userId, today, -1, 'today credit', adminId);

    expect(await repo.getEffectiveCost(userId, today)).toBeCloseTo(-1);
    expect(await repo.getEffectiveCost(userId, yesterday)).toBeCloseTo(-10);
  });
});
