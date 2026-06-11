// Access tokens (short-lived JWT) + refresh tokens (opaque, rotating, hashed at rest).
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.display_name },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: 'secrange' }
  );
}
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: 'secrange' });
}
// Opaque refresh token: random secret returned to client; only its hash is stored.
export function newRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
