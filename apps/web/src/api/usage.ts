import { request } from "./client";

export interface UserUsageSummary {
  tier: "free" | "pro" | "team";
  today: {
    date: string;
    rawUsd: number;
    creditAdjustmentUsd: number;
    effectiveUsd: number;
    videoCount: number;
  };
  /** -1 (or 0) means unlimited. */
  limitUsd: number;
  /** Server sends `null` for unlimited tiers; we coerce to `Number.POSITIVE_INFINITY` so callers can do arithmetic. */
  remainingUsd: number;
  resetAt: string;
}

interface RawUsageResponse extends Omit<UserUsageSummary, "remainingUsd"> {
  remainingUsd: number | null;
}

export const usageApi = {
  async me(): Promise<UserUsageSummary> {
    const raw = await request<RawUsageResponse>("/users/me/usage");
    return {
      ...raw,
      remainingUsd:
        raw.remainingUsd === null || !Number.isFinite(raw.remainingUsd)
          ? Number.POSITIVE_INFINITY
          : raw.remainingUsd,
    };
  },
};
