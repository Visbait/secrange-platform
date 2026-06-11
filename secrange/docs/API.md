# API Reference (v1)

Base path: `/api`

## Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `{email,password,displayName?}` | Sets refresh cookie, returns `accessToken` |
| POST | `/auth/login` | `{email,password}` | Returns `accessToken` |
| POST | `/auth/refresh` | — (cookie) | Rotates refresh token, returns new `accessToken` |
| POST | `/auth/logout` | — | Revokes refresh token |
| GET  | `/auth/me` | — (Bearer) | Current user |

## Catalog
| Method | Path | Notes |
|--------|------|-------|
| GET | `/courses?category=&q=` | Public catalog |
| GET | `/courses/:slug` | Course + modules; module bodies gated by access |

## Learner
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET  | `/me/dashboard` | — | Enrollments + progress % + stats |
| POST | `/me/progress` | `{moduleId,completed}` | Authorized per course |
| POST | `/me/stats` | `{xpDelta,streak?,labDone?}` | Synced from simulator |

## Payments
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/payments/checkout` | `{courseSlug}` | Returns Stripe Checkout `url` |
| GET  | `/payments/portal` | — | Stripe billing portal `url` |
| POST | `/webhooks/stripe` | raw | Signature-verified; grants entitlements |

## Health
`GET /healthz` (liveness) · `GET /readyz` (DB readiness)

### Error shape
```json
{ "error": { "code": "unauthorized", "message": "Invalid or expired token" } }
```
