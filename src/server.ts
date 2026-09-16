import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const { port, host } = config.app;

const server = app.listen(port, host, () => {
  logger.info(
    `🚀 ${config.app.name} (v${config.app.version}) running on http://${host}:${port}${config.api.prefix}`
  );
  logger.info(`Environment: ${config.app.env} | Database: ${config.database.type}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`${signal} received, closing HTTP server gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully terminating.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
