import assert from "node:assert/strict";
import test from "node:test";

import { setCachedData } from "../db/cache.ts";
import { cacheKeyFor, readCachedEventsPayload } from "../lib/events-cache.ts";

const DAY = "2026-09-04";

const payload = (overrides = {}) => ({
  events: [
    {
      id: "market-2026-09-04",
      area: "southtowns",
      town: "Hamburg",
      day: "TODAY",
      date: "Fri, Sep 4",
      dateKey: DAY,
      time: "7:30 AM–1 PM",
      title: "Hamburg Farmers Market",
      venue: "45 Church St",
      distance: 7,
      description: "Local growers.",
      cost: "Free entry",
      source: "Erie Grown",
      url: "https://example.test/market",
      mapUrl: "https://example.test/map",
      tags: ["Market"],
      accent: "mint",
      kind: "Markets & food",
      setting: "outdoor",
      priority: 5,
      lat: 42.7,
      lon: -78.8,
      distancePrecision: "venue",
      startMinutes: 450,
      endMinutes: 780,
    },
  ],
  count: 1,
  updatedAt: "2026-09-04T10:00:00.000Z",
  window: { from: DAY, to: "2026-09-11" },
  sources: [{ name: "Erie Grown", ok: true, count: 1 }],
  mix: { "Markets & food": 1 },
  freshness: { state: "fresh", ageSeconds: 0, builtFor: DAY, store: "memory" },
  ...overrides,
});

test("a cold cache yields nothing, so the page falls back to its loading state", async () => {
  assert.equal(await readCachedEventsPayload("1999-01-01"), null);
});

test("a warm cache is what the server render hands to the page", async () => {
  await setCachedData(cacheKeyFor(DAY), payload(), 7200, 21600);
  const read = await readCachedEventsPayload(DAY);
  assert.equal(read?.events.length, 1);
  assert.equal(read.events[0].title, "Hamburg Farmers Market");
  assert.equal(read.freshness.state, "fresh");
});

test("a payload that no longer matches the contract is refused, not rendered", async () => {
  const key = cacheKeyFor("2026-09-09");
  // An older deploy's shape, missing the fields the page now relies on.
  await setCachedData(key, { events: [{ title: "Legacy" }], count: 1 }, 7200, 21600);
  assert.equal(await readCachedEventsPayload("2026-09-09"), null);
});

test("an empty payload is treated as nothing to render", async () => {
  const key = "2026-09-10";
  await setCachedData(cacheKeyFor(key), payload({ events: [], count: 0 }), 7200, 21600);
  assert.equal(await readCachedEventsPayload(key), null);
});
