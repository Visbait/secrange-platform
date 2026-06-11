# SecRange — Hands-on Security Certification Training Platform

An EdTech startup MVP: learners sign up, enroll in interactive cert-prep courses
(Security+, CySA+, SC-200, Elastic, BTL1, …), track progress through lab-based
modules, and pay to unlock premium courses. The interactive labs are the
SecOps Simulator engines (triage, SIEM, packet analysis, IR campaigns).

## Monorepo layout
```
secrange/
├── apps/
│   ├── api/      Node + Express + PostgreSQL REST API (auth, courses, payments)
│   └── web/      React (Vite) SPA — marketing, auth, dashboard, course player
├── infra/        Docker Compose, Dockerfiles, deployment notes (k8s/terraform)
├── docs/         Architecture, API reference, data model, scaling playbook
└── scripts/      Dev/seed helpers
```

## Quick start (local)
```bash
cp apps/api/.env.example apps/api/.env     # fill in secrets
docker compose -f infra/docker-compose.yml up --build
# API  → http://localhost:4000
# Web  → http://localhost:5173
```
See `docs/ARCHITECTURE.md` for the full system design and `docs/SCALING.md`
for the path from MVP to millions of users.

## What's production-ready here
- JWT access + refresh tokens (rotating), Argon2 password hashing
- PostgreSQL schema with migrations, indexes, and constraints
- Stripe Checkout + webhook-verified entitlements (server-side, tamper-proof)
- Rate limiting, Helmet, CORS, input validation (Zod), structured logging
- Health/readiness probes, graceful shutdown, Dockerized services
- Tests, CI workflow, and a documented scaling plan

> Security note: real payments and entitlements are verified **server-side via
> Stripe webhooks** — the client can never grant itself a paid course.
