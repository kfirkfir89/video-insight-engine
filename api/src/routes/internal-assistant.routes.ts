import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';
import type { UserTier } from '@vie/types';

// Bound how many owned videos the assistant can enumerate in a single call so a
// power user's library can't balloon the internal response unboundedly.
const OWNED_VIDEOS_LIMIT = 200;

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: objectIdSchema.optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: objectIdSchema.optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

const deleteFolderQuerySchema = z.object({
  deleteContent: z.enum(['true', 'false']).optional(),
});

const moveVideoSchema = z.object({
  folderId: objectIdSchema.nullable(),
});

const generateSchema = z.object({
  url: z.string().min(1),
  folderId: objectIdSchema.optional(),
});

const VALID_TIERS = ['free', 'pro', 'team'] as const;

/** Narrow a stored tier string to a known `UserTier`, defaulting to `free`. */
function resolveTier(tier: string | undefined): UserTier {
  return VALID_TIERS.find((t) => t === tier) ?? 'free';
}

/**
 * Internal assistant callback routes. These are thin wrappers over the existing
 * folder/video services so the assistant's tool plans can mutate the caller's
 * library. Every route authenticates with `X-Internal-Secret` + `X-User-Id` and
 * scopes all work to that userId — a body-supplied userId is never trusted.
 */
export async function internalAssistantRoutes(fastify: FastifyInstance): Promise<void> {
  const { folderService, videoService, videoRepository, userRepository } = fastify.container;

  // GET /internal/assistant/folders
  fastify.get('/folders', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const data = await folderService.list(req.user.userId);
    return { success: true, data };
  });

  // POST /internal/assistant/folders
  fastify.post<{
    Body: z.infer<typeof createFolderSchema>;
  }>('/folders', {
    preHandler: [fastify.authenticateInternal],
  }, async (req, reply) => {
    const input = createFolderSchema.parse(req.body);
    const data = await folderService.create({
      userId: req.user.userId,
      ...input,
    });
    return reply.status(201).send({ success: true, data });
  });

  // PATCH /internal/assistant/folders/:id
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof updateFolderSchema>;
  }>('/folders/:id', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateFolderSchema.parse(req.body);
    const data = await folderService.update(req.user.userId, id, input);
    return { success: true, data };
  });

  // DELETE /internal/assistant/folders/:id?deleteContent=true
  fastify.delete<{
    Params: z.infer<typeof idParamSchema>;
    Querystring: z.infer<typeof deleteFolderQuerySchema>;
  }>('/folders/:id', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const { deleteContent } = deleteFolderQuerySchema.parse(req.query);
    await folderService.delete(req.user.userId, id, deleteContent === 'true');
    return { success: true, data: { id } };
  });

  // GET /internal/assistant/videos
  fastify.get('/videos', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const videos = await videoRepository.getUserVideos(req.user.userId, undefined, {
      limit: OWNED_VIDEOS_LIMIT,
    });
    if (videos.length === OWNED_VIDEOS_LIMIT) {
      req.log.warn(
        { userId: req.user.userId, cap: OWNED_VIDEOS_LIMIT },
        'owned-video enumeration truncated at cap — assistant sees a partial library',
      );
    }
    const data = videos.map((v) => ({
      id: v._id.toString(),
      videoSummaryId: v.videoSummaryId.toString(),
      youtubeId: v.youtubeId,
      title: v.cache?.title ?? v.title ?? null,
      folderId: v.folderId ? v.folderId.toString() : null,
    }));
    return { success: true, data };
  });

  // PATCH /internal/assistant/videos/:id/move
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof moveVideoSchema>;
  }>('/videos/:id/move', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const { folderId } = moveVideoSchema.parse(req.body);
    const data = await videoService.moveToFolder(req.user.userId, id, folderId);
    return { success: true, data };
  });

  // POST /internal/assistant/generate
  fastify.post<{
    Body: z.infer<typeof generateSchema>;
  }>('/generate', {
    preHandler: [fastify.authenticateInternal],
  }, async (req) => {
    const { url, folderId } = generateSchema.parse(req.body);
    const userId = req.user.userId;

    // Resolve the tier so createVideo keeps its cost reservation + dispatch guard.
    const user = await userRepository.findById(userId);
    const tier = resolveTier(user?.tier);

    const data = await videoService.createVideo(userId, url, {
      tier,
      folderId,
      requestId: req.id,
    });
    return { success: true, data };
  });
}
