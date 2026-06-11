import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { BadRequest, NotFound } from '../lib/errors.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
export const payments = Router();

// Ensure the user has a Stripe customer record (created lazily on first checkout).
async function ensureCustomer(user) {
  const { rows } = await query('SELECT email, display_name, stripe_customer_id FROM users WHERE id=$1', [user.id]);
  const u = rows[0];
  if (u.stripe_customer_id) return u.stripe_customer_id;
  const customer = await stripe.customers.create({ email: u.email, name: u.display_name, metadata: { user_id: user.id } });
  await query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [customer.id, user.id]);
  return customer.id;
}

// POST /api/payments/checkout  { courseSlug }
// Creates a Stripe Checkout Session. Access is NOT granted here — only by the webhook.
payments.post('/checkout',
  requireAuth,
  validate(z.object({ courseSlug: z.string() })),
  async (req, res, next) => {
    try {
      if (!stripe) throw BadRequest('Payments not configured');
      const { rows } = await query(
        'SELECT id, title, price_cents, currency, is_free, stripe_price_id FROM courses WHERE slug=$1 AND published',
        [req.data.courseSlug]);
      const course = rows[0];
      if (!course) throw NotFound('Course not found');
      if (course.is_free || course.price_cents === 0) throw BadRequest('Course is free — no payment needed');

      const already = await query('SELECT 1 FROM entitlements WHERE user_id=$1 AND course_id=$2', [req.user.id, course.id]);
      if (already.rowCount) throw BadRequest('You already own this course');

      const customer = await ensureCustomer(req.user);
      const lineItem = course.stripe_price_id
        ? { price: course.stripe_price_id, quantity: 1 }
        : { price_data: { currency: course.currency, unit_amount: course.price_cents,
              product_data: { name: `SecRange — ${course.title}` } }, quantity: 1 };

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer,
        line_items: [lineItem],
        // metadata is echoed back on the webhook → we trust the webhook, not the client
        metadata: { user_id: req.user.id, course_id: course.id },
        success_url: config.stripe.successUrl,
        cancel_url: config.stripe.cancelUrl,
        allow_promotion_codes: true,
      });
      res.json({ url: session.url });
    } catch (e) { next(e); }
  });

// GET /api/payments/portal — Stripe Billing portal (manage receipts/payment methods)
payments.get('/portal', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) throw BadRequest('Payments not configured');
    const customer = await ensureCustomer(req.user);
    const portal = await stripe.billingPortal.sessions.create({ customer, return_url: config.webOrigin + '/dashboard' });
    res.json({ url: portal.url });
  } catch (e) { next(e); }
});
