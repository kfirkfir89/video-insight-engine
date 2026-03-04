import { z } from 'zod';
import { objectIdSchema } from '../utils/validation.js';

export const shareCreateParamsSchema = z.object({
  videoSummaryId: objectIdSchema,
});

export const shareSlugParamsSchema = z.object({
  slug: z.string().regex(/^[A-Za-z0-9_-]{10}$/, 'Invalid share slug format'),
});

export type ShareCreateParams = z.infer<typeof shareCreateParamsSchema>;
export type ShareSlugParams = z.infer<typeof shareSlugParamsSchema>;
