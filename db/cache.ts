import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { eventCache } from "./schema";

const memoryCache = new Map<string, { data: string; expiresAt: number }>();

export async function getCachedData<T>(key: string): Promise<T | null> {
  const now = Date.now();

  // Try in-memory cache first
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    try {
      return JSON.parse(mem.data) as T;
    } catch {
      memoryCache.delete(key);
    }
  }

  // Try D1 cache if available
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(eventCache)
      .where(eq(eventCache.key, key))
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0];
      if (row.expiresAt > now) {
        // Sync to memory cache
        memoryCache.set(key, { data: row.data, expiresAt: row.expiresAt });
        return JSON.parse(row.data) as T;
      }
    }
  } catch {
    // D1 unavailable or uninitialized; gracefully proceed with memory cache / fresh fetch
  }

  return null;
}

export async function setCachedData<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  const serialized = JSON.stringify(data);

  // Store in memory cache
  memoryCache.set(key, { data: serialized, expiresAt });

  // Store in D1 cache if available
  try {
    const db = getDb();
    await db
      .insert(eventCache)
      .values({
        key,
        data: serialized,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: eventCache.key,
        set: {
          data: serialized,
          expiresAt,
        },
      });
  } catch {
    // D1 unavailable; memory cache is already set
  }
}
