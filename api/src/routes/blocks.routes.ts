import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema } from '../utils/validation.js';

const updateBlocksSchema = z.object({
  blocks: z.array(z.object({
    blockId: z.string().min(1),
    data: z.record(z.unknown()),
  })).min(1).max(100),
});

export async function blocksRoutes(fastify: FastifyInstance) {
  const { videoRepository } = fastify.container;

  // PATCH /api/videos/:id/blocks — save inline-edited blocks
  fastify.patch<{
    Params: { id: string };
  }>('/:id/blocks', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const { blocks } = updateBlocksSchema.parse(req.body);

    // Verify ownership
    const userVideo = await videoRepository.findUserVideo(req.user.userId, id);
    if (!userVideo) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Video not found',
      });
    }

    // Update blocks in the video summary cache
    const videoSummaryId = userVideo.videoSummaryId.toString();
    let updatedCount = 0;

    for (const { blockId, data } of blocks) {
      const updated = await videoRepository.updateBlock(videoSummaryId, blockId, data);
      if (updated) updatedCount++;
    }

    return reply.send({
      success: true,
      updatedBlocks: updatedCount,
      totalRequested: blocks.length,
    });
  });
}
