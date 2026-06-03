import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// How many owned videos to fold into a single library-mode query. Bounded so a
// power user's library can't balloon the assistant request body unboundedly.
const OWNED_VIDEOS_LIMIT = 200;

const libraryChatBodySchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).optional(),
});

const librarySearchBodySchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().positive().max(50).optional(),
  sources: z.array(z.string().min(1).max(64)).max(20).optional(),
});

export async function assistantLibraryRoutes(fastify: FastifyInstance) {
  const { assistantClient, videoRepository } = fastify.container;

  // POST /api/assistant/library/chat
  fastify.post<{
    Body: z.infer<typeof libraryChatBodySchema>;
  }>('/library/chat', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = libraryChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    // Derive owned YouTube ids server-side — never trust a client id list.
    const videos = await videoRepository.getUserVideos(req.user.userId, undefined, {
      limit: OWNED_VIDEOS_LIMIT,
    });
    if (videos.length === OWNED_VIDEOS_LIMIT) {
      req.log.warn(
        { userId: req.user.userId, cap: OWNED_VIDEOS_LIMIT },
        'library scope truncated at cap — user may own more videos than were searched',
      );
    }
    const youtubeIds = Array.from(new Set(videos.map(v => v.youtubeId).filter(Boolean)));
    // Inventory (id + title) so the assistant can name videos by title and answer
    // "what videos do I have?". Deduped by youtube id — same scope as youtubeIds.
    const seenIds = new Set<string>();
    const library = videos.reduce<Array<{ video_id: string; title: string }>>((acc, v) => {
      if (v.youtubeId && !seenIds.has(v.youtubeId)) {
        seenIds.add(v.youtubeId);
        acc.push({ video_id: v.youtubeId, title: v.cache?.title ?? v.title ?? '' });
      }
      return acc;
    }, []);

    try {
      const stream = await assistantClient.libraryChat({
        youtubeIds,
        library,
        message: parsed.data.message,
        conversationHistory: parsed.data.conversationHistory,
        userId: req.user.userId,
        requestId: req.id,
      });

      // Set SSE headers and pipe the stream directly.
      // @fastify/cors set ACAO/ACAC on the Fastify reply, but reply.raw.writeHead
      // bypasses Fastify's header flush — forward them so the browser doesn't block
      // the SSE stream (credentials: 'include' requires an explicit, non-* origin).
      const corsOrigin = reply.getHeader('access-control-allow-origin');
      const corsCreds = reply.getHeader('access-control-allow-credentials');
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...(corsOrigin ? { 'Access-Control-Allow-Origin': String(corsOrigin), Vary: 'Origin' } : {}),
        ...(corsCreds ? { 'Access-Control-Allow-Credentials': String(corsCreds) } : {}),
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }

      reply.raw.end();
    } catch (error) {
      // If headers already sent, can't change status
      if (reply.raw.headersSent) {
        reply.raw.end();
        return;
      }
      fastify.log.error(error, 'assistant library chat failed');
      return reply.status(502).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Assistant service is temporarily unavailable. Please try again.',
      });
    }
  });

  // POST /api/assistant/library/search
  fastify.post<{
    Body: z.infer<typeof librarySearchBodySchema>;
  }>('/library/search', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const parsed = librarySearchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid request body',
      });
    }

    // Derive owned YouTube ids server-side — never trust a client id list.
    const videos = await videoRepository.getUserVideos(req.user.userId, undefined, {
      limit: OWNED_VIDEOS_LIMIT,
    });
    if (videos.length === OWNED_VIDEOS_LIMIT) {
      req.log.warn(
        { userId: req.user.userId, cap: OWNED_VIDEOS_LIMIT },
        'library scope truncated at cap — user may own more videos than were searched',
      );
    }
    const youtubeIds = Array.from(new Set(videos.map(v => v.youtubeId).filter(Boolean)));

    try {
      const { status, body } = await assistantClient.librarySearch({
        youtubeIds,
        query: parsed.data.query,
        topK: parsed.data.topK,
        sources: parsed.data.sources,
        userId: req.user.userId,
        requestId: req.id,
      });

      return reply.status(status).send(body);
    } catch (error) {
      fastify.log.error(error, 'assistant library search failed');
      return reply.status(502).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Assistant service is temporarily unavailable. Please try again.',
      });
    }
  });
}
