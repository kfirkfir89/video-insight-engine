import { FastifyInstance } from 'fastify';

export async function memorizeRoutes(fastify: FastifyInstance) {
  // GET /api/memorize
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async () => {
    // TODO: Implement
    return { items: [] };
  });

  // POST /api/memorize
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // TODO: Implement
    return reply.code(201).send({ id: 'stub' });
  });
}
