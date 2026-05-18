import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';
import { getUtcDateKey } from '../repositories/user-cost.repository.js';

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

const reconcileQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().regex(/^[a-f0-9]{24}$/i, 'userId must be a 24-char hex ObjectId').optional(),
});

export async function internalRoutes(fastify: FastifyInstance) {
  const { costMonitorService } = fastify.container;

  // POST /internal/status - Receive status updates from summarizer/agent
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

      // On terminal status (completed OR failed), reconcile the user's day
      // from llm_usage so the cost gate reflects actual spend and the upfront
      // reservation gets corrected. Without reconciling failures, a failed
      // video's reservation would linger until the nightly cron.
      // This IS the canonical refund-on-failure for the per-user gate; do not
      // add a separate `refundReservation` path on failure or it will double-refund.
      if (status === 'completed' || status === 'failed') {
        const targetUsers = new Set<string>();
        if (userId) targetUsers.add(userId);
        if (targetUsers.size === 0) {
          const userVideos = await fastify.mongo.db
            .collection('userVideos')
            .find({ videoSummaryId: new ObjectId(videoSummaryId) })
            .toArray();
          for (const uv of userVideos) {
            if (uv.userId) {
              targetUsers.add(uv.userId.toHexString());
            }
          }
        }

        const todayKey = getUtcDateKey();
        await Promise.all(
          Array.from(targetUsers).map(async (uid) => {
            try {
              await costMonitorService.reconcileUserDay(uid, todayKey);
            } catch (err) {
              req.log.warn({ err, userId: uid }, 'reconcileUserDay failed on completion');
            }
          }),
        );
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

  // POST /internal/reconcile-costs — nightly cron rebuilds the userCosts cache from llm_usage.
  // Supply ?date=YYYY-MM-DD to reconcile a specific UTC day, or ?userId=... for a single user.
  fastify.post<{
    Querystring: z.infer<typeof reconcileQuerySchema>;
  }>('/reconcile-costs', async (req, reply) => {
    const secret = req.headers['x-internal-secret'];
    if (secret !== config.INTERNAL_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = reconcileQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid query',
      });
    }

    const dateKey = parsed.data.date ?? getUtcDateKey();
    if (parsed.data.userId) {
      const total = await costMonitorService.reconcileUserDay(parsed.data.userId, dateKey);
      return { dateKey, userId: parsed.data.userId, totalCostUsd: total };
    }

    const result = await costMonitorService.reconcileAllUsersForDay(dateKey);
    return { dateKey, ...result };
  });
}
