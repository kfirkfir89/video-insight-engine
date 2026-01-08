import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { explainAuto, explainChat } from '../services/explainer-client.js';

const explainAutoParamsSchema = z.object({
  videoSummaryId: z.string().min(1),
  targetType: z.enum(['section', 'concept']),
  targetId: z.string().min(1),
});

const explainChatBodySchema = z.object({
  memorizedItemId: z.string().min(1),
  message: z.string().min(1),
  chatId: z.string().optional(),
});

export async function explainRoutes(fastify: FastifyInstance) {
  // GET /api/explain/:videoSummaryId/:targetType/:targetId
  fastify.get<{
    Params: { videoSummaryId: string; targetType: string; targetId: string };
  }>('/:videoSummaryId/:targetType/:targetId', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = explainAutoParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid parameters',
      });
    }

    const { videoSummaryId, targetType, targetId } = parsed.data;

    try {
      const result = await explainAuto(videoSummaryId, targetType, targetId);
      return result;
    } catch (error) {
      fastify.log.error(error, 'explain_auto failed');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again.',
        requestId: req.id,
      });
    }
  });

  // POST /api/explain/chat
  fastify.post<{
    Body: { memorizedItemId: string; message: string; chatId?: string };
  }>('/chat', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = explainChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    const userId = req.user.userId;

    try {
      const result = await explainChat({
        ...parsed.data,
        userId,
      });
      return result;
    } catch (error) {
      fastify.log.error(error, 'explain_chat failed');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again.',
        requestId: req.id,
      });
    }
  });
}
