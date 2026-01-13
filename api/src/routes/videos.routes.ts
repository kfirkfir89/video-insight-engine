import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoService } from '../services/video.service.js';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';

const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: objectIdSchema.optional(),
});

const moveVideoSchema = z.object({
  folderId: objectIdSchema.nullable(),
});

const videosQuerySchema = z.object({
  folderId: objectIdSchema.optional(),
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
    const result = await videoService.createVideo(req.user.userId, input.url, input.folderId);
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
}
