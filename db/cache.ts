/**
 * Simple per-instance in-memory cache for the events API.
 *
 * The original template optionally backed this with Cloudflare D1. On Vercel
 * there is no equivalent bound database by default, so this keeps the same
 * memory-first behavior the app already had (D1 was never configured here —
 * `.openai/hosting.json` had `d1: null` — so this is a no-op change in
 * practice) without pulling in any Cloudflare-only APIs.
 *
 * Note: serverless function instances are not guaranteed to stay warm between
 * requests, so this cache is a best-effort speedup, not a durable store. If
 * you want warm caching across cold starts on Vercel, swap this for Vercel KV
 * / Upstash Redis, or rely on the `revalidate` option on `fetch` calls.
 */

const memoryCache = new Map<string, { data: string; expiresAt: number }>();

export async function getCachedData<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }

  try {
    return JSON.parse(entry.data) as T;
  } catch {
    memoryCache.delete(key);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  memoryCache.set(key, {
    data: JSON.stringify(data),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
