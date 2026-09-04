/**
 * Reading the cached events payload.
 *
 * These helpers were part of the API route, which was fine while the route was
 * the only reader. The page now server-renders the same listings, and a page
 * may not import a route module, so the shared parts live here.
 *
 * Everything in this file is read-only. Building the payload — fetching a
 * dozen live calendars, geocoding, enriching — stays in the route, because a
 * page render must never be the thing that pays for it.
 */

import { getCachedEntry, cacheBackendName } from "../db/cache.ts";
import { eventsPayloadSchema, type EventsPayload } from "./events.ts";

export function cacheKeyFor(todayKey: string) {
  return `events:balanced-v11:${todayKey}`;
}

/**
 * Date-independent key for the newest payload that ever built successfully.
 *
 * The per-day key expires with its day, so the first reader on a morning when
 * every feed is down used to fall all the way through to the bundled snapshot
 * — a hardcoded copy from months ago. Yesterday's real listings are wrong
 * about which day it is; the snapshot is wrong about everything.
 */
export const LAST_GOOD_KEY = "events:balanced-v11:last-good";

export function validPayload(value: unknown): EventsPayload | null {
  const parsed = eventsPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function withFreshness(
  payload: EventsPayload,
  state: EventsPayload["freshness"]["state"],
  ageSeconds: number,
): EventsPayload {
  return { ...payload, freshness: { ...payload.freshness, state, ageSeconds, store: cacheBackendName() } };
}

export function cachedFreshness(payload: EventsPayload, stale: boolean): EventsPayload["freshness"]["state"] {
  if (payload.freshness.state === "last-good") return "last-good";
  return stale ? "stale" : payload.freshness.state;
}

/**
 * Whatever the cache already holds for a day, or null.
 *
 * Deliberately does not build, revalidate or schedule anything: this is what
 * the server render reads, and it must be cheap and side-effect free. When it
 * returns null the page falls back to the loading state it has always shown
 * and the client fetches `/api/events`, which does the full tiered build.
 */
export async function readCachedEventsPayload(todayKey: string): Promise<EventsPayload | null> {
  try {
    const cached = await getCachedEntry<EventsPayload>(cacheKeyFor(todayKey));
    const payload = validPayload(cached?.data);
    if (!cached || !payload?.events.length) return null;
    return withFreshness(payload, cachedFreshness(payload, cached.stale), cached.ageSeconds);
  } catch (error) {
    // A cache that cannot be read is not a reason to fail the page.
    console.error("[events] cached read for server render failed", error);
    return null;
  }
}
