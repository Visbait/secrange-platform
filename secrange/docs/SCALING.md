# Scaling Playbook — MVP → Millions of Users

The architecture is intentionally **stateless at the API tier** so scaling is mostly
"add replicas + protect the database." Here's the staged path.

## Stage 0 — MVP (this repo)
- 1 API container, 1 Postgres, static SPA on a CDN.
- Handles thousands of users comfortably.

## Stage 1 — Horizontal API + managed data (→ ~100k users)
- Run **N stateless API replicas** behind a load balancer (ECS/Fargate, Cloud Run,
  or k8s). No sticky sessions needed — JWT access tokens are self-contained.
- **Managed Postgres** (RDS/Cloud SQL) with automated backups and a **read replica**.
  Point catalog/dashboard reads at the replica; writes go to the primary.
- **Redis** for rate-limiting (shared across replicas) and hot-catalog caching.
- Move the SPA fully to a **CDN** (CloudFront/Cloudflare); cache `/courses` responses.

## Stage 2 — Decouple & cache (→ ~1M users)
- **Cache the catalog** aggressively (Redis + CDN edge). The catalog is read-heavy
  and changes rarely — most traffic should never touch Postgres.
- **Connection pooling** with PgBouncer in front of Postgres (transaction pooling)
  so thousands of API workers share a bounded set of DB connections.
- **Async work** (welcome emails, receipts, analytics) via a queue (SQS/BullMQ) and
  workers, keeping request latency low.
- **Observability**: structured logs (already pino), metrics (Prometheus/OTel),
  tracing, and alerting on p99 latency and error rate.

## Stage 3 — Sharding & global (→ many millions)
- Postgres write scaling: partition large tables (`module_progress`, `learner_stats`)
  by `user_id`; consider Citus or logical sharding by tenant/user hash.
- **Multi-region**: read replicas per region, writes routed to the primary region;
  CDN serves the SPA globally.
- Entitlement/auth checks stay O(1) indexed lookups; progress writes are the main
  growth area and are the first to partition.

## Cost & reliability guardrails
- Stripe handles all card data — **we never store PANs** (PCI scope minimized).
- Idempotent webhooks + recorded `processed_events` prevent double-grants under retries.
- Graceful shutdown drains in-flight requests on deploy; health/readiness probes
  gate traffic during rollout.
- Rate limits protect auth and API tiers from abuse and credential stuffing.

## What to add before "production" for real
- Email verification + password reset flows (scaffolding hooks exist).
- WAF + bot protection on auth endpoints.
- Secrets in a manager (not env files); rotate JWT secrets with key IDs (kid).
- Backups tested by **restore drills** (see the DR runbook in the blue-team repo).
- SOC2-style audit logging on entitlement changes.
