import { describe, it, expect } from 'vitest';
import { actionParamsSchema, actionEnumSchema } from './assistant.schema.js';
import { ASSISTANT_ACTIONS } from '../services/assistant-client.js';

describe('actionEnumSchema', () => {
  it('should accept every action in the canonical list', () => {
    for (const action of ASSISTANT_ACTIONS) {
      expect(actionEnumSchema.safeParse(action).success).toBe(true);
    }
  });

  it('should reject an action that is not in the canonical list', () => {
    expect(actionEnumSchema.safeParse('drop_database').success).toBe(false);
  });
});

describe('actionParamsSchema', () => {
  it('should accept a small, well-formed param map', () => {
    const result = actionParamsSchema.safeParse({ topic: 'hooks', count: 3, flag: true });
    expect(result.success).toBe(true);
  });

  it('should reject a param value over the length cap', () => {
    expect(actionParamsSchema.safeParse({ note: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('should reject a param key over the length cap', () => {
    expect(actionParamsSchema.safeParse({ ['k'.repeat(65)]: 'v' }).success).toBe(false);
  });

  it('should reject more than the maximum number of entries', () => {
    const tooMany: Record<string, string> = {};
    for (let i = 0; i < 17; i += 1) {
      tooMany[`k${i}`] = 'v';
    }
    expect(actionParamsSchema.safeParse(tooMany).success).toBe(false);
  });
});
