import { FastifyInstance } from 'fastify';

export async function explainRoutes(fastify: FastifyInstance) {
  // GET /api/explain/:videoSummaryId/:targetType/:targetId
  fastify.get('/:videoSummaryId/:targetType/:targetId', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    // TODO: Implement MCP call
    return { expansion: '# Coming soon\n\nMCP integration pending.' };
  });

  // POST /api/explain/chat
  fastify.post('/chat', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    // TODO: Implement MCP call
    return { response: 'Chat coming soon', chatId: 'stub' };
  });
}
