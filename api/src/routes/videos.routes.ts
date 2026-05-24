import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema, objectIdSchema } from '../utils/validation.js';
import { config } from '../config.js';
import { extractYoutubeId } from '../utils/youtube.js';

// Stripe's spec is "1–255 chars, opaque to us". Reject longer to keep junk out
// of the DB; reject control chars/whitespace because they're never produced by
// real clients and would muddy logs.
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

// Provider config schema for dev tools (optional)
const providerSchema = z.enum(['anthropic', 'openai', 'gemini']);
const providerConfigSchema = z.object({
  default: providerSchema,
  fast: providerSchema.optional(),
  fallback: providerSchema.nullable().optional(),
}).optional();

const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: objectIdSchema.optional(),
  bypassCache: z.boolean().optional().default(false),
  providers: providerConfigSchema,
});

const moveVideoSchema = z.object({
  folderId: objectIdSchema.nullable(),
});

const videosQuerySchema = z.object({
  folderId: objectIdSchema.optional(),
});

// YouTube ID validation: 11 characters, alphanumeric plus dash/underscore
const youtubeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube ID format');

const versionsParamSchema = z.object({
  youtubeId: youtubeIdSchema,
});

const versionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function videosRoutes(fastify: FastifyInstance) {
  const { videoService, costMonitorService, idempotencyService, videoRepository } = fastify.container;

  // GET /api/videos
  fastify.get<{
    Querystring: z.infer<typeof videosQuerySchema>;
  }>('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { folderId } = videosQuerySchema.parse(req.query);
    const videos = await videoService.getVideos(req.user.userId, folderId);
    return { videos };
  });

  // GET /api/videos/:id
  fastify.get<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return videoService.getVideo(req.user.userId, id);
  });

  // POST /api/videos
  // Video daily limit is configurable via VIDEO_DAILY_LIMIT env var (0 = unlimited)
  const videoDailyLimit = config.RATE_LIMITS.VIDEO_DAILY;
  fastify.post<{
    Body: z.infer<typeof createVideoSchema>;
  }>('/', {
    preHandler: [fastify.authenticate, fastify.resolveTier],
    config: {
      rateLimit: videoDailyLimit > 0 ? {
        max: videoDailyLimit,
        timeWindow: '24 hours',
        errorResponseBuilder: () => ({
          error: 'RATE_LIMITED',
          message: `Daily video limit reached (${videoDailyLimit} videos per 24 hours). Try again tomorrow.`,
          statusCode: 429,
        }),
      } : false, // Disable rate limiting when limit is 0
    },
  }, async (req, reply) => {
    const input = createVideoSchema.parse(req.body);

    // ─── Idempotency gate ────────────────────────────────────────────────
    // Validate the optional client-supplied header before doing any work.
    // We bound the size + alphabet so a misbehaving client can't pollute
    // the index.
    const rawHeader = req.headers['idempotency-key'];
    const clientKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (clientKey && !IDEMPOTENCY_KEY_PATTERN.test(clientKey)) {
      return reply.code(400).send({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key must be 1-255 printable ASCII characters',
      });
    }

    // Extract youtubeId early — it's the dedup primary key. Malformed URLs
    // fall through to `createVideo` which raises InvalidYouTubeUrlError; we
    // just skip the gate.
    const youtubeId = extractYoutubeId(input.url);

    // `bypassCache=true` is the explicit escape hatch — admin/power-user
    // wants a fresh run even though inputs match. Skip the gate entirely.
    let hash: string | null = null;
    if (youtubeId && !input.bypassCache) {
      hash = idempotencyService.computeKey({
        userId: req.user.userId,
        youtubeId,
        providers: input.providers,
        clientKey,
      });

      // Reserve-before-work: atomic insert of a `pending` placeholder on the
      // unique-hash index. Concurrent identical submits race here — exactly
      // one inserts, the rest see the existing row.
      let reserveResult = await idempotencyService.reserveHash({
        hash,
        userId: req.user.userId,
        youtubeId,
      });

      if (!reserveResult.created) {
        const existing = reserveResult.doc;
        if (existing.status === 'completed' && existing.userVideoId && existing.videoSummaryId) {
          // Original finished — check the referenced user-video still exists.
          // If the user deleted it, drop the stale hash and reserve fresh.
          const userVideo = await videoRepository.findUserVideo(
            req.user.userId,
            existing.userVideoId.toString(),
          );
          if (userVideo) {
            const summary = await videoRepository.findCacheById(
              userVideo.videoSummaryId.toString(),
            );
            return reply.code(200).send({
              video: {
                id: userVideo._id.toString(),
                videoSummaryId: userVideo.videoSummaryId.toString(),
                youtubeId: userVideo.youtubeId,
                title: summary?.title || userVideo.title,
                channel: summary?.channel || userVideo.channel,
                duration: summary?.duration || userVideo.duration,
                thumbnailUrl: summary?.thumbnailUrl || userVideo.thumbnailUrl,
                status: summary?.status || userVideo.status,
              },
              cached: true,
              duplicate: true,
            });
          }
          // Scoped invalidate: delete only the specific completed row we saw.
          // If another submit raced and re-reserved this hash between our
          // findUserVideo and this deleteOne, we leave that new row alone.
          await idempotencyService.invalidateStaleCompleted(hash, existing.videoSummaryId.toString());
          reserveResult = await idempotencyService.reserveHash({
            hash,
            userId: req.user.userId,
            youtubeId,
          });
          if (!reserveResult.created) {
            // Someone else won between our delete and retry — bow out gracefully.
            return reply.code(409).send({
              error: 'IDEMPOTENCY_IN_FLIGHT',
              message: 'Another request with the same key is currently processing. Retry shortly.',
            });
          }
        } else {
          // status === 'pending' — original work is still in flight.
          return reply.code(409).send({
            error: 'IDEMPOTENCY_IN_FLIGHT',
            message: 'Another request with the same key is currently processing. Retry shortly.',
          });
        }
      }
    }

    // We hold the hash reservation (or are not gated). On any failure from
    // here on, unwind the hash so retries are allowed without waiting for TTL.
    const unwindHash = async () => {
      if (!hash) return;
      await idempotencyService.invalidateByHash(hash).catch((err) => {
        // Log only a hash prefix — full hash is a stable per-(user,video) ID
        // and PII-adjacent. 8 hex chars is enough for log correlation.
        req.log.warn({ err, hashPrefix: hash.slice(0, 8) }, 'idempotency invalidate-on-unwind failed');
      });
    };

    // Atomic reservation — increment-then-check serializes concurrent starts on
    // the per-user/day doc. Throws DailyLimitReachedError if the user is past
    // their tier cap. `reservation` is null for unlimited tiers.
    let reservation: Awaited<ReturnType<typeof costMonitorService.reserveUserCost>>;
    try {
      reservation = await costMonitorService.reserveUserCost(
        req.user.userId,
        req.tier.name,
      );
    } catch (err) {
      await unwindHash();
      throw err;
    }

    let result: Awaited<ReturnType<typeof videoService.createVideo>>;
    try {
      result = await videoService.createVideo(
        req.user.userId,
        input.url,
        {
          folderId: input.folderId,
          bypassCache: input.bypassCache,
          providers: input.providers,
          tier: req.tier.name,
          requestId: req.id,
        }
      );
    } catch (err) {
      await costMonitorService.refundReservation(reservation);
      await unwindHash();
      throw err;
    }

    // Cached videos run no pipeline, so no llm_usage rows will arrive — refund now.
    // Swallow refund errors: the user's video is already created, and the nightly
    // reconcile will heal a stuck reservation if the refund Mongo call transiently fails.
    if (result.cached) {
      await costMonitorService.refundReservation(reservation).catch((err) => {
        req.log.warn({ err, userId: req.user.userId }, 'cached-video refund failed; nightly reconcile will recover');
      });
    }

    // Promote the pending hash to `completed` with the real IDs. Failure here
    // leaves the placeholder pending until TTL, which would lock the user out
    // of retries — so on missing IDs or a Mongo error, invalidate instead so
    // the next submit can re-reserve.
    if (hash) {
      if (result.video?.id && result.video?.videoSummaryId) {
        await idempotencyService.completeHash({
          hash,
          videoSummaryId: result.video.videoSummaryId,
          userVideoId: result.video.id,
        }).catch((err) => {
          req.log.warn({ err, hashPrefix: hash.slice(0, 8) }, 'idempotency complete failed; invalidating placeholder');
          return unwindHash();
        });
      } else {
        await unwindHash();
      }
    }

    return reply.code(201).send(result);
  });

  // DELETE /api/videos/:id
  fastify.delete<{
    Params: z.infer<typeof idParamSchema>;
  }>('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    await videoService.deleteVideo(req.user.userId, id);
    return reply.code(204).send();
  });

  // PATCH /api/videos/:id/move - Move video to a folder
  fastify.patch<{
    Params: z.infer<typeof idParamSchema>;
    Body: z.infer<typeof moveVideoSchema>;
  }>('/:id/move', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const { folderId } = moveVideoSchema.parse(req.body);
    return videoService.moveToFolder(req.user.userId, id, folderId);
  });

  // GET /api/videos/versions/:youtubeId - Get all versions of a video for A/B comparison
  // Requires user to own the video (have it in their library)
  fastify.get<{
    Params: z.infer<typeof versionsParamSchema>;
    Querystring: z.infer<typeof versionsQuerySchema>;
  }>('/versions/:youtubeId', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { youtubeId } = versionsParamSchema.parse(req.params);
    const { limit } = versionsQuerySchema.parse(req.query);

    // Authorization: verify user owns a video with this youtubeId
    const userOwnsVideo = await videoService.userOwnsVideo(req.user.userId, youtubeId);
    if (!userOwnsVideo) {
      return reply.code(404).send({
        error: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    const versions = await videoService.getVersions(youtubeId, { limit });
    return { versions };
  });
}
