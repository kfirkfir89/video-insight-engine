import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getTestDb, mockLogger } from '../../test/setup.js';
import { CostMonitorService } from '../cost-monitor.service.js';

// Mock config with COST_DAILY_LIMIT = 50
vi.mock('../../config.js', () => ({
  config: {
    COST_DAILY_LIMIT: 50,
  },
}));

describe('CostMonitorService', () => {
  let costMonitorService: CostMonitorService;

  beforeEach(() => {
    vi.clearAllMocks();

    const db = getTestDb();
    costMonitorService = new CostMonitorService(db, mockLogger as unknown as FastifyBaseLogger);
  });

  describe('getDailySpend', () => {
    it('should return 0 total when no usage today', async () => {
      const result = await costMonitorService.getDailySpend();

      expect(result).toEqual({
        total: 0,
        limit: 50,
        percentage: 0,
      });
    });

    it('should aggregate today\'s usage', async () => {
      const db = getTestDb();
      const now = new Date();

      // Insert multiple usage records for today
      await db.collection('llm_usage').insertMany([
        {
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
          cost: 10.5,
          createdAt: now,
        },
        {
          model: 'haiku',
          inputTokens: 2000,
          outputTokens: 800,
          cost: 4.5,
          createdAt: now,
        },
        {
          model: 'sonnet',
          inputTokens: 500,
          outputTokens: 200,
          cost: 5.0,
          createdAt: now,
        },
      ]);

      const result = await costMonitorService.getDailySpend();

      expect(result.total).toBe(20);
      expect(result.limit).toBe(50);
      expect(result.percentage).toBe(40); // 20/50 * 100
    });
  });

  describe('getRecommendedModel', () => {
    it('should return sonnet below 70% threshold', async () => {
      const db = getTestDb();

      // Insert usage totaling $30 (60% of $50 limit)
      await db.collection('llm_usage').insertOne({
        model: 'sonnet',
        inputTokens: 5000,
        outputTokens: 2000,
        cost: 30,
        createdAt: new Date(),
      });

      const result = await costMonitorService.getRecommendedModel();

      expect(result).toBe('sonnet');
    });

    it('should return flash between 70-90%', async () => {
      const db = getTestDb();

      // Insert usage totaling $40 (80% of $50 limit)
      await db.collection('llm_usage').insertOne({
        model: 'sonnet',
        inputTokens: 10000,
        outputTokens: 5000,
        cost: 40,
        createdAt: new Date(),
      });

      const result = await costMonitorService.getRecommendedModel();

      expect(result).toBe('flash');
    });

    it('should return haiku above 90%', async () => {
      const db = getTestDb();

      // Insert usage totaling $48 (96% of $50 limit)
      await db.collection('llm_usage').insertOne({
        model: 'sonnet',
        inputTokens: 15000,
        outputTokens: 8000,
        cost: 48,
        createdAt: new Date(),
      });

      const result = await costMonitorService.getRecommendedModel();

      expect(result).toBe('haiku');
    });
  });

  describe('isDailyLimitExceeded', () => {
    it('should return false when under limit', async () => {
      const db = getTestDb();

      // Insert usage totaling $25 (50% of $50 limit)
      await db.collection('llm_usage').insertOne({
        model: 'sonnet',
        inputTokens: 3000,
        outputTokens: 1000,
        cost: 25,
        createdAt: new Date(),
      });

      const result = await costMonitorService.isDailyLimitExceeded();

      expect(result).toBe(false);
    });

    it('should return true when over limit', async () => {
      const db = getTestDb();

      // Insert usage totaling $55 (110% of $50 limit)
      await db.collection('llm_usage').insertOne({
        model: 'sonnet',
        inputTokens: 20000,
        outputTokens: 10000,
        cost: 55,
        createdAt: new Date(),
      });

      const result = await costMonitorService.isDailyLimitExceeded();

      expect(result).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('should insert usage record', async () => {
      const db = getTestDb();

      await costMonitorService.recordUsage(
        'sonnet',
        { input: 1500, output: 750 },
        3.25,
      );

      const records = await db.collection('llm_usage').find({}).toArray();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        model: 'sonnet',
        inputTokens: 1500,
        outputTokens: 750,
        cost: 3.25,
      });
      expect(records[0].createdAt).toBeInstanceOf(Date);
    });
  });
});
