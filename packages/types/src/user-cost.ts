// ═══════════════════════════════════════════════════
// Per-User Daily Cost Tracking
// ═══════════════════════════════════════════════════

import type { UserTier } from './user.js';

/** Daily cost aggregate for a single user.
 *  Compound unique index: `{ userId, date }`.
 *  `date` is a UTC `YYYY-MM-DD` string for deterministic grouping/sorting.
 */
export interface UserDailyCost {
  _id: string;
  userId: string;
  /** UTC date, formatted `YYYY-MM-DD` */
  date: string;
  /** Sum of raw LLM cost in USD for the day. Denormalized from `llm_usage`. */
  totalCostUsd: number;
  /** Number of completed videos billed against this day. */
  videoCount: number;
  /** Admin credit adjustments applied to this day (negative reduces usage). */
  creditAdjustmentUsd: number;
  updatedAt: string;
}

/** Result of `checkUserCanProcess` — whether a new video can be started for this user. */
export interface UserCostCheck {
  allowed: boolean;
  /** USD already spent today (after credit adjustments). */
  usedUsd: number;
  /** Daily limit for the user's tier. `-1` = unlimited. */
  limitUsd: number;
  /** USD remaining before block. `null` for unlimited tiers (Infinity doesn't survive JSON). */
  remainingUsd: number | null;
  /** ISO timestamp of next UTC midnight reset. */
  resetAt: string;
  /** Resolved tier name. */
  tier: UserTier;
}

/** Daily cost limits per tier in USD. `-1` = unlimited (admin). */
export type CostLimitsPerTier = Record<UserTier, number>;

/** Admin audit record for credit adjustments.
 *
 *  Storage convention (CANONICAL, shared by Node + Python):
 *    - `amountUsd < 0` → credit granted (lowers effective spend)
 *    - `amountUsd > 0` → manual charge (raises effective spend)
 *
 *  The admin-facing HTTP endpoint accepts a user-friendly "positive = grant"
 *  input and inverts the sign before storage. Anything reading this collection
 *  directly should treat the value as already-signed.
 */
export interface UserCostAdjustment {
  _id: string;
  userId: string;
  /** UTC `YYYY-MM-DD`. */
  date: string;
  /** Signed USD as stored. Negative = credit, positive = charge. */
  amountUsd: number;
  reason: string;
  adminId: string;
  createdAt: string;
}
