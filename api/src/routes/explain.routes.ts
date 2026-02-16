import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoNotFoundError } from '../utils/errors.js';

const explainAutoParamsSchema = z.object({
  videoSummaryId: z.string().min(1),
  targetType: z.enum(['section', 'concept']),
  targetId: z.string().min(1),
});

const videoChatBodySchema = z.object({
  videoSummaryId: z.string().min(1),
  message: z.string().min(1).max(10000),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).optional(),
});

export async function explainRoutes(fastify: FastifyInstance) {
  const { explainerClient, videoRepository } = fastify.container;

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

  // POST /api/explain/video-chat
  fastify.post<{
    Body: { videoSummaryId: string; message: string; chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }> };
  }>('/video-chat', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = videoChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    const { videoSummaryId, message, chatHistory } = parsed.data;

    // Verify user has access to this video
    const hasAccess = await videoRepository.userHasAccessToSummary(req.user.userId, videoSummaryId);
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    try {
      const result = await explainerClient.videoChat(videoSummaryId, message, chatHistory);
      return result;
    } catch (error) {
      fastify.log.error(error, 'video_chat failed');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again.',
        requestId: req.id,
      });
    }
  });
}
