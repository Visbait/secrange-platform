// Centralized, validated config. Fail fast on missing critical secrets.
import 'node:process';
const req = (k, d) => {
  const v = process.env[k] ?? d;
  if (v === undefined) { console.error(`Missing env: ${k}`); process.exit(1); }
  return v;
};
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: req('DATABASE_URL', 'postgres://secrange:secrange@localhost:5432/secrange'),
  jwt: {
    accessSecret: req('JWT_ACCESS_SECRET', 'dev-access'),
    refreshSecret: req('JWT_REFRESH_SECRET', 'dev-refresh'),
    accessTtl: parseInt(process.env.ACCESS_TTL || '900', 10),
    refreshTtl: parseInt(process.env.REFRESH_TTL || '2592000', 10),
  },
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  cookie: {
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    secure: (process.env.COOKIE_SECURE || 'false') === 'true',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    successUrl: process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:5173/dashboard?checkout=success',
    cancelUrl: process.env.CHECKOUT_CANCEL_URL || 'http://localhost:5173/catalog?checkout=cancel',
  },
};
