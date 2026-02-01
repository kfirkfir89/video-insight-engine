import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';
import { ValidationError } from '../utils/errors.js';

const sourceTypeSchema = z.enum(['video_section', 'video_concept', 'system_expansion']);

const memorizeQuerySchema = z.object({
  folderId: objectIdSchema.optional(),
});

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  sourceType: sourceTypeSchema,
  videoSummaryId: objectIdSchema,
  sectionIds: z.array(z.string()).optional(),
  conceptId: z.string().optional(),
  expansionId: objectIdSchema.optional(),
  startSeconds: z.number().optional(),
  endSeconds: z.number().optional(),
  folderId: objectIdSchema.optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  folderId: objectIdSchema.optional().nullable(),
});

export async function memorizeRoutes(fastify: FastifyInstance) {
  const { memorizeService } = fastify.container;

  // GET /api/memorize
  fastify.get<{
    Querystring: z.infer<typeof memorizeQuerySchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { folderId } = memorizeQuerySchema.parse(req.query);
    const items = await memorizeService.list(req.user.userId, folderId);
    return { items };
  });

  // GET /api/memorize/:id
  fastify.get<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const item = await memorizeService.getById(req.user.userId, id);
    return { item };
  });

  // POST /api/memorize
  fastify.post<{
    Body: z.infer<typeof createItemSchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const input = createItemSchema.parse(req.body);

    // Validate required fields based on sourceType
    const { sourceType, sectionIds, conceptId, expansionId } = input;
    if (sourceType === 'video_section' && (!sectionIds || sectionIds.length === 0)) {
      throw new ValidationError('sectionIds required for video_section type');
    }
    if (sourceType === 'video_concept' && !conceptId) {
      throw new ValidationError('conceptId required for video_concept type');
    }
    if (sourceType === 'system_expansion' && !expansionId) {
      throw new ValidationError('expansionId required for system_expansion type');
    }

    const item = await memorizeService.create({
      userId: req.user.userId,
      ...input,
    });

    return reply.status(201).send(item);
  });

  // PATCH /api/memorize/:id
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof updateItemSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateItemSchema.parse(req.body);
    return memorizeService.update(req.user.userId, id, input);
  });

  // DELETE /api/memorize/:id
  fastify.delete<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    await memorizeService.delete(req.user.userId, id);
    return reply.status(204).send();
  });

  // GET /api/memorize/:id/chats
  fastify.get<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id/chats', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    // getById will throw if not found
    await memorizeService.getById(req.user.userId, id);
    const chats = await memorizeService.listChats(req.user.userId, id);
    return { chats };
  });
}
