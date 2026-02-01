import { buildApp } from './app.js';
import { config } from './config.js';

export async function startServer(): Promise<void> {
  const app = await buildApp();

  // Process handlers for uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    app.log.error({ reason, promise }, 'Unhandled Rejection');
  });

  process.on('uncaughtException', (error) => {
    app.log.error(error, 'Uncaught Exception');
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down gracefully`);
    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start server
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`vie-api running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}
