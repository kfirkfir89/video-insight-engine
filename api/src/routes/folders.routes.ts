import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderById,
} from '../services/folder.service.js';

const folderTypeSchema = z.enum(['summarized', 'memorized']);

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  type: folderTypeSchema,
  parentId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export async function foldersRoutes(fastify: FastifyInstance) {
  // GET /api/folders
  fastify.get<{
    Querystring: { type?: string };
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const typeParam = req.query.type;

    let type: 'summarized' | 'memorized' | undefined;
    if (typeParam) {
      const parsed = folderTypeSchema.safeParse(typeParam);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'type must be "summarized" or "memorized"',
        });
      }
      type = parsed.data;
    }

    const folders = await listFolders(fastify.mongo.db, req.user.userId, type);
    return { folders };
  });

  // GET /api/folders/:id
  fastify.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const folder = await getFolderById(fastify.mongo.db, req.user.userId, req.params.id);

    if (!folder) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Folder not found',
      });
    }

    return folder;
  });

  // POST /api/folders
  fastify.post<{
    Body: z.infer<typeof createFolderSchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = createFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    try {
      const folder = await createFolder(fastify.mongo.db, {
        userId: req.user.userId,
        ...parsed.data,
      });

      return reply.status(201).send(folder);
    } catch (error) {
      if (error instanceof Error && error.message === 'Parent folder not found') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Parent folder not found',
        });
      }
      throw error;
    }
  });

  // PATCH /api/folders/:id
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateFolderSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = updateFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    try {
      const folder = await updateFolder(
        fastify.mongo.db,
        req.user.userId,
        req.params.id,
        parsed.data
      );

      if (!folder) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Folder not found',
        });
      }

      return folder;
    } catch (error) {
      if (error instanceof Error && error.message === 'Parent folder not found') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Parent folder not found',
        });
      }
      throw error;
    }
  });

  // DELETE /api/folders/:id
  // Query param: deleteContent=true to delete all content, otherwise moves content to root
  fastify.delete<{
    Params: { id: string };
    Querystring: { deleteContent?: string };
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const deleteContent = req.query.deleteContent === 'true';

    const deleted = await deleteFolder(
      fastify.mongo.db,
      req.user.userId,
      req.params.id,
      deleteContent
    );

    if (!deleted) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Folder not found',
      });
    }

    return reply.status(204).send();
  });
}
