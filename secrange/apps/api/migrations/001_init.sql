-- ============================================================
-- SecRange initial schema
-- PostgreSQL 15+. Designed for clean indexes and integrity.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- ---------- Users & auth ----------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'learner'
                    CHECK (role IN ('learner','instructor','admin')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rotating refresh tokens: we store a HASH, never the raw token.
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  family_id   UUID NOT NULL,                 -- reuse-detection family
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user      ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_hash      ON refresh_tokens(token_hash);

-- ---------- Catalog ----------
CREATE TABLE courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,         -- 'sc-200'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,                -- 'Microsoft · Security Operations Analyst'
  category      TEXT NOT NULL,                -- 'blue','cloud','red',...
  tier          TEXT NOT NULL CHECK (tier IN ('entry','mid','adv')),
  summary       TEXT NOT NULL,
  cost_label    TEXT,                         -- exam cost reference
  est_time      TEXT,
  is_free       BOOLEAN NOT NULL DEFAULT FALSE,
  price_cents   INTEGER NOT NULL DEFAULT 0,   -- our price for premium access
  currency      TEXT NOT NULL DEFAULT 'usd',
  stripe_price_id TEXT,                        -- Stripe Price for checkout
  published     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_category ON courses(category) WHERE published;

CREATE TABLE modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  points      JSONB NOT NULL DEFAULT '[]',     -- concept bullets
  lab_mode    TEXT,                            -- 'siem','packet','incident',...
  lab_label   TEXT,
  UNIQUE (course_id, position)
);
CREATE INDEX idx_modules_course ON modules(course_id);

-- ---------- Entitlements (who can access what) ----------
-- Source of truth for paid access. Written ONLY by the payments/webhook layer.
CREATE TABLE entitlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN ('purchase','grant','free')),
  stripe_payment_intent TEXT,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX idx_entitlements_user ON entitlements(user_id);

-- ---------- Progress ----------
CREATE TABLE enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE module_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  UNIQUE (user_id, module_id)
);
CREATE INDEX idx_progress_user ON module_progress(user_id);

-- Aggregate XP / gamification (mirrors the simulator)
CREATE TABLE learner_stats (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp          INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  best_streak INTEGER NOT NULL DEFAULT 0,
  labs_done   INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Idempotency for webhooks ----------
CREATE TABLE processed_events (
  id          TEXT PRIMARY KEY,               -- Stripe event id
  type        TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER t_users_touch   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER t_courses_touch BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
