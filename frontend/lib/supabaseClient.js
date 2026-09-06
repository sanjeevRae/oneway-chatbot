import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Backend API base URL (Render)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
// Optional second backend tried when the primary is unreachable (e.g. Render
// asleep/down). Set NEXT_PUBLIC_API_FALLBACK_URL=http://localhost:5000 to work
// against your local backend while the deployed one is down.
export const API_FALLBACK_URL = process.env.NEXT_PUBLIC_API_FALLBACK_URL || '';

// Time-to-first-response cap (ms) for the primary attempt when a fallback
// exists. Prevents a hung/dead backend (e.g. Render black-holing requests
// while down) from stalling the UI forever. 0 disables the cap.
const API_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '20000', 10);

/**
 * Fetch that automatically falls back to API_FALLBACK_URL when the primary
 * API is unreachable — either a network failure (backend down, CORS block),
 * a timeout, or a gateway error (502/503/504 from a sleeping Render instance).
 * Returns the raw Response so callers can handle JSON, files, etc.
 */
export async function fetchApi(path, options = {}) {
  const targets = API_FALLBACK_URL && API_FALLBACK_URL !== API_URL ? [API_URL, API_FALLBACK_URL] : [API_URL];
  let lastRes = null;
  let lastErr = null;
  for (let i = 0; i < targets.length; i++) {
    const base = targets[i];
    const isLast = i === targets.length - 1;
    // Only cap non-final attempts; the final target gets no timeout so
    // legitimately slow endpoints (LLM chat replies) still complete.
    const signal = !isLast && API_TIMEOUT_MS > 0 ? AbortSignal.timeout(API_TIMEOUT_MS) : options.signal;
    try {
      const res = await fetch(`${base}${path}`, signal ? { ...options, signal } : options);
      const gatewayDown = res.status === 502 || res.status === 503 || res.status === 504;
      if (!gatewayDown || isLast) return res;
      lastRes = res; // primary gateway says the app is down — try the fallback
    } catch (e) {
      lastErr = e; // network failure or timeout — try the fallback
    }
  }
  if (lastRes) return lastRes;
  throw new Error(
    `Cannot reach API at ${targets.join(' or ')}${path} — is the backend running, and is this origin in CORS_ORIGINS?`
  );
}

/** Authenticated fetch helper — attaches Supabase JWT */
export async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetchApi(path, { ...options, headers });
  // Self-heal: a 401 means the stored session is stale/invalid — sign out
  // and send the user to login instead of leaving them on a broken page.
  if (res.status === 401 && !path.startsWith('/api/auth')) {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Your session expired. Please log in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * Validate the stored session against Supabase. Returns the session if it is
 * still valid; otherwise signs out locally (clearing stale tokens) and
 * returns null. Use this on app mount instead of trusting getSession().
 */
export async function getValidSession() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/* ---------- "Manage as client" (agency org switching) ---------- */
const MANAGING_KEY = 'OneWayChat-managing-org';

/** Set the client workspace being managed ({ id, name }) or null to stop. */
export function setManagingOrg(org) {
  try {
    if (org && org.id) sessionStorage.setItem(MANAGING_KEY, JSON.stringify(org));
    else sessionStorage.removeItem(MANAGING_KEY);
  } catch {}
  window.dispatchEvent(new Event('OneWayChat-managing-changed'));
}

/** The client workspace currently being managed, or null. */
export function getManagingOrg() {
  try { return JSON.parse(sessionStorage.getItem(MANAGING_KEY) || 'null'); } catch { return null; }
}
