import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoNotFoundError } from '../utils/errors.js';
import type { AssistantAction } from '../services/assistant-client.js';

const chatBodySchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).optional(),
});

// Bound the param map so /action can't be used to push megabytes through to
// the assistant. Limits chosen to comfortably cover save_note text, quiz_me
// topic, find_moment query, and explain concept while rejecting abuse.
const ACTION_PARAM_VALUE_MAX = 4000;
const ACTION_PARAM_KEY_MAX = 64;
const ACTION_PARAMS_MAX_ENTRIES = 16;

const actionParamsSchema = z
  .record(
    z.string().min(1).max(ACTION_PARAM_KEY_MAX),
    z.union([z.string().max(ACTION_PARAM_VALUE_MAX), z.number(), z.boolean()]),
  )
  .refine(
    (obj) => Object.keys(obj).length <= ACTION_PARAMS_MAX_ENTRIES,
    `too many params (max ${ACTION_PARAMS_MAX_ENTRIES})`,
  );

const actionBodySchema = z.object({
  action: z.enum(['save_note', 'quiz_me', 'find_moment', 'explain']),
  params: actionParamsSchema.optional(),
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

  // POST /api/videos/:videoSummaryId/action
  fastify.post<{
    Params: { videoSummaryId: string };
    Body: z.infer<typeof actionBodySchema>;
  }>('/:videoSummaryId/action', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { videoSummaryId } = req.params;

    const parsed = actionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid action body',
      });
    }

    const hasAccess = await videoRepository.userHasAccessToSummary(req.user.userId, videoSummaryId);
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    try {
      const { status, body } = await assistantClient.action({
        videoId: videoSummaryId,
        userId: req.user.userId,
        action: parsed.data.action satisfies AssistantAction,
        params: parsed.data.params,
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
