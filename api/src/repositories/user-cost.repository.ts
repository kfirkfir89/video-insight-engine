import { Db, ObjectId, Collection } from 'mongodb';

export interface UserDailyCostDocument {
  _id: ObjectId;
  userId: ObjectId;
  /** UTC `YYYY-MM-DD`. */
  date: string;
  totalCostUsd: number;
  videoCount: number;
  /** Admin credit adjustments (negative reduces effective usage). */
  creditAdjustmentUsd: number;
  updatedAt: Date;
}

export interface UserCostAdjustmentDocument {
  _id: ObjectId;
  userId: ObjectId;
  date: string;
  amountUsd: number;
  reason: string;
  adminId: ObjectId;
  createdAt: Date;
}

export interface UserCostAggregateRow {
  userId: string;
  totalCostUsd: number;
  videoCount: number;
  creditAdjustmentUsd: number;
  effectiveUsd: number;
  days: number;
}

/** Convert a Date (or now) to UTC `YYYY-MM-DD`. */
export function getUtcDateKey(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Return the next UTC midnight ISO string after the given date. */
export function getNextUtcMidnightIso(date: Date = new Date()): string {
  const next = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return next.toISOString();
}

export class UserCostRepository {
  private readonly collection: Collection<UserDailyCostDocument>;
  private readonly adjustmentsCollection: Collection<UserCostAdjustmentDocument>;

  constructor(db: Db) {
    this.collection = db.collection('userCosts');
    this.adjustmentsCollection = db.collection('userCostAdjustments');
  }

  async findByUserAndDate(userId: string, date: string): Promise<UserDailyCostDocument | null> {
    return this.collection.findOne({ userId: new ObjectId(userId), date });
  }

  /** Returns `(totalCostUsd + creditAdjustmentUsd)` for the given UTC day. */
  async getEffectiveCost(userId: string, date: string): Promise<number> {
    const doc = await this.findByUserAndDate(userId, date);
    if (!doc) return 0;
    return (doc.totalCostUsd || 0) + (doc.creditAdjustmentUsd || 0);
  }

  /** Atomic per-user increment. Upserts the day record if absent. */
  async incrementDailyCost(
    userId: string,
    date: string,
    costUsd: number,
    incrementVideoCount = false,
  ): Promise<void> {
    if (costUsd === 0 && !incrementVideoCount) return;
    const inc: Record<string, number> = { totalCostUsd: costUsd };
    if (incrementVideoCount) {
      inc.videoCount = 1;
    }
    await this.collection.updateOne(
      { userId: new ObjectId(userId), date },
      {
        $inc: inc,
        $setOnInsert: { creditAdjustmentUsd: 0 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true },
    );
  }

  /**
   * Atomic increment-and-return. The returned `totalCostUsd` reflects the
   * value AT THE MOMENT of THIS specific increment — concurrent callers each
   * get a different post-state, which is what makes the reservation pattern
   * serialize correctly.
   */
  async incrementAndReturnEffective(
    userId: string,
    date: string,
    costUsd: number,
    incrementVideoCount = false,
  ): Promise<{ totalCostUsd: number; creditAdjustmentUsd: number; effectiveUsd: number }> {
    const inc: Record<string, number> = { totalCostUsd: costUsd };
    if (incrementVideoCount) {
      inc.videoCount = 1;
    }
    const doc = await this.collection.findOneAndUpdate(
      { userId: new ObjectId(userId), date },
      {
        $inc: inc,
        $setOnInsert: { creditAdjustmentUsd: 0 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const totalCostUsd = doc?.totalCostUsd ?? costUsd;
    const creditAdjustmentUsd = doc?.creditAdjustmentUsd ?? 0;
    return {
      totalCostUsd,
      creditAdjustmentUsd,
      effectiveUsd: totalCostUsd + creditAdjustmentUsd,
    };
  }

  /** Overwrite the day's totals (used by reconciliation). */
  async setDailyCost(
    userId: string,
    date: string,
    totalCostUsd: number,
    videoCount: number,
  ): Promise<void> {
    await this.collection.updateOne(
      { userId: new ObjectId(userId), date },
      {
        $set: { totalCostUsd, videoCount, updatedAt: new Date() },
        $setOnInsert: { creditAdjustmentUsd: 0 },
      },
      { upsert: true },
    );
  }

  /** Atomic refund of a prior reservation (decrements both cost and videoCount). */
  async refundReservation(userId: string, date: string, costUsd: number): Promise<void> {
    if (costUsd <= 0) return;
    await this.collection.updateOne(
      { userId: new ObjectId(userId), date },
      {
        $inc: { totalCostUsd: -costUsd, videoCount: -1 },
        $set: { updatedAt: new Date() },
      },
    );
  }

  /** Atomic adjustment; writes an audit row. `amountUsd` is signed. */
  async addAdjustment(
    userId: string,
    date: string,
    amountUsd: number,
    reason: string,
    adminId: string,
  ): Promise<void> {
    await this.collection.updateOne(
      { userId: new ObjectId(userId), date },
      {
        $inc: { creditAdjustmentUsd: amountUsd },
        $setOnInsert: { totalCostUsd: 0, videoCount: 0 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true },
    );

    await this.adjustmentsCollection.insertOne({
      userId: new ObjectId(userId),
      date,
      amountUsd,
      reason,
      adminId: new ObjectId(adminId),
      createdAt: new Date(),
    } as UserCostAdjustmentDocument);
  }

  /** All daily docs for a user across the last N days (inclusive of today). */
  async findRange(userId: string, days: number): Promise<UserDailyCostDocument[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(days - 1, 0));
    const sinceKey = getUtcDateKey(since);
    return this.collection
      .find({ userId: new ObjectId(userId), date: { $gte: sinceKey } })
      .sort({ date: 1 })
      .toArray();
  }

  /** Audit records for a user (newest first). */
  async findAdjustments(userId: string, limit = 50): Promise<UserCostAdjustmentDocument[]> {
    return this.adjustmentsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /** Per-user aggregate over the trailing window for admin views. */
  async aggregateUsersOverRange(
    days: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<UserCostAggregateRow[]> {
    const { limit = 50, offset = 0 } = options;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(days - 1, 0));
    const sinceKey = getUtcDateKey(since);

    const cursor = this.collection.aggregate<UserCostAggregateRow>([
      { $match: { date: { $gte: sinceKey } } },
      {
        $group: {
          _id: '$userId',
          totalCostUsd: { $sum: '$totalCostUsd' },
          videoCount: { $sum: '$videoCount' },
          creditAdjustmentUsd: { $sum: '$creditAdjustmentUsd' },
          days: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          totalCostUsd: 1,
          videoCount: 1,
          creditAdjustmentUsd: 1,
          effectiveUsd: { $add: ['$totalCostUsd', '$creditAdjustmentUsd'] },
          days: 1,
        },
      },
      { $sort: { effectiveUsd: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);

    return cursor.toArray();
  }
}
