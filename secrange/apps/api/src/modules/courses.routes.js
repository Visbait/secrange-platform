import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFound } from '../lib/errors.js';

export const courses = Router();

// GET /api/courses  — public catalog (optionally filter by ?category=&q=)
courses.get('/', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    const clauses = ['published'];
    const params = [];
    if (category && category !== 'all') { params.push(category); clauses.push(`category=$${params.length}`); }
    if (q) { params.push(`%${String(q).toLowerCase()}%`); clauses.push(`(lower(title) LIKE $${params.length} OR lower(summary) LIKE $${params.length})`); }
    const { rows } = await query(
      `SELECT id, slug, title, body, category, tier, summary, cost_label, est_time,
              is_free, price_cents, currency
       FROM courses WHERE ${clauses.join(' AND ')} ORDER BY tier, title`, params);
    res.json({ courses: rows });
  } catch (e) { next(e); }
});

// GET /api/courses/:slug — course + modules + (if authed) access + progress
courses.get('/:slug', maybeAuth, async (req, res, next) => {
  try {
    const { rows: crows } = await query('SELECT * FROM courses WHERE slug=$1 AND published', [req.params.slug]);
    const course = crows[0];
    if (!course) throw NotFound('Course not found');
    const { rows: modules } = await query(
      'SELECT id, position, title, points, lab_mode, lab_label FROM modules WHERE course_id=$1 ORDER BY position',
      [course.id]);

    let hasAccess = course.is_free, progress = {};
    if (req.user) {
      const ent = await query("SELECT 1 FROM entitlements WHERE user_id=$1 AND course_id=$2 AND status='active'",
        [req.user.id, course.id]);
      hasAccess = hasAccess || ent.rowCount > 0;
      const pr = await query(
        `SELECT mp.module_id, mp.completed FROM module_progress mp
         JOIN modules m ON m.id=mp.module_id WHERE mp.user_id=$1 AND m.course_id=$2`,
        [req.user.id, course.id]);
      pr.rows.forEach(r => { progress[r.module_id] = r.completed; });
    }
    // Gate module bodies behind access; always reveal titles so the catalog is browsable.
    const safeModules = modules.map(m => hasAccess ? m : { ...m, points: [], lab_mode: null, lab_label: null });
    res.json({ course: publicCourse(course), modules: safeModules, hasAccess, progress });
  } catch (e) { next(e); }
});

import { verifyAccessToken } from '../lib/tokens.js';
function maybeAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (t) { try { const c = verifyAccessToken(t); req.user = { id: c.sub, role: c.role }; } catch {} }
  next();
}
const publicCourse = (c) => ({
  id: c.id, slug: c.slug, title: c.title, body: c.body, category: c.category, tier: c.tier,
  summary: c.summary, costLabel: c.cost_label, estTime: c.est_time, isFree: c.is_free,
  priceCents: c.price_cents, currency: c.currency,
});
