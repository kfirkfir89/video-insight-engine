import { ObjectId } from 'mongodb';

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
