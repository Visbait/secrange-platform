import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { pool } from './db/pool.js';

const app = buildApp();
const server = app.listen(config.port, () => logger.info(`API listening on :${config.port} (${config.env})`));

// Graceful shutdown — drain connections, close the pool.
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
