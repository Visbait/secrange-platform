import { Router } from 'express';
import Stripe from 'stripe';
import { query, tx } from '../db/pool.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
export const webhooks = Router();

// POST /api/webhooks/stripe
// MUST receive the RAW body (configured in server.js) so the signature verifies.
// This endpoint is the ONLY place entitlements are granted from a purchase.
webhooks.post('/stripe', async (req, res) => {
  if (!stripe) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
  } catch (err) {
    logger.warn({ err: err.message }, 'stripe signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Idempotency: ignore events we've already processed (Stripe retries).
    const seen = await query('SELECT 1 FROM processed_events WHERE id=$1', [event.id]);
    if (seen.rowCount) return res.json({ received: true, duplicate: true });

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const userId = s.metadata?.user_id, courseId = s.metadata?.course_id;
      if (s.payment_status === 'paid' && userId && courseId) {
        await tx(async (client) => {
          await client.query(
            `INSERT INTO entitlements (user_id, course_id, source, stripe_payment_intent)
             VALUES ($1,$2,'purchase',$3)
             ON CONFLICT (user_id, course_id) DO NOTHING`,
            [userId, courseId, s.payment_intent]);
          await client.query(
            `INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2)
             ON CONFLICT (user_id, course_id) DO NOTHING`, [userId, courseId]);
          await client.query('INSERT INTO processed_events (id, type) VALUES ($1,$2)', [event.id, event.type]);
        });
        logger.info({ userId, courseId }, 'entitlement granted via purchase');
      }
    } else {
      await query('INSERT INTO processed_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type]);
    }
    res.json({ received: true });
  } catch (e) {
    logger.error({ err: e }, 'webhook processing error');
    res.status(500).end();   // let Stripe retry
  }
});
