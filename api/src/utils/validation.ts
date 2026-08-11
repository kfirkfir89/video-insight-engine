import { ObjectId } from 'mongodb';
import { z } from 'zod';

/**
 * Validates if a string is a valid MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Safely creates an ObjectId, returns null if invalid
 */
export function toObjectId(id: string): ObjectId | null {
  if (!isValidObjectId(id)) {
    return null;
  }
  return new ObjectId(id);
}

/**
 * Zod schema for validating MongoDB ObjectId strings
 */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

/**
 * Common route param schemas
 */
export const idParamSchema = z.object({
  id: objectIdSchema,
});
