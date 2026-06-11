import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { recommendPath } from '../lib/recommend.js';

export const profile = Router();

// GET /api/me/profile — everything the profile page needs in one call:
//   account, completed courses, in-progress courses, subscription/billing,
//   stats, and recommended next certifications toward "security engineer".
profile.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user.id;

    const account = (await query(
      `SELECT id, email, display_name, role, email_verified, created_at
       FROM users WHERE id=$1`, [uid])).rows[0];

    // Per-course progress for everything the learner has access to.
    const owned = (await query(
      `SELECT c.id, c.slug, c.title, c.body, c.category, c.tier, c.is_free,
              e.source, e.granted_at,
              count(m.id)::int AS modules,
              count(mp.id) FILTER (WHERE mp.completed)::int AS done
       FROM entitlements e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN modules m ON m.course_id = c.id
       LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.user_id = $1
       WHERE e.user_id = $1
       GROUP BY c.id, e.source, e.granted_at
       ORDER BY e.granted_at DESC`, [uid])).rows
      .map(c => ({ ...c, percent: c.modules ? Math.round(c.done / c.modules * 100) : 0 }));

    const completed = owned.filter(c => c.modules > 0 && c.done === c.modules);
    const inProgress = owned.filter(c => !(c.modules > 0 && c.done === c.modules));

    // Billing summary derived from how each entitlement was granted.
    const purchases = owned.filter(c => c.source === 'purchase');
    const billing = {
      activeEntitlements: owned.length,
      purchasedCourses: purchases.length,
      freeCourses: owned.filter(c => c.source === 'free' || c.is_free).length,
      hasStripeCustomer: !!(await query('SELECT stripe_customer_id FROM users WHERE id=$1', [uid])).rows[0]?.stripe_customer_id,
    };

    const stats = (await query(
      `SELECT xp, level, best_streak, labs_done FROM learner_stats WHERE user_id=$1`, [uid])).rows[0]
      || { xp: 0, level: 1, best_streak: 0, labs_done: 0 };

    // Recommendations: what to take next, given what they've completed.
    const allCourses = (await query(
      `SELECT slug, title, body, category, tier, is_free, price_cents FROM courses WHERE published`)).rows;
    const ownedSlugs = new Set(owned.map(c => c.slug));
    const completedSlugs = new Set(completed.map(c => c.slug));
    const recommendations = recommendPath({ allCourses, ownedSlugs, completedSlugs });

    res.json({
      account: {
        id: account.id, email: account.email, displayName: account.display_name,
        role: account.role, emailVerified: account.email_verified, memberSince: account.created_at,
      },
      completed, inProgress, billing, stats, recommendations,
    });
  } catch (e) { next(e); }
});
