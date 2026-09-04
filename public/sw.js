/*
 * Offline support for The 25-Mile Post.
 *
 * The guide is read on a phone, often on the move, and the Southtowns have
 * plenty of places with no signal. Losing the connection should leave the last
 * listings readable rather than showing a browser error page.
 *
 * Nothing here invents freshness: the events payload is only ever served from
 * the cache when the network fails, and the page already says plainly how old
 * its data is.
 */

const VERSION = "v1";
const SHELL = `25milepost-shell-${VERSION}`;
const DATA = `25milepost-data-${VERSION}`;
const ASSETS = `25milepost-assets-${VERSION}`;
const KEEP = [SHELL, DATA, ASSETS];

self.addEventListener("install", () => {
  // Take over as soon as this version is ready rather than waiting for every
  // tab to close; the caches are versioned, so there is nothing to clash with.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Network first, falling back to whatever was last stored. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/** Cache first, for things that never change under the same URL. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Calendar downloads must always be current; never serve one from a cache.
  if (url.pathname.startsWith("/api/calendar")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL).catch(async () => {
        const cache = await caches.open(SHELL);
        return (await cache.match("/")) ?? Response.error();
      }),
    );
    return;
  }

  if (url.pathname === "/api/events" || url.pathname === "/api/weather") {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  // Next's build output is content-hashed, so it is safe to keep.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/events/") || url.pathname.endsWith(".png")) {
    event.respondWith(cacheFirst(request, ASSETS));
  }
});
