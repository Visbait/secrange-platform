# Data Model

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `users` | Accounts | `email` (unique, citext), `password_hash` (argon2id), `role`, `stripe_customer_id` |
| `refresh_tokens` | Rotating refresh sessions | `token_hash` (sha256, never raw), `family_id`, `revoked_at`, `expires_at` |
| `courses` | Catalog | `slug`, `tier`, `is_free`, `price_cents`, `stripe_price_id` |
| `modules` | Course modules | `course_id`, `position`, `points` (jsonb), `lab_mode` |
| `entitlements` | **Access source of truth** | `(user_id, course_id)` unique, `source`, `stripe_payment_intent` |
| `enrollments` | Enrollment record | `(user_id, course_id)` unique |
| `module_progress` | Per-module completion | `(user_id, module_id)` unique, `completed` |
| `learner_stats` | Gamification | `xp`, `level`, `best_streak`, `labs_done` |
| `processed_events` | Webhook idempotency | Stripe `event.id` PK |

### Integrity rules
- A learner can hold at most one entitlement and one enrollment per course
  (unique constraints).
- Progress writes are authorized: the API checks the learner owns the course (or
  it's free) before recording completion.
- Entitlement inserts happen only inside the webhook transaction.
