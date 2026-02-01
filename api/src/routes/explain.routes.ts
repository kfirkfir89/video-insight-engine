import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { setSSECorsHeaders, setSSEResponseHeaders } from '../utils/cors.js';
import { VideoNotFoundError, MemorizedItemNotFoundError } from '../utils/errors.js';

const explainAutoParamsSchema = z.object({
  videoSummaryId: z.string().min(1),
  targetType: z.enum(['section', 'concept']),
  targetId: z.string().min(1),
});

const explainChatBodySchema = z.object({
  memorizedItemId: z.string().min(1),
  message: z.string().min(1).max(10000),
  chatId: z.string().optional(),
});

export async function explainRoutes(fastify: FastifyInstance) {
  const { explainerClient, videoRepository, memorizeRepository } = fastify.container;

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

    // Verify user has access to this video summary
    const hasAccess = await videoRepository.userHasAccessToSummary(req.user.userId, videoSummaryId);
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    try {
      const result = await explainerClient.explainAuto(videoSummaryId, targetType, targetId);
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

    // Verify user owns this memorized item
    const item = await memorizeRepository.findById(userId, parsed.data.memorizedItemId);
    if (!item) {
      throw new MemorizedItemNotFoundError();
    }

    try {
      const result = await explainerClient.explainChat({
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

  // POST /api/explain/chat/stream - SSE streaming endpoint
  fastify.post<{
    Body: { memorizedItemId: string; message: string; chatId?: string };
  }>('/chat/stream', {
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

    // Verify user owns this memorized item
    const item = await memorizeRepository.findById(userId, parsed.data.memorizedItemId);
    if (!item) {
      throw new MemorizedItemNotFoundError();
    }

    try {
      // Set CORS and SSE headers (reply.raw bypasses Fastify CORS plugin)
      setSSECorsHeaders(req, reply);
      setSSEResponseHeaders(reply);

      // Stream from explainer service
      const response = await explainerClient.explainChatStream({
        ...parsed.data,
        userId,
      });

      // Pipe the SSE stream to client
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Handle client disconnect
        req.raw.on('close', () => {
          reader.cancel();
        });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          reader.cancel();
        }
      }

      reply.raw.end();
    } catch (error) {
      fastify.log.error(error, 'explain_chat_stream failed');
      reply.raw.write(`data: ${JSON.stringify({ event: 'error', message: 'Stream failed' })}\n\n`);
      reply.raw.end();
    }
  });
}
