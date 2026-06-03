import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actionEnumSchema, actionParamsSchema } from '../schemas/assistant.schema.js';
import type { AssistantAction } from '../services/assistant-client.js';

const actionBodySchema = z.object({
  action: actionEnumSchema,
  params: actionParamsSchema.optional(),
  video_id: z.string().min(1).optional(),
});

/**
 * User-facing action proxy. The JWT-authenticated user dispatches a structured
 * action that the assistant turns into tool plans; the assistant calls back into
 * `/internal/assistant/*` scoped to the same user. `video_id` is optional because
 * library-scoped actions (organize_library, *_folder) have no single video.
 */
export async function assistantActionRoutes(fastify: FastifyInstance): Promise<void> {
  const { assistantClient } = fastify.container;

  // POST /api/assistant/action
  fastify.post<{
    Body: z.infer<typeof actionBodySchema>;
  }>('/action', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = actionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid action body',
      });
    }

    try {
      const { status, body } = await assistantClient.action({
        action: parsed.data.action satisfies AssistantAction,
        params: parsed.data.params,
        userId: req.user.userId,
        videoId: parsed.data.video_id,
        requestId: req.id,
      });

      return reply.status(status).send(body);
    } catch (error) {
      fastify.log.error(error, 'assistant action failed');
      return reply.status(502).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Assistant service is temporarily unavailable. Please try again.',
      });
    }
  });
}
