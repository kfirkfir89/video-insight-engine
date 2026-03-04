import { Db, Collection } from 'mongodb';
import { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';

interface LlmUsageDocument {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: Date;
}

type RecommendedModel = 'sonnet' | 'haiku' | 'flash';

export class CostMonitorService {
  private readonly usageCollection: Collection<LlmUsageDocument>;
  private readonly dailyLimit: number;

  constructor(
    db: Db,
    private readonly logger: FastifyBaseLogger
  ) {
    this.usageCollection = db.collection('llm_usage');
    this.dailyLimit = config.COST_DAILY_LIMIT;
  }

  /** Check if daily LLM spend exceeds the configured limit */
  async isDailyLimitExceeded(): Promise<boolean> {
    const spend = await this.getDailySpend();
    return spend.percentage >= 100;
  }

  /** Get current daily spend stats */
  async getDailySpend(): Promise<{ total: number; limit: number; percentage: number }> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const result = await this.usageCollection.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$cost' } } },
    ]).toArray();

    const total = result[0]?.total ?? 0;
    const percentage = this.dailyLimit > 0 ? (total / this.dailyLimit) * 100 : 0;

    return { total, limit: this.dailyLimit, percentage };
  }

  /** Get recommended model based on current spend level */
  // TODO: v1.5 — On threshold hit (70%, 90%, 100%): POST to COST_ALERT_SLACK_WEBHOOK if configured
  async getRecommendedModel(): Promise<RecommendedModel> {
    const { percentage } = await this.getDailySpend();

    if (percentage < 70) return 'sonnet';     // Normal: use best model
    if (percentage < 90) return 'flash';      // Warning: switch to cheaper
    return 'haiku';                            // Critical: use cheapest
  }

  /** Record a new usage entry */
  async recordUsage(model: string, tokens: { input: number; output: number }, cost: number): Promise<void> {
    await this.usageCollection.insertOne({
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cost,
      createdAt: new Date(),
    });
  }
}
