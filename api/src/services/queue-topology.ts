/**
 * RabbitMQ topology for the video processing pipeline.
 *
 * These names + queue arguments MUST match what the Python worker declares
 * (services/summarizer/src/worker/topology.py). RabbitMQ rejects assertions
 * that disagree with an existing object, so a mismatch surfaces immediately
 * at boot — useful invariant for cross-language contracts.
 */

import { z } from 'zod';

export const QUEUE_TOPOLOGY = {
  exchange: 'vie.pipeline',
  queue: 'vie.pipeline.jobs',
  routingKey: 'video.process',
  dlx: 'vie.pipeline.dlx',
  dlq: 'vie.pipeline.dlq',
  dlqRoutingKey: 'video.process.dead',
} as const;

/** Match server-side x-max-priority cap. */
export const PRIORITY_FREE = 1;
export const PRIORITY_PAID = 5;
export const MAX_PRIORITY = 10;

/** 1 hour TTL — long enough for backed-up queues, short enough to surface DLQ stalls. */
export const MESSAGE_TTL_MS = 60 * 60 * 1000;

export const queueArguments = {
  'x-max-priority': MAX_PRIORITY,
  'x-message-ttl': MESSAGE_TTL_MS,
  'x-dead-letter-exchange': QUEUE_TOPOLOGY.dlx,
  'x-dead-letter-routing-key': QUEUE_TOPOLOGY.dlqRoutingKey,
} as const;

const providerSchema = z.enum(['anthropic', 'openai', 'gemini']);

/**
 * Wire-format job payload.
 *
 * Keep ISO strings (not Date) so the consumer's Pydantic model can parse without
 * a JSON reviver. `tier` defaults to `free` so requests from anonymous-ish flows
 * still get a defined priority.
 */
export const videoJobPayloadSchema = z.object({
  videoSummaryId: z.string().min(1),
  youtubeId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  url: z.string().url(),
  userId: z.string().nullable().default(null),
  tier: z.enum(['free', 'pro', 'team']).default('free'),
  priority: z.number().int().min(1).max(MAX_PRIORITY),
  providers: z
    .object({
      default: providerSchema,
      fast: providerSchema.optional(),
      fallback: providerSchema.nullable().optional(),
    })
    .nullable()
    .default(null),
  bypassCache: z.boolean().default(false),
  requestId: z.string().min(1),
  attempt: z.number().int().min(1).default(1),
  createdAt: z.string().datetime(),
});

export type VideoJobPayload = z.infer<typeof videoJobPayloadSchema>;

/** Pick priority by user tier — keep this in one place so all publish sites agree. */
export function priorityForTier(tier: 'free' | 'pro' | 'team'): number {
  return tier === 'free' ? PRIORITY_FREE : PRIORITY_PAID;
}
