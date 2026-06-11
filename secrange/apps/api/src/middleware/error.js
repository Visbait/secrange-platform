import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
}
export const notFound = (_req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
