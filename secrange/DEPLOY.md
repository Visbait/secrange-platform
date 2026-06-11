# SecRange — Production Deploy Checklist (Free Tier)

**Stack:** Supabase (Postgres, free forever) + Render (API + frontend, free tier)
**Time:** ~45 min total. One phase per sitting is fine.

---

## Phase 1 — Database (Supabase) — ✅ ALREADY DONE (June 11, 2026)

Claude created this via your Supabase connector:
- Project: **secrange** (ref: `iqucohpllwnxorsdehba`) · org: Visbait · region: us-east-1 · **$0/month**
- Schema applied as migration `001_init_secrange_schema` (all 8 tables + indexes + triggers)
- Catalog seeded: Security+ (6 modules), CySA+ (5), SC-200 (5), ISC2 CC (2)

Only 2 manual steps remain (Supabase never exposes the DB password to integrations — good security):
- [ ] supabase.com/dashboard → project `secrange` → Settings → Database → **Reset database password** → save it in a password manager
- [ ] Click **Connect** (top bar) → copy the **Session pooler** URI (port 5432) → swap in your new password. This becomes `DATABASE_URL` in Phase 2.

✅ Done when: you have the full postgres:// URI saved.

---

## Phase 2 — API on Render ~15 min

- [ ] Push this `secrange/` folder to a GitHub repo
- [ ] render.com → New → Web Service → connect the repo
- [ ] Root directory: `apps/api` · Runtime: Node · Build: `npm install` · Start: `npm start`
- [ ] Add Environment Variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | (Supabase URI from Phase 1) |
| `JWT_ACCESS_SECRET` | run: `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | run: `openssl rand -base64 48` (different one) |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `WEB_ORIGIN` | (your frontend URL — fill in after Phase 3) |
| `COOKIE_DOMAIN` | (your API's render domain, e.g. `secrange-api.onrender.com`) |

- [ ] After first deploy, open Render **Shell** tab → run `npm run seed` (loads the 4 courses)
- [ ] Test: `https://YOUR-API.onrender.com/healthz` → should return `{"ok":true}`

✅ Done when: /healthz returns ok.

---

## Phase 3 — Frontend on Render ~10 min

- [ ] render.com → New → Static Site → same repo
- [ ] Root directory: `apps/web` · Build: `npm install && npm run build` · Publish dir: `dist`
- [ ] Environment variable: `VITE_API_URL` = `https://YOUR-API.onrender.com/api`
- [ ] Deploy → copy your new site URL
- [ ] Go back to the API service → set `WEB_ORIGIN` to that URL → redeploy API

✅ Done when: you can open the site, hit **Start free**, register, and land on your Dashboard.

---

## Phase 4 — Verify like an analyst ~5 min

- [ ] Register a test account → check Supabase `users` table: password is an `$argon2id$...` hash, never plaintext
- [ ] Wrong password → generic "Invalid email or password" (no user enumeration)
- [ ] DevTools → Application → Cookies: `rt` cookie is HttpOnly + Secure
- [ ] Hammer the login 50+ times → rate limiter kicks in (429)

---

## Known limits on free tier (honest notes)

- Render free API **sleeps after 15 min idle** → first request takes ~30s to wake. Fine for a portfolio; upgrade ($7/mo) removes it.
- Stripe payments are stubbed with test keys — leave `STRIPE_SECRET_KEY` blank or test-mode unless you actually sell courses.
- Email verification is schema-ready (`email_verified` column) but no mailer is wired yet — future phase.

## What was verified before shipping (June 11, 2026)

- Migrations + seed run clean on Postgres 16
- Register → login → JWT → /api/me/profile full lifecycle tested live
- Wrong password rejected, unauthenticated requests blocked
- Passwords stored as Argon2id hashes (checked the actual DB rows)
- Refresh-token rotation with reuse detection (token families)
- Helmet security headers + per-route rate limiting active
- React frontend compiles to production build (183 KB JS)
