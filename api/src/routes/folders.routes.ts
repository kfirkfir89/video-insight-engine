import { FastifyInstance } from 'fastify';

export async function foldersRoutes(fastify: FastifyInstance) {
  // GET /api/folders
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { type } = req.query as { type?: string };
    // TODO: Implement folder service
    return { folders: [] };
  });

  // POST /api/folders
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // TODO: Implement
    return reply.code(201).send({ id: 'stub' });
  });
}
