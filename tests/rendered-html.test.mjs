import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

const PORT = 4173 + (process.pid % 1000);

/**
 * Boots the production Next.js server (`next start`, against the build
 * produced by `npm run build`) on a scratch port, fetches "/", and returns
 * the rendered HTML. Assumes `next build` has already been run — CI/local
 * runs should do `npm run build && npm test`.
 */
async function withServer(run) {
  const child = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT) },
  });

  let ready = false;
  const readyPromise = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      const text = chunk.toString();
      if (/Ready in|started server/i.test(text)) {
        ready = true;
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      if (!ready) reject(new Error(`next start exited early (code ${code})`));
    });
  });

  await Promise.race([
    readyPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("next start timed out")), 30_000)),
  ]);

  try {
    return await run(`http://localhost:${PORT}`);
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
}

test("server-renders the dynamic events finder with a last-known snapshot", async () => {
  const html = await withServer(async (base) => {
    const response = await fetch(base, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    return response.text();
  });

  assert.match(html, /The 25-Mile Post/);
  assert.match(html, /Cruise Night at the Depot/);
  assert.doesNotMatch(html, /Fossil Frenzy Play Cafe/);
  assert.match(html, /Erie County Fair/);
  assert.doesNotMatch(html, /Au-Some Morning Edition/);
  assert.match(html, /Pick a day this week/);
  assert.match(html, /Town of Orchard Park/);
  assert.match(html, /Village of Hamburg/);
  assert.match(html, /Orchard Park Bee/);
  assert.match(html, /Hamburg Sun/);

  // The greeting and any stored itinerary resolve after mount, so the server
  // markup must stay time- and storage-independent.
  assert.match(html, /Hello, Orchard Park\./);
  assert.doesNotMatch(html, /Good (morning|afternoon|evening), Orchard Park/);

  // Server-side, "today" defaults to whichever day the snapshot flags — that's
  // the erie fair, cruise night, concert and East Aurora market (4 of the 8
  // fallback events); the rest live on other day tabs until picked.
  assert.equal((html.match(/<article class="card /g) ?? []).length, 4);
  assert.match(html, /East Aurora Farmers Market/);
});

test("keeps live refresh, interactions and source adapters intact", async () => {
  const [page, data, api, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  // Distances come from real coordinates, not a per-town constant.
  assert.match(api, /distanceFromOrigin/);
  assert.doesNotMatch(api, /function inferDistance/);
  assert.match(page, /distancePrecision/);

  // Each event's own date drives its forecast chip.
  assert.match(page, /forecast_days=8/);
  assert.match(page, /function forecastFor/);

  // Feed text is cleaned and image-less events get an Open Graph picture.
  assert.match(api, /resolveImages/);
  assert.match(api, /describe\(/);

  // Drawers trap focus and hand it back; the page is keyboard reachable.
  assert.match(page, /function useModal/);
  assert.match(page, /skip-link/);
  assert.match(page, /aria-live="polite"/);

  // Stale snapshots are labelled rather than passed off as today's listings.
  assert.match(page, /SNAPSHOT_DATE/);
  assert.match(page, /Live calendars are unreachable/);
  assert.match(layout, /ErrorBoundary/);

  assert.match(page, /twenty-five-mile-post-clippings/);
  assert.match(page, /api\.open-meteo\.com/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /fetch\("\/api\/events\?edition=balanced-v3"/);
  assert.doesNotMatch(page, /setInterval/);
  assert.match(page, /refreshed each morning/);
  assert.match(page, /Museums & culture/);
  assert.match(page, /setSelectedDay/);
  assert.match(page, /setQuery/);
  assert.match(page, /setShowSaved/);
  assert.match(page, /Drive time/);
  assert.match(data, /Destination Dinosaur/);

  // Saved events, the My Day itinerary and the theme all persist per device.
  assert.match(page, /twenty-five-mile-post-myday/);
  assert.match(page, /twenty-five-mile-post-theme/);
  assert.match(api, /buffalolib\.libcal\.com\/rss\.php/);
  assert.match(api, /orchardparkny\.gov\/events/);
  assert.match(api, /townofevansny\.gov\/events/);
  assert.match(api, /capLibraries/);
  assert.match(api, /s-maxage=86400/);
  assert.match(api, /West Seneca Farmers Market/);
  assert.match(api, /stale-while-revalidate/);
  assert.match(page, /daypicker/);

  // Weather follows the day the picker is on, not always today.
  assert.match(page, /const dayForecast = useMemo/);
  assert.match(page, /activeDay/);
  assert.doesNotMatch(page, /weather !== null && weather\.rain >= 40/);
  assert.match(page, /daypicker-sky/);

  // Erie County Parks and the home-town chamber are live sources, not manual.
  assert.match(api, /www3\.erie\.gov\/parks\/events/);
  assert.match(api, /orchardparkchamber\.org/);
  assert.match(api, /parseErieParks/);
  assert.doesNotMatch(page, /\["Erie County Parks", "https:\/\/www3\.erie\.gov\/parks\/calendar"\]/);

  // Freshness is reported rather than assumed.
  assert.match(api, /"last-good"/);
  assert.match(api, /LAST_GOOD_KEY/);
  assert.match(api, /after\(async \(\) =>/);
  assert.match(page, /Every calendar failed to answer this morning/);
  assert.match(layout, /The 25-Mile Post \| Family Things To Do Near Orchard Park/);
  assert.match(layout, /images: \[\{ url: imageUrl/);
});

test("caches through a shared store when one is configured", async () => {
  const cache = await readFile(new URL("../db/cache.ts", import.meta.url), "utf8");

  // Same two entry points as before, so the API route needed no rewiring.
  assert.match(cache, /export async function getCachedData/);
  assert.match(cache, /export async function setCachedData/);

  // Vercel KV and Upstash both work, and neither is required.
  assert.match(cache, /KV_REST_API_URL/);
  assert.match(cache, /UPSTASH_REDIS_REST_URL/);
  assert.match(cache, /memoryBackend/);

  // Entries know their own freshness, which is what makes serving a stale
  // payload while rebuilding possible.
  assert.match(cache, /freshUntil/);
  assert.match(cache, /export async function getCachedEntry/);
});

test("schedules a Vercel Cron warm-up of the events cache", async () => {
  const vercelJson = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(vercelJson.crons) && vercelJson.crons.length > 0, "vercel.json must declare crons");
  assert.ok(vercelJson.crons.every((cron) => cron.path === "/api/events"), "crons should warm the events route");
});
