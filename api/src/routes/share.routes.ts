import { FastifyInstance } from 'fastify';
import { shareCreateParamsSchema, shareSlugParamsSchema } from '../schemas/share.schema.js';

export async function shareRoutes(fastify: FastifyInstance) {
  const { shareService } = fastify.container;

  // POST /api/share/:videoSummaryId — generate share link (auth required)
  fastify.post<{
    Params: { videoSummaryId: string };
  }>('/:videoSummaryId', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour',
      },
    },
  }, async (req, reply) => {
    const { videoSummaryId } = shareCreateParamsSchema.parse(req.params);
    const result = await shareService.createShare(req.user.userId, videoSummaryId);
    return reply.code(201).send(result);
  });

  // GET /api/share/:slug — get public summary (no auth)
  fastify.get<{
    Params: { slug: string };
  }>('/:slug', {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute',
      },
    },
  }, async (req) => {
    const { slug } = shareSlugParamsSchema.parse(req.params);
    return shareService.getPublicSummary(slug, req.ip);
  });

  // POST /api/share/:slug/like — like a share (no auth, IP rate limited)
  fastify.post<{
    Params: { slug: string };
  }>('/:slug/like', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip,
      },
    },
  }, async (req) => {
    const { slug } = shareSlugParamsSchema.parse(req.params);
    return shareService.likeShare(slug, req.ip);
  });
}
