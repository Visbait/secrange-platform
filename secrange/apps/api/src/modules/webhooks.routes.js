import { Router } from 'express';
import Stripe from 'stripe';
import { query, tx } from '../db/pool.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
export const webhooks = Router();

// POST /api/webhooks/stripe
// MUST receive the RAW body (configured in server.js) so the signature verifies.
// This endpoint is the ONLY place entitlements are granted or revoked.
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

    switch (event.type) {

      // New subscription started and first invoice paid → grant access.
      case 'checkout.session.completed': {
        const s = event.data.object;
        const userId = s.metadata?.user_id, courseId = s.metadata?.course_id;
        if (s.mode === 'subscription' && s.payment_status === 'paid' && userId && courseId) {
          await tx(async (client) => {
            await client.query(
              `INSERT INTO entitlements (user_id, course_id, source, stripe_subscription_id, status)
               VALUES ($1,$2,'subscription',$3,'active')
               ON CONFLICT (user_id, course_id) DO UPDATE
                 SET source='subscription', stripe_subscription_id=$3, status='active'`,
              [userId, courseId, s.subscription]);
            await client.query(
              `INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2)
               ON CONFLICT (user_id, course_id) DO NOTHING`, [userId, courseId]);
            await client.query('INSERT INTO processed_events (id, type) VALUES ($1,$2)', [event.id, event.type]);
          });
          logger.info({ userId, courseId }, 'subscription started — access granted');
        }
        break;
      }

      // Renewal invoice paid → keep active, extend period end.
      case 'invoice.paid': {
        const inv = event.data.object;
        const subId = inv.subscription;
        if (subId) {
          const periodEnd = inv.lines?.data?.[0]?.period?.end;
          await query(
            `UPDATE entitlements SET status='active',
               current_period_end = to_timestamp($2)
             WHERE stripe_subscription_id=$1`,
            [subId, periodEnd ?? Math.floor(Date.now()/1000) + 30*86400]);
        }
        await query('INSERT INTO processed_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type]);
        break;
      }

      // Payment failed → mark past_due (Stripe retries; access kept until cancel).
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        if (inv.subscription) {
          await query(`UPDATE entitlements SET status='past_due' WHERE stripe_subscription_id=$1`, [inv.subscription]);
          logger.warn({ sub: inv.subscription }, 'subscription payment failed — marked past_due');
        }
        await query('INSERT INTO processed_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type]);
        break;
      }

      // Subscription canceled or expired → revoke access.
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await query(`UPDATE entitlements SET status='canceled' WHERE stripe_subscription_id=$1`, [sub.id]);
        logger.info({ sub: sub.id }, 'subscription canceled — access revoked');
        await query('INSERT INTO processed_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type]);
        break;
      }

      default:
        await query('INSERT INTO processed_events (id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING', [event.id, event.type]);
    }

    res.json({ received: true });
  } catch (e) {
    logger.error({ err: e }, 'webhook processing error');
    res.status(500).end();   // let Stripe retry
  }
});
