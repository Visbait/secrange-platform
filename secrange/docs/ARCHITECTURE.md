# SecRange — System Architecture

## Overview
SecRange is a learning platform. Learners create accounts, browse a course
catalog, purchase premium courses, and work through lab-based modules. The
labs are the SecOps Simulator (a static client app) launched from the course
player. Progress and entitlements live in our backend.

## Components
```
                         ┌──────────────────────────────┐
   Browser (SPA) ───────▶│  CDN / Static host (web/dist) │
        │                └──────────────────────────────┘
        │  /api/* (JWT in Authorization header, refresh cookie httpOnly)
        ▼
┌──────────────────┐     ┌───────────────────────────┐     ┌───────────────┐
│  Load Balancer   │────▶│  API (Express, stateless)  │────▶│  PostgreSQL    │
│  (TLS terminate) │     │  N replicas behind LB      │     │  (primary +    │
└──────────────────┘     │                            │     │   read replica)│
        ▲                └───────────┬───────────────┘     └───────────────┘
        │                            │
        │                            ├──▶ Redis (rate-limit, sessions cache) [scale phase]
        │                            └──▶ Stripe (Checkout + Billing)
        │
   Stripe ──webhook──▶ /api/webhooks/stripe  (raw body, signature-verified)
```

## Request/auth flow
1. **Register/Login** → API returns a short-lived **access JWT** (15 min) and sets
   an **httpOnly refresh cookie** (30 days). Access token is held in memory on the
   client (not localStorage) to limit XSS token theft.
2. Protected API calls send `Authorization: Bearer <access>`.
3. On `401`, the client calls `/auth/refresh` once (cookie sent automatically),
   gets a new access token, and retries. Refresh tokens **rotate** on every use;
   presenting a revoked token triggers **reuse detection** and revokes the whole
   token family.

## Payments & entitlements (tamper-proof by design)
- The client calls `/payments/checkout` → API creates a **Stripe Checkout Session**
  with `user_id` + `course_id` in metadata and returns the hosted URL.
- The client **cannot** grant itself access. Access (`entitlements` row) is written
  **only** by `/webhooks/stripe` after Stripe-signature verification, on a
  `checkout.session.completed` event. Webhooks are **idempotent** (processed event
  ids are recorded) so Stripe retries can't double-grant.

## Data model
See `DATA_MODEL.md`. Key tables: `users`, `refresh_tokens`, `courses`, `modules`,
`entitlements` (access), `enrollments`, `module_progress`, `learner_stats`,
`processed_events` (webhook idempotency).

## Why these choices
- **Stateless API** → trivially horizontally scalable behind a load balancer.
- **Postgres** → relational integrity for entitlements/progress; the read-heavy
  catalog scales with read replicas + caching.
- **Server-verified entitlements** → revenue cannot be bypassed client-side.
