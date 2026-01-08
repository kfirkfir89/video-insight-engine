import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoService } from '../services/video.service.js';

const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: z.string().optional(),
});

const moveVideoSchema = z.object({
  folderId: z.string().nullable(),
});

export async function videosRoutes(fastify: FastifyInstance) {
  const videoService = new VideoService(fastify.mongo.db);

  // GET /api/videos
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { folderId } = req.query as { folderId?: string };
    const videos = await videoService.getVideos(req.user.userId, folderId);
    return { videos };
  });

  // GET /api/videos/:id
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = req.params as { id: string };
    return videoService.getVideo(req.user.userId, id);
  });

  // POST /api/videos
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '24 hours' },
    },
  }, async (req, reply) => {
    const input = createVideoSchema.parse(req.body);
    const result = await videoService.createVideo(req.user.userId, input.url, input.folderId);
    return reply.code(201).send(result);
  });

  // DELETE /api/videos/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await videoService.deleteVideo(req.user.userId, id);
    return reply.code(204).send();
  });

  // PATCH /api/videos/:id/move - Move video to a folder
  fastify.patch('/:id/move', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { folderId } = moveVideoSchema.parse(req.body);
    return videoService.moveToFolder(req.user.userId, id, folderId);
  });
}
