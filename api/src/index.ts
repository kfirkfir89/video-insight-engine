import Fastify from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError } from './utils/errors.js';

// Plugins
import { mongodbPlugin } from './plugins/mongodb.js';
import { jwtPlugin } from './plugins/jwt.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { websocketPlugin } from './plugins/websocket.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { foldersRoutes } from './routes/folders.routes.js';
import { videosRoutes } from './routes/videos.routes.js';
import { memorizeRoutes } from './routes/memorize.routes.js';
import { explainRoutes } from './routes/explain.routes.js';
import { internalRoutes } from './routes/internal.routes.js';
import { streamRoutes } from './routes/stream.routes.js';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
await fastify.register(corsPlugin);
await fastify.register(rateLimitPlugin);
await fastify.register(mongodbPlugin);
await fastify.register(jwtPlugin);
await fastify.register(websocketPlugin);

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
await fastify.register(memorizeRoutes, { prefix: '/api/memorize' });
await fastify.register(explainRoutes, { prefix: '/api/explain' });
await fastify.register(internalRoutes, { prefix: '/internal' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// Start server
try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
  fastify.log.info(`vie-api running on port ${config.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
