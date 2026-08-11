import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { isValidObjectId, toObjectId, objectIdSchema, idParamSchema } from '../validation.js';

describe('Validation Utilities', () => {
  describe('isValidObjectId', () => {
    it('should return true for valid 24-character hex string', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });

    it('should return true for valid ObjectId string', () => {
      const id = new ObjectId();
      expect(isValidObjectId(id.toString())).toBe(true);
    });

    it('should return true for lowercase hex string', () => {
      expect(isValidObjectId('abcdef123456789012345678')).toBe(true);
    });

    it('should return true for uppercase hex string', () => {
      expect(isValidObjectId('ABCDEF123456789012345678')).toBe(true);
    });

    it('should return true for mixed case hex string', () => {
      expect(isValidObjectId('AbCdEf123456789012345678')).toBe(true);
    });

    it('should return false for string with less than 24 characters', () => {
      expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false);
    });

    it('should return false for string with more than 24 characters', () => {
      expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false);
    });

    it('should return false for string with non-hex characters', () => {
      expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidObjectId('')).toBe(false);
    });

    it('should return false for string with special characters', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439-11')).toBe(false);
    });

    it('should return false for string with spaces', () => {
      expect(isValidObjectId('507f1f77bcf86cd7 9439011')).toBe(false);
    });
  });

  describe('toObjectId', () => {
    it('should return ObjectId for valid string', () => {
      const idString = '507f1f77bcf86cd799439011';
      const result = toObjectId(idString);

      expect(result).toBeInstanceOf(ObjectId);
      expect(result?.toString()).toBe(idString);
    });

    it('should return ObjectId for newly generated ObjectId string', () => {
      const original = new ObjectId();
      const result = toObjectId(original.toString());

      expect(result).toBeInstanceOf(ObjectId);
      expect(result?.toString()).toBe(original.toString());
    });

    it('should return null for invalid string', () => {
      const result = toObjectId('invalid');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = toObjectId('');

      expect(result).toBeNull();
    });

    it('should return null for string with wrong length', () => {
      const result = toObjectId('507f1f77bcf86cd79943901');

      expect(result).toBeNull();
    });

    it('should return null for string with non-hex characters', () => {
      const result = toObjectId('507f1f77bcf86cd79943901z');

      expect(result).toBeNull();
    });
  });

  describe('objectIdSchema', () => {
    it('should validate correct ObjectId string', () => {
      const result = objectIdSchema.safeParse('507f1f77bcf86cd799439011');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('507f1f77bcf86cd799439011');
      }
    });

    it('should validate ObjectId from new ObjectId()', () => {
      const id = new ObjectId();
      const result = objectIdSchema.safeParse(id.toString());

      expect(result.success).toBe(true);
    });

    it('should reject invalid ObjectId string', () => {
      const result = objectIdSchema.safeParse('invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid ID format');
      }
    });

    it('should reject empty string', () => {
      const result = objectIdSchema.safeParse('');

      expect(result.success).toBe(false);
    });

    it('should reject string that is too short', () => {
      const result = objectIdSchema.safeParse('507f1f77');

      expect(result.success).toBe(false);
    });

    it('should reject string that is too long', () => {
      const result = objectIdSchema.safeParse('507f1f77bcf86cd7994390111111');

      expect(result.success).toBe(false);
    });

    it('should reject non-string types', () => {
      const result = objectIdSchema.safeParse(123);

      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = objectIdSchema.safeParse(null);

      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = objectIdSchema.safeParse(undefined);

      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should validate object with valid id', () => {
      const result = idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('507f1f77bcf86cd799439011');
      }
    });

    it('should reject object with invalid id', () => {
      const result = idParamSchema.safeParse({ id: 'invalid' });

      expect(result.success).toBe(false);
    });

    it('should reject object without id', () => {
      const result = idParamSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('should reject object with null id', () => {
      const result = idParamSchema.safeParse({ id: null });

      expect(result.success).toBe(false);
    });

    it('should reject non-object input', () => {
      const result = idParamSchema.safeParse('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
    });

    it('should accept object with additional properties', () => {
      const result = idParamSchema.safeParse({
        id: '507f1f77bcf86cd799439011',
        extra: 'value',
      });

      // Zod strips additional properties by default when using safeParse
      expect(result.success).toBe(true);
    });

    it('should work with route params pattern', () => {
      // Simulating Express/Fastify route params
      const params = { id: new ObjectId().toString() };
      const result = idParamSchema.safeParse(params);

      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple ObjectId validations consistently', () => {
      const ids = [
        new ObjectId(),
        new ObjectId(),
        new ObjectId(),
      ];

      ids.forEach(id => {
        expect(isValidObjectId(id.toString())).toBe(true);
        expect(toObjectId(id.toString())).toBeInstanceOf(ObjectId);
        expect(objectIdSchema.safeParse(id.toString()).success).toBe(true);
      });
    });

    it('should handle ObjectId-like strings that are not valid', () => {
      const invalidIds = [
        '000000000000000000000000', // All zeros is technically valid
        'gggggggggggggggggggggggg', // Invalid hex
        '12345678901234567890123_', // Underscore
      ];

      expect(isValidObjectId(invalidIds[0])).toBe(true); // All zeros is valid hex
      expect(isValidObjectId(invalidIds[1])).toBe(false);
      expect(isValidObjectId(invalidIds[2])).toBe(false);
    });
  });
});
