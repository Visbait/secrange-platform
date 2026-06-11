# Security Notes

| Area | Control |
|------|---------|
| Passwords | Argon2id (memory-hard), never stored in plaintext |
| Sessions | Short-lived access JWT (memory) + rotating httpOnly refresh cookie |
| Token theft | Refresh **reuse detection** revokes the entire token family |
| Transport | HTTPS everywhere in prod; `COOKIE_SECURE=true`, `SameSite=Lax` |
| Headers | Helmet (CSP-ready), CORS locked to the web origin |
| Input | Zod validation on every mutating endpoint |
| Rate limiting | Tight on `/auth`, looser on the rest of the API |
| Payments | Card data never touches our servers; entitlements granted only via signed Stripe webhooks |
| Idempotency | Stripe event ids recorded to prevent replay/double-grant |
| Least privilege | DB role scoped to the app schema; API runs as non-root in its container |

### Threats explicitly handled
- **Client-side entitlement bypass** — impossible: access is server-granted via webhook.
- **Refresh-token replay** — detected and family-revoked.
- **User enumeration on login** — login verifies against a dummy hash when the user
  is absent to even out timing.
- **XSS token exfiltration** — access token in memory, refresh token httpOnly.
