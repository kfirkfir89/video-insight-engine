import { z } from 'zod';

export const checkoutQuerySchema = z.object({
  tier: z.enum(['pro', 'team']),
});

export const webhookBodySchema = z.object({
  event_type: z.string(),
  data: z.record(z.unknown()),
});

export type CheckoutQuery = z.infer<typeof checkoutQuerySchema>;
export type WebhookBody = z.infer<typeof webhookBodySchema>;
