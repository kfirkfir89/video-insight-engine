import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';

const videoStatusSchema = z.object({
  type: z.literal('video.status'),
  payload: z.object({
    videoSummaryId: z.string(),
    userId: z.string().optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    progress: z.number().optional(),
    message: z.string().optional(),
    error: z.string().optional().nullable(),
  }),
});

const expansionStatusSchema = z.object({
  type: z.literal('expansion.status'),
  payload: z.object({
    videoSummaryId: z.string(),
    targetType: z.enum(['section', 'concept']),
    targetId: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    error: z.string().optional().nullable(),
  }),
});

const statusEventSchema = z.union([videoStatusSchema, expansionStatusSchema]);

export async function internalRoutes(fastify: FastifyInstance) {
  // POST /internal/status - Receive status updates from summarizer/explainer
  fastify.post<{
    Body: z.infer<typeof statusEventSchema>;
  }>('/status', async (req, reply) => {
    // Validate internal secret
    const secret = req.headers['x-internal-secret'];
    if (secret !== config.INTERNAL_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = statusEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid status event',
      });
    }

    const event = parsed.data;

    if (event.type === 'video.status') {
      // Update userVideos status to match
      const { videoSummaryId, status, userId } = event.payload;

      await fastify.mongo.db.collection('userVideos').updateMany(
        { videoSummaryId: new ObjectId(videoSummaryId) },
        { $set: { status, updatedAt: new Date() } }
      );

      // If we have userId, broadcast to that user
      if (userId) {
        fastify.broadcast(userId, event);
      } else {
        // Find all users with this video and broadcast to each
        const userVideos = await fastify.mongo.db
          .collection('userVideos')
          .find({ videoSummaryId: new ObjectId(videoSummaryId) })
          .toArray();

        for (const uv of userVideos) {
          const userIdStr = uv.userId.toHexString();
          fastify.broadcast(userIdStr, {
            ...event,
            payload: {
              ...event.payload,
              userVideoId: uv._id.toHexString(),
            },
          });
        }
      }
    } else if (event.type === 'expansion.status') {
      // Expansion status - broadcast to all users who have this video
      const { videoSummaryId } = event.payload;

      const userVideos = await fastify.mongo.db
        .collection('userVideos')
        .find({ videoSummaryId: new ObjectId(videoSummaryId) })
        .toArray();

      for (const uv of userVideos) {
        const userIdStr = uv.userId.toHexString();
        fastify.broadcast(userIdStr, event);
      }
    }

    return { received: true };
  });
}
