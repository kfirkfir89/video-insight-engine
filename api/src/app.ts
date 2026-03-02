import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError } from './utils/errors.js';
import { createContainer, Container } from './container.js';

// Plugins
import { helmetPlugin } from './plugins/helmet.js';
import { mongodbPlugin } from './plugins/mongodb.js';
import { jwtPlugin } from './plugins/jwt.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { websocketPlugin } from './plugins/websocket.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { foldersRoutes } from './routes/folders.routes.js';
import { videosRoutes } from './routes/videos.routes.js';
import { playlistsRoutes } from './routes/playlists.routes.js';
import { memorizeRoutes } from './routes/memorize.routes.js';
import { explainRoutes } from './routes/explain.routes.js';
import { internalRoutes } from './routes/internal.routes.js';
import { streamRoutes } from './routes/stream.routes.js';

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Optional partial container override for testing */
  container?: Partial<Container>;
}

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const isDev = config.NODE_ENV === 'development';

  const fastify = Fastify({
    logger: options?.logger ?? {
      level: isDev ? 'debug' : 'info',
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
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(mongodbPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(websocketPlugin);

  // Create container and decorate (allow partial override for testing)
  const container = createContainer(fastify.mongo.db, fastify.log);
  if (options?.container) {
    Object.assign(container, options.container);
  }
  fastify.decorate('container', container);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Invalid input',
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
  await fastify.register(playlistsRoutes, { prefix: '/api/playlists' });
  await fastify.register(memorizeRoutes, { prefix: '/api/memorize' });
  await fastify.register(explainRoutes, { prefix: '/api/explain' });
  await fastify.register(internalRoutes, { prefix: '/internal' });

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  return fastify;
}
