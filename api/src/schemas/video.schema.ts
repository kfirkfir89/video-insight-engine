import { z } from 'zod';

export const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: z.string().optional(),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
