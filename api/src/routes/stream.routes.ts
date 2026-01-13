import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ObjectId, Db } from 'mongodb';
import { config } from '../config.js';
import { VideoNotFoundError } from '../utils/errors.js';
import { handleSSEPreflight, setSSECorsHeaders, setSSEResponseHeaders } from '../utils/cors.js';

const videoSummaryIdParamSchema = z.object({
  videoSummaryId: z.string().refine((val) => ObjectId.isValid(val), 'Invalid ID'),
});

export async function streamRoutes(fastify: FastifyInstance) {
  const db: Db = fastify.mongo.db;

  /**
   * OPTIONS /api/videos/:videoSummaryId/stream
   *
   * Handle CORS preflight for SSE endpoint
   */
  fastify.options('/:videoSummaryId/stream', async (req, reply) => {
    return handleSSEPreflight(req, reply);
  });

  /**
   * GET /api/videos/:videoSummaryId/stream
   *
   * Proxy SSE stream from summarizer service for real-time summarization.
   * Returns character-by-character LLM output as Server-Sent Events.
   */
  fastify.get<{
    Params: z.infer<typeof videoSummaryIdParamSchema>;
  }>('/:videoSummaryId/stream', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { videoSummaryId } = videoSummaryIdParamSchema.parse(req.params);

    // Verify user has access to this video
    const userVideo = await db.collection('userVideos').findOne({
      userId: new ObjectId(req.user.userId),
      videoSummaryId: new ObjectId(videoSummaryId),
    });

    if (!userVideo) {
      throw new VideoNotFoundError();
    }

    // Set CORS and SSE headers (reply.raw bypasses Fastify CORS plugin)
    setSSECorsHeaders(req, reply);
    setSSEResponseHeaders(reply);

    // Proxy the stream from summarizer
    const summarizerUrl = `${config.SUMMARIZER_URL}/summarize/stream/${videoSummaryId}`;

    try {
      const response = await fetch(summarizerUrl, {
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      // Issue #1: Improved error handling with proper status codes
      if (!response.ok) {
        const status = response.status;
        const errorMessage = status === 404 ? 'Video not found'
          : status === 500 ? 'Summarizer service error'
          : `Summarizer returned ${status}`;
        const errorCode = status === 404 ? 'NOT_FOUND' : 'SUMMARIZER_ERROR';
        reply.raw.write(`data: ${JSON.stringify({ event: 'error', message: errorMessage, code: errorCode })}\n\n`);
        reply.raw.end();
        return;
      }

      if (!response.body) {
        reply.raw.write(`data: ${JSON.stringify({ event: 'error', message: 'No response body', code: 'NO_BODY' })}\n\n`);
        reply.raw.end();
        return;
      }

      // Stream the response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Issue #2: Fixed memory leak - proper cleanup with tracking
      let cleanedUp = false;
      const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;
        try {
          await reader.cancel();
        } catch {
          // Ignore cancellation errors
        }
      };

      // Handle client disconnect
      req.raw.on('close', () => {
        cleanup();
      });

      // Stream chunks with proper cleanup
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
        }
      } finally {
        await cleanup();
      }

      reply.raw.end();
    } catch (error) {
      req.log.error(error, 'Stream proxy error');
      reply.raw.write(`data: ${JSON.stringify({ event: 'error', message: 'Stream connection failed', code: 'CONNECTION_FAILED' })}\n\n`);
      reply.raw.end();
    }

    // Return void to prevent Fastify from trying to send a response
    return;
  });
}
