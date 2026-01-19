import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoService } from '../services/video.service.js';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';

const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: objectIdSchema.optional(),
  bypassCache: z.boolean().optional().default(false),
});

const moveVideoSchema = z.object({
  folderId: objectIdSchema.nullable(),
});

const videosQuerySchema = z.object({
  folderId: objectIdSchema.optional(),
});

// YouTube ID validation: 11 characters, alphanumeric plus dash/underscore
const youtubeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube ID format');

const versionsParamSchema = z.object({
  youtubeId: youtubeIdSchema,
});

const versionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function videosRoutes(fastify: FastifyInstance) {
  const videoService = new VideoService(fastify.mongo.db);

  // GET /api/videos
  fastify.get<{
    Querystring: z.infer<typeof videosQuerySchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { folderId } = videosQuerySchema.parse(req.query);
    const videos = await videoService.getVideos(req.user.userId, folderId);
    return { videos };
  });

  // GET /api/videos/:id
  fastify.get<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return videoService.getVideo(req.user.userId, id);
  });

  // POST /api/videos
  fastify.post<{
    Body: z.infer<typeof createVideoSchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '24 hours',
        errorResponseBuilder: () => ({
          error: 'RATE_LIMITED',
          message: 'Daily video limit reached (10 videos per 24 hours). Try again tomorrow.',
          statusCode: 429,
        }),
      },
    },
  }, async (req, reply) => {
    const input = createVideoSchema.parse(req.body);
    const result = await videoService.createVideo(req.user.userId, input.url, input.folderId, input.bypassCache);
    return reply.code(201).send(result);
  });

  // DELETE /api/videos/:id
  fastify.delete<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    await videoService.deleteVideo(req.user.userId, id);
    return reply.code(204).send();
  });

  // PATCH /api/videos/:id/move - Move video to a folder
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof moveVideoSchema>;
  }>('/:id/move', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const { folderId } = moveVideoSchema.parse(req.body);
    return videoService.moveToFolder(req.user.userId, id, folderId);
  });

  // GET /api/videos/versions/:youtubeId - Get all versions of a video for A/B comparison
  // Requires user to own the video (have it in their library)
  fastify.get<{
    Params: z.infer<typeof versionsParamSchema>;
    Querystring: z.infer<typeof versionsQuerySchema>;
  }>('/versions/:youtubeId', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { youtubeId } = versionsParamSchema.parse(req.params);
    const { limit } = versionsQuerySchema.parse(req.query);

    // Authorization: verify user owns a video with this youtubeId
    const userOwnsVideo = await videoService.userOwnsVideo(req.user.userId, youtubeId);
    if (!userOwnsVideo) {
      return reply.code(404).send({
        error: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    const versions = await videoService.getVersions(youtubeId, { limit });
    return { versions };
  });
}
