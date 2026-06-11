import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Forbidden, NotFound } from '../lib/errors.js';

export const progress = Router();

// GET /api/me/dashboard — enrollments, progress %, stats
progress.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const { rows: enrolled } = await query(
      `SELECT c.id, c.slug, c.title, c.body, c.tier,
              count(m.id)::int AS modules,
              count(mp.id) FILTER (WHERE mp.completed)::int AS done
       FROM entitlements e
       JOIN courses c ON c.id=e.course_id
       LEFT JOIN modules m ON m.course_id=c.id
       LEFT JOIN module_progress mp ON mp.module_id=m.id AND mp.user_id=$1
       WHERE e.user_id=$1
       GROUP BY c.id ORDER BY c.title`, [req.user.id]);
    const { rows: stats } = await query('SELECT xp, level, best_streak, labs_done FROM learner_stats WHERE user_id=$1', [req.user.id]);
    res.json({
      courses: enrolled.map(c => ({ ...c, percent: c.modules ? Math.round(c.done / c.modules * 100) : 0 })),
      stats: stats[0] || { xp: 0, level: 1, best_streak: 0, labs_done: 0 },
    });
  } catch (e) { next(e); }
});

// POST /api/me/progress  { moduleId, completed }
progress.post('/progress',
  requireAuth,
  validate(z.object({ moduleId: z.string().uuid(), completed: z.boolean() })),
  async (req, res, next) => {
    try {
      const { moduleId, completed } = req.data;
      // Ensure the learner has access to the course this module belongs to.
      const { rows } = await query(
        `SELECT m.course_id, c.is_free FROM modules m JOIN courses c ON c.id=m.course_id WHERE m.id=$1`, [moduleId]);
      const mod = rows[0];
      if (!mod) throw NotFound('Module not found');
      if (!mod.is_free) {
        const ent = await query('SELECT 1 FROM entitlements WHERE user_id=$1 AND course_id=$2', [req.user.id, mod.course_id]);
        if (!ent.rowCount) throw Forbidden('No access to this course');
      }
      await query(
        `INSERT INTO module_progress (user_id, module_id, completed, completed_at)
         VALUES ($1,$2,$3, CASE WHEN $3 THEN now() END)
         ON CONFLICT (user_id, module_id)
         DO UPDATE SET completed=EXCLUDED.completed,
                       completed_at=CASE WHEN EXCLUDED.completed THEN now() ELSE NULL END`,
        [req.user.id, moduleId, completed]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

// POST /api/me/stats  { xpDelta, streak, labDone }  — synced from the simulator
progress.post('/stats',
  requireAuth,
  validate(z.object({ xpDelta: z.number().int().min(0).max(10000), streak: z.number().int().min(0).optional(), labDone: z.boolean().optional() })),
  async (req, res, next) => {
    try {
      const { xpDelta, streak = 0, labDone = false } = req.data;
      const { rows } = await query(
        `UPDATE learner_stats
           SET xp = xp + $2,
               level = 1 + floor((xp + $2)/500),
               best_streak = GREATEST(best_streak, $3),
               labs_done = labs_done + CASE WHEN $4 THEN 1 ELSE 0 END,
               updated_at = now()
         WHERE user_id=$1 RETURNING xp, level, best_streak, labs_done`,
        [req.user.id, xpDelta, streak, labDone]);
      res.json({ stats: rows[0] });
    } catch (e) { next(e); }
  });
