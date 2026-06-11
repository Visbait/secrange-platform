import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { signAccessToken, newRefreshToken, hashToken } from '../lib/tokens.js';
import { BadRequest, Unauthorized, Conflict } from '../lib/errors.js';
import crypto from 'node:crypto';

export const auth = Router();

const credsSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  displayName: z.string().min(1).max(80).optional(),
});

// Argon2id — memory-hard password hashing
const argonOpts = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

function setRefreshCookie(res, raw) {
  res.cookie('rt', raw, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'lax',
    domain: config.cookie.domain,
    path: '/api/auth',
    maxAge: config.jwt.refreshTtl * 1000,
  });
}

async function issueSession(res, user, req, client = null) {
  const q = client ? client.query.bind(client) : query;
  const { raw, hash } = newRefreshToken();
  const familyId = crypto.randomUUID();
  const expires = new Date(Date.now() + config.jwt.refreshTtl * 1000);
  await q(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user.id, hash, familyId, expires, req.headers['user-agent'] || null, req.ip || null]
  );
  setRefreshCookie(res, raw);
  return signAccessToken(user);
}

// POST /api/auth/register
auth.post('/register', validate(credsSchema), async (req, res, next) => {
  try {
    const { email, password, displayName } = req.data;
    const hash = await argon2.hash(password, argonOpts);
    const result = await tx(async (client) => {
      const existing = await client.query('SELECT 1 FROM users WHERE email=$1', [email]);
      if (existing.rowCount) throw Conflict('Email already registered');
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, display_name)
         VALUES ($1,$2,$3) RETURNING id, email, display_name, role`,
        [email, hash, displayName || email.split('@')[0]]
      );
      const user = rows[0];
      await client.query('INSERT INTO learner_stats (user_id) VALUES ($1)', [user.id]);
      const access = await issueSession(res, user, req, client);
      return { user, access };
    });
    res.status(201).json({ user: publicUser(result.user), accessToken: result.access });
  } catch (e) { next(e); }
});

// POST /api/auth/login
auth.post('/login', validate(credsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.data;
    const { rows } = await query(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE email=$1', [email]);
    const user = rows[0];
    // Constant-ish behavior: always verify against a hash to reduce user-enumeration timing
    const ok = user ? await argon2.verify(user.password_hash, password) : await argon2.verify(
      '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$3l5Z9q', password).catch(() => false);
    if (!user || !ok) throw Unauthorized('Invalid email or password');
    const access = await issueSession(res, user, req);
    res.json({ user: publicUser(user), accessToken: access });
  } catch (e) { next(e); }
});

// POST /api/auth/refresh  — rotates the refresh token, detects reuse
auth.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.rt;
    if (!raw) throw Unauthorized('No refresh token');
    const presented = hashToken(raw);
    await tx(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE`, [presented]);
      const token = rows[0];
      if (!token) throw Unauthorized('Invalid refresh token');
      // Reuse detection: a revoked token being presented = compromise -> nuke the family
      if (token.revoked_at || token.expires_at < new Date()) {
        await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE family_id=$1', [token.family_id]);
        throw Unauthorized('Refresh token reuse detected');
      }
      await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1', [token.id]);
      const { rows: urows } = await client.query(
        'SELECT id, email, display_name, role FROM users WHERE id=$1', [token.user_id]);
      const user = urows[0];
      // Issue a new token in the SAME family
      const { raw: newRaw, hash } = newRefreshToken();
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.id, hash, token.family_id,
         new Date(Date.now() + config.jwt.refreshTtl * 1000),
         req.headers['user-agent'] || null, req.ip || null]);
      setRefreshCookie(res, newRaw);
      res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
    });
  } catch (e) { next(e); }
});

// POST /api/auth/logout
auth.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.rt;
    if (raw) await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [hashToken(raw)]);
    res.clearCookie('rt', { path: '/api/auth', domain: config.cookie.domain });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/auth/me
auth.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, email, display_name, role, created_at FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) throw Unauthorized();
    res.json({ user: publicUser(rows[0]) });
  } catch (e) { next(e); }
});

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role });
