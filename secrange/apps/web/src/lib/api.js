// Lightweight API client. Access token lives in memory (not localStorage, to
// reduce XSS token theft). Refresh token is an httpOnly cookie the browser sends
// automatically. On 401 we transparently refresh once and retry.
const BASE = import.meta.env.VITE_API_BASE || '/api';
let accessToken = null;
let refreshing = null;

export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

async function refresh() {
  refreshing = refreshing || fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (!r.ok) throw new Error('refresh failed');
      const data = await r.json();
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    try { await refresh(); return api(path, { method, body, retry: false }); }
    catch { /* fall through to throw below */ }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || 'Request failed'), { status: res.status, data });
  return data;
}

// Try to restore a session on app load (refresh cookie may still be valid).
export async function bootstrapSession() {
  try { await refresh(); return await api('/auth/me'); }
  catch { return null; }
}
