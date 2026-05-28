import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError, DailyLimitReachedError } from './utils/errors.js';
import { createContainer, Container } from './container.js';

// Plugins
import { helmetPlugin } from './plugins/helmet.js';
import { mongodbPlugin } from './plugins/mongodb.js';
import { jwtPlugin } from './plugins/jwt.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { websocketPlugin } from './plugins/websocket.js';
import { tierPlugin } from './plugins/tier.js';
import { rabbitmqPlugin } from './plugins/rabbitmq.js';
import { redisPlugin } from './plugins/redis.js';
import { genRequestId, requestIdPlugin } from './plugins/request-id.js';
import { sentryFastifyPlugin } from './plugins/sentry.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { foldersRoutes } from './routes/folders.routes.js';
import { videosRoutes } from './routes/videos.routes.js';
import { playlistsRoutes } from './routes/playlists.routes.js';
import { assistantRoutes } from './routes/assistant.routes.js';
import { internalRoutes } from './routes/internal.routes.js';
import { streamRoutes } from './routes/stream.routes.js';
import { shareRoutes } from './routes/share.routes.js';
import { ssrRoutes } from './routes/ssr.routes.js';
import { overrideRoutes } from './routes/override.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { preferencesRoutes, userUsageRoutes } from './routes/preferences.routes.js';
import { adminQueueRoutes } from './routes/admin/queue.routes.js';
import { userMeRoutes, adminUsersRoutes } from './routes/users.routes.js';

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Optional partial container override for testing */
  container?: Partial<Container>;
}

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  // TODO: v1.5 — Initialize PostHog analytics when POSTHOG_API_KEY is set
  // npm install posthog-node, then: new PostHog(config.POSTHOG_API_KEY)
  // Track: output_created, output_shared, output_viewed, paywall_shown, paywall_converted

  const isDev = config.NODE_ENV === 'development';

  const fastify = Fastify({
    // Plugin reads/validates x-request-id manually via genReqId so we keep the
    // value validation in one place. requestIdHeader is false to opt out of
    // Fastify's built-in header parsing (which doesn't validate the value).
    requestIdHeader: false,
    requestIdLogLabel: 'requestId',
    genReqId: genRequestId,
    // When enabled (TRUST_PROXY env), `req.ip` is derived from X-Forwarded-For
    // instead of the direct TCP connection. Necessary in any deployment behind
    // a CDN, LB, or ingress — otherwise share-view dedup and IP-keyed rate
    // limits all collapse to the proxy's single IP. Default is `false` so
    // local-dev (no proxy) keeps the safe direct-connection behaviour.
    trustProxy: config.TRUST_PROXY_VALUE,
    logger: options?.logger ?? {
      level: isDev ? 'debug' : 'info',
      base: { service: 'vie-api' },
      ...(isDev && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
    disableRequestLogging: isDev,
  });

  // Dev: single-line request logging (replaces Fastify's verbose two-line default)
  // Skips health check endpoints to reduce noise from Docker/admin polling
  if (isDev) {
    fastify.addHook('onResponse', (req, reply, done) => {
      if (req.url === '/health' || req.url === '/healthz') {
        done();
        return;
      }
      const ms = reply.elapsedTime.toFixed(0);
      fastify.log.info(`${req.method} ${req.url} ${reply.statusCode} (${ms}ms)`);
      done();
    });
  }

  // Register plugins
  // request-id must be first so every other plugin's logs include it.
  await fastify.register(requestIdPlugin);
  // Sentry plugin registers an onError hook — must come after request-id so
  // captured events carry the requestId tag, but before any route registration
  // so route handler errors are funneled through it.
  await fastify.register(sentryFastifyPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(mongodbPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(websocketPlugin);
  // Redis is unconditionally registered — the dispatchGuardService wraps every
  // dispatchPipeline call and fails open if Redis is unreachable, so the plugin
  // is harmless even in environments without a working Redis.
  await fastify.register(redisPlugin);

  // RabbitMQ is only required when USE_QUEUE_PIPELINE is on. Registering
  // conditionally means dev environments without RabbitMQ still boot cleanly
  // and route through the legacy HTTP path.
  if (config.USE_QUEUE_PIPELINE) {
    await fastify.register(rabbitmqPlugin);
  }

  // Create container and decorate (allow partial override for testing)
  const channelSupplier = config.USE_QUEUE_PIPELINE
    ? () => fastify.rabbitmq.getChannel()
    : undefined;
  const container = createContainer(fastify.mongo.db, fastify.log, {
    queueChannelSupplier: channelSupplier,
    redisClient: fastify.redis,
  });
  if (options?.container) {
    Object.assign(container, options.container);
  }
  fastify.decorate('container', container);

  // Tier middleware (after JWT, uses container)
  await fastify.register(tierPlugin);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Invalid input',
      });
    }

    // Daily cost limit reached — surface resetAt for the UI countdown
    if (error instanceof DailyLimitReachedError) {
      return reply.status(error.status).send({
        error: error.code,
        message: error.message,
        resetAt: error.resetAt,
        limitUsd: error.limitUsd,
      });
    }

    // Application errors (AppError and subclasses)
    if (error instanceof AppError) {
      return reply.status(error.status).send({
        error: error.code,
        message: error.message,
      });
    }

    // MongoDB BSONError (invalid ObjectId format)
    if (error.name === 'BSONError') {
      return reply.status(400).send({
        error: 'INVALID_ID_FORMAT',
        message: 'Invalid ID format',
      });
    }

    // Fastify plugin errors (rate-limit, auth, etc.) — respect their statusCode
    if (typeof error.statusCode === 'number' && error.statusCode !== 500) {
      const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : 'ERROR';
      return reply.status(error.statusCode).send({
        error: errorCode,
        message: error.message,
      });
    }

    // Log unexpected errors
    request.log.error(error);

    // Don't expose internal error details in production
    const message = config.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message,
    });
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(foldersRoutes, { prefix: '/api/folders' });
  await fastify.register(videosRoutes, { prefix: '/api/videos' });
  await fastify.register(streamRoutes, { prefix: '/api/videos' });  // Streaming SSE route
  await fastify.register(overrideRoutes, { prefix: '/api/videos' }); // Override category
  await fastify.register(playlistsRoutes, { prefix: '/api/playlists' });
  await fastify.register(assistantRoutes, { prefix: '/api/videos' });
  await fastify.register(shareRoutes, { prefix: '/api/share' });
  await fastify.register(paymentRoutes, { prefix: '/api/payments' });
  await fastify.register(preferencesRoutes, { prefix: '/api/users/me/preferences' });
  await fastify.register(userUsageRoutes, { prefix: '/api/users/me/usage' });
  await fastify.register(userMeRoutes, { prefix: '/api/users/me' });
  await fastify.register(internalRoutes, { prefix: '/internal' });
  await fastify.register(adminQueueRoutes, { prefix: '/api/admin/queue' });
  await fastify.register(adminUsersRoutes, { prefix: '/api/admin/users' });

  // SSR routes (top-level, no /api prefix — for social media crawlers)
  await fastify.register(ssrRoutes);

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  return fastify;
}
