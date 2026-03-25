import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoNotFoundError } from '../utils/errors.js';

const chatBodySchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).optional(),
});

export async function assistantRoutes(fastify: FastifyInstance) {
  const { assistantClient, videoRepository } = fastify.container;

  // POST /api/videos/:videoSummaryId/chat
  fastify.post<{
    Params: { videoSummaryId: string };
    Body: z.infer<typeof chatBodySchema>;
  }>('/:videoSummaryId/chat', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { videoSummaryId } = req.params;

    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    // Verify user has access to this video summary
    const hasAccess = await videoRepository.userHasAccessToSummary(req.user.userId, videoSummaryId);
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    try {
      const stream = await assistantClient.chat({
        videoId: videoSummaryId,
        message: parsed.data.message,
        conversationHistory: parsed.data.conversationHistory,
      });

      // Set SSE headers and pipe the stream directly
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }

      reply.raw.end();
    } catch (error) {
      // If headers already sent, can't change status
      if (reply.raw.headersSent) {
        reply.raw.end();
        return;
      }
      fastify.log.error(error, 'assistant chat failed');
      return reply.status(502).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Assistant service is temporarily unavailable. Please try again.',
      });
    }
  });

  // POST /api/videos/:videoSummaryId/action (stub for Phase 2)
  fastify.post<{
    Params: { videoSummaryId: string };
    Body: { action: string; params?: Record<string, unknown> };
  }>('/:videoSummaryId/action', {
    preHandler: [fastify.authenticate],
  }, async (_req, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Assistant actions are not yet implemented.',
    });
  });
}
