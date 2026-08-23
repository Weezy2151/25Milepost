/**
 * Cache for the events API, with two backends and one shape.
 *
 * The events payload is expensive: a cold build fans out to a dozen live feeds
 * plus Open Graph image lookups. Three things follow from that, and this module
 * exists to provide all three:
 *
 *   1. A **shared** store where one is configured. In-memory caching only helps
 *      inside a single warm serverless instance, so on Vercel the two morning
 *      cron warm-ups mostly benefited an instance that was gone by the time a
 *      reader arrived. Set `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV)
 *      or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Upstash) and
 *      the warm-up survives cold starts and is shared across instances. With
 *      neither set, everything below still works against the memory map.
 *   2. **Stale-while-revalidate.** Entries carry their own freshness deadline
 *      and are kept for a grace period past it, so an expired entry can still
 *      be served instantly while a rebuild runs behind the response. A reader
 *      never waits on the feeds.
 *   3. **A last-good copy.** Written under a date-independent key with a long
 *      TTL, so a morning where every feed is down falls back to yesterday's
 *      real listings rather than the bundled 2026 snapshot.
 *
 * Every value is stored inside an envelope carrying `storedAt` and the
 * freshness window, so staleness is a property of the entry rather than of the
 * store — which is what lets the memory and Redis backends behave identically.
 */

export type CacheEntry<T> = {
  data: T;
  /** How long ago this entry was written. */
  ageSeconds: number;
  /** True once past its freshness deadline but still inside the grace period. */
  stale: boolean;
};

type Envelope<T> = {
  /** Epoch ms at write time. */
  storedAt: number;
  /** Epoch ms after which the entry is stale but still servable. */
  freshUntil: number;
  data: T;
};

/** Default extra lifetime past `freshUntil` that a stale entry stays servable. */
const DEFAULT_GRACE_SECONDS = 6 * 3600;

/* --------------------------------------------------------------- backends */

type Backend = {
  name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

const memoryCache = new Map<string, { value: string; expiresAt: number }>();

const memoryBackend: Backend = {
  name: "memory",
  async get(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(key, value, ttlSeconds) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
};

/**
 * Vercel KV and Upstash both speak the same REST dialect, so one client covers
 * either: `GET /get/<key>` answers `{"result": "<string>"}`, and `POST
 * /set/<key>?EX=<seconds>` takes the value as the raw request body.
 */
function redisBackend(): Backend | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const origin = url.replace(/\/+$/, "");
  const auth = { authorization: `Bearer ${token}` };

  return {
    name: "redis",
    async get(key) {
      const response = await fetch(`${origin}/get/${encodeURIComponent(key)}`, {
        headers: auth,
        signal: AbortSignal.timeout(2000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`cache GET ${response.status}`);
      const body = (await response.json()) as { result?: string | null };
      return body.result ?? null;
    },
    async set(key, value, ttlSeconds) {
      const response = await fetch(`${origin}/set/${encodeURIComponent(key)}?EX=${Math.max(1, Math.round(ttlSeconds))}`, {
        method: "POST",
        headers: { ...auth, "content-type": "text/plain" },
        body: value,
        signal: AbortSignal.timeout(2000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`cache SET ${response.status}`);
    },
  };
}

let resolved: Backend | undefined;

function backend(): Backend {
  // Resolved once per instance: the env vars cannot change under a running
  // function, and this keeps the URL parsing off the hot path.
  resolved ??= redisBackend() ?? memoryBackend;
  return resolved;
}

/** Which store is in use — surfaced by the API route so a misconfigured KV is visible. */
export function cacheBackendName() {
  return backend().name;
}

/* ------------------------------------------------------------------ reads */

/**
 * Read an entry along with its freshness, including entries past their
 * deadline but inside the grace period. Callers that can use a stale payload
 * (see the events route's stale-while-revalidate path) want this one.
 */
export async function getCachedEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  let raw: string | null;
  try {
    raw = await backend().get(key);
  } catch {
    // A cache that is down is a slow path, not an error: fall through to a
    // live rebuild rather than failing the request.
    return null;
  }
  if (!raw) return null;

  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(raw) as Envelope<T>;
  } catch {
    return null;
  }
  if (!envelope || typeof envelope.storedAt !== "number") return null;

  const now = Date.now();
  return {
    data: envelope.data,
    ageSeconds: Math.max(0, Math.round((now - envelope.storedAt) / 1000)),
    stale: now > envelope.freshUntil,
  };
}

/** Fresh entries only — the original signature, unchanged for existing callers. */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const entry = await getCachedEntry<T>(key);
  return entry && !entry.stale ? entry.data : null;
}

/* ----------------------------------------------------------------- writes */

/**
 * Store a value that reads as fresh for `ttlSeconds` and stays servable as
 * stale for `graceSeconds` beyond that.
 */
export async function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds: number,
  graceSeconds = DEFAULT_GRACE_SECONDS,
): Promise<void> {
  const now = Date.now();
  const envelope: Envelope<T> = { storedAt: now, freshUntil: now + ttlSeconds * 1000, data };
  await backend().set(key, JSON.stringify(envelope), ttlSeconds + graceSeconds);
}
