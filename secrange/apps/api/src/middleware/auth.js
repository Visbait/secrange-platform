import { verifyAccessToken } from '../lib/tokens.js';
import { Unauthorized } from '../lib/errors.js';

// Require a valid access token (Authorization: Bearer ...)
export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(Unauthorized('Missing access token'));
  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role, name: claims.name };
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}
export function requireRole(...roles) {
  return (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(Unauthorized('Insufficient role'));
}
