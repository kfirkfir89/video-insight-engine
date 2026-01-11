import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderById,
} from '../services/folder.service.js';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';

const folderTypeSchema = z.enum(['summarized', 'memorized']);

const foldersQuerySchema = z.object({
  type: folderTypeSchema.optional(),
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  type: folderTypeSchema,
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

export async function foldersRoutes(fastify: FastifyInstance) {
  // GET /api/folders
  fastify.get<{
    Querystring: z.infer<typeof foldersQuerySchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { type } = foldersQuerySchema.parse(req.query);
    const folders = await listFolders(fastify.mongo.db, req.user.userId, type);
    return { folders };
  });

  // GET /api/folders/:id
  fastify.get<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return getFolderById(fastify.mongo.db, req.user.userId, id);
  });

  // POST /api/folders
  fastify.post<{
    Body: z.infer<typeof createFolderSchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const input = createFolderSchema.parse(req.body);
    const folder = await createFolder(fastify.mongo.db, {
      userId: req.user.userId,
      ...input,
    });
    return reply.status(201).send(folder);
  });

  // PATCH /api/folders/:id
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof updateFolderSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateFolderSchema.parse(req.body);
    return updateFolder(fastify.mongo.db, req.user.userId, id, input);
  });

  // DELETE /api/folders/:id
  // Query param: deleteContent=true to delete all content, otherwise moves content to root
  fastify.delete<{
    Params: z.infer<typeof idParamSchema>;
    Querystring: z.infer<typeof deleteFolderQuerySchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const { deleteContent } = deleteFolderQuerySchema.parse(req.query);
    await deleteFolder(fastify.mongo.db, req.user.userId, id, deleteContent === 'true');
    return reply.status(204).send();
  });
}
