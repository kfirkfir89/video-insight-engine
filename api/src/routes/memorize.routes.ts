import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listMemorizedItems,
  getMemorizedItemById,
  createMemorizedItem,
  updateMemorizedItem,
  deleteMemorizedItem,
  listChatsForItem,
} from '../services/memorize.service.js';

const sourceTypeSchema = z.enum(['video_section', 'video_concept', 'system_expansion']);

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  sourceType: sourceTypeSchema,
  videoSummaryId: z.string().min(1),
  sectionIds: z.array(z.string()).optional(),
  conceptId: z.string().optional(),
  expansionId: z.string().optional(),
  startSeconds: z.number().optional(),
  endSeconds: z.number().optional(),
  folderId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().optional().nullable(),
});

export async function memorizeRoutes(fastify: FastifyInstance) {
  // GET /api/memorize
  fastify.get<{
    Querystring: { folderId?: string };
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const items = await listMemorizedItems(
      fastify.mongo.db,
      req.user.userId,
      req.query.folderId
    );
    return { items };
  });

  // GET /api/memorize/:id
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const item = await getMemorizedItemById(
      fastify.mongo.db,
      req.user.userId,
      req.params.id
    );

    if (!item) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Memorized item not found',
      });
    }

    return { item };
  });

  // POST /api/memorize
  fastify.post<{
    Body: z.infer<typeof createItemSchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    // Validate required fields based on sourceType
    const { sourceType, sectionIds, conceptId, expansionId } = parsed.data;
    if (sourceType === 'video_section' && (!sectionIds || sectionIds.length === 0)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'sectionIds required for video_section type',
      });
    }
    if (sourceType === 'video_concept' && !conceptId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'conceptId required for video_concept type',
      });
    }
    if (sourceType === 'system_expansion' && !expansionId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'expansionId required for system_expansion type',
      });
    }

    try {
      const item = await createMemorizedItem(fastify.mongo.db, {
        userId: req.user.userId,
        ...parsed.data,
      });

      return reply.status(201).send(item);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('not found') ||
          error.message.includes('not processed')
        ) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
      }
      throw error;
    }
  });

  // PATCH /api/memorize/:id
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateItemSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    const item = await updateMemorizedItem(
      fastify.mongo.db,
      req.user.userId,
      req.params.id,
      parsed.data
    );

    if (!item) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Memorized item not found',
      });
    }

    return item;
  });

  // DELETE /api/memorize/:id
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const deleted = await deleteMemorizedItem(
      fastify.mongo.db,
      req.user.userId,
      req.params.id
    );

    if (!deleted) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Memorized item not found',
      });
    }

    return reply.status(204).send();
  });

  // GET /api/memorize/:id/chats
  fastify.get<{
    Params: { id: string };
  }>('/:id/chats', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // First verify the item exists and belongs to the user
    const item = await getMemorizedItemById(
      fastify.mongo.db,
      req.user.userId,
      req.params.id
    );

    if (!item) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Memorized item not found',
      });
    }

    const chats = await listChatsForItem(
      fastify.mongo.db,
      req.user.userId,
      req.params.id
    );

    return { chats };
  });
}
