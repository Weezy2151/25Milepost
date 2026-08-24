import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCachedEntry, setCachedData, acquireCacheLock } from "../db/cache.ts";
import { parseEventsPayload, parseStoredIds, parseStoredPlan, parseWeatherPayload } from "../lib/client-data.ts";
import { parseIcalOccurrences } from "../lib/ical.ts";
import { assertSafePublicUrl } from "../lib/safe-fetch.ts";
import { parseErieParks, parseGrowthZone, parseStepOutBuffalo } from "../lib/scrape.ts";

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("iCalendar parsing converts UTC, expands recurrence, and honors exclusions", async () => {
  const events = parseIcalOccurrences(await fixture("sample.ics"), "2026-08-23", "2026-09-10");
  const utc = events.find((event) => event.uid === "utc-event");
  assert.equal(utc?.dateKey, "2026-08-23");
  assert.equal(utc?.time, "9 PM");
  const recurring = events.filter((event) => event.uid === "weekly-event");
  assert.deepEqual(recurring.map((event) => event.dateKey), ["2026-08-24", "2026-09-07"]);
  assert.equal(recurring[0].description, "Games, crafts; and music");
});

test("scraped-source fixtures retain their normalized event fields", async () => {
  const stepout = parseStepOutBuffalo(await fixture("stepout.html"), "2026-08-23");
  assert.equal(stepout[0]?.title, "Family Trivia Night");
  assert.equal(stepout[0]?.time, "7 PM–9 PM");
  const growthzone = parseGrowthZone(await fixture("growthzone.html"));
  assert.equal(growthzone[0]?.start, "2026-08-29");
  assert.equal(growthzone[0]?.description, "A family-friendly village art walk.");
  const parks = parseErieParks(await fixture("erie-parks.html"));
  assert.equal(parks[0]?.venue, "Chestnut Ridge Park");
  assert.equal(parks[0]?.time, "6 PM–7:30 PM");
});

test("stored itineraries migrate to the compact v2 contract", () => {
  const legacy = JSON.stringify([{ id: "event-1", title: "Family Night", venue: "Old venue", cost: "Old price" }]);
  assert.deepEqual(parseStoredPlan(legacy), [{ id: "event-1", title: "Family Night" }]);
  assert.deepEqual(parseStoredPlan('{"version":2,"items":[{"id":"event-2","title":"Market"}]}'), [{ id: "event-2", title: "Market" }]);
  assert.deepEqual(parseStoredPlan("not json"), []);
});

test("lightweight browser guards accept API data and reject unsafe payloads", () => {
  const event = {
    id: "event-1", area: "southtowns", town: "Orchard Park", day: "TODAY", date: "Sun, Aug 23",
    dateKey: "2026-08-23", time: "10 AM", title: "Family Day", venue: "Town Hall", distance: 1,
    description: "A family-friendly community day.", cost: "Free", source: "Town calendar",
    url: "https://everythingop.com/events/family-day", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park",
    tags: ["Family"], accent: "mint", image: "https://images.everythingop.com/family-day.jpg", today: true,
    kind: "Community", setting: "both", priority: 5, lat: 42.767, lon: -78.744, distancePrecision: "venue",
  };
  const payload = {
    events: [event], count: 1, updatedAt: "2026-08-23T12:00:00.000Z",
    window: { from: "2026-08-23", to: "2026-08-30" },
    sources: [{ name: "Town calendar", ok: true, count: 1, durationMs: 20 }],
    mix: { Community: 1 },
    freshness: { state: "fresh", ageSeconds: 0, builtFor: "2026-08-23", store: "memory" },
  };
  assert.equal(parseEventsPayload(payload)?.events[0]?.id, "event-1");
  assert.equal(parseEventsPayload({ ...payload, events: [{ ...event, image: "https://attacker.example/image.jpg" }] }), null);
  assert.deepEqual(parseStoredIds('["a","a","b"]'), ["a", "b"]);

  const weather = {
    label: "Clear", now: 72, high: 77, rain: 10, updatedAt: "2026-08-23T12:00:00.000Z",
    days: [{ dateKey: "2026-08-23", label: "Clear", high: 77, low: 60, rain: 10, code: 0 }],
  };
  assert.equal(parseWeatherPayload(weather)?.days.length, 1);
  assert.equal(parseWeatherPayload({ ...weather, rain: 101 }), null);
});

test("outbound URL guard blocks private targets and unexpected hosts", () => {
  assert.throws(() => assertSafePublicUrl("http://example.com"));
  assert.throws(() => assertSafePublicUrl("https://127.0.0.1/private"));
  assert.throws(() => assertSafePublicUrl("https://example.net", ["example.com"]));
  assert.equal(assertSafePublicUrl("https://images.example.com/a.jpg", ["example.com"]).hostname, "images.example.com");
});

test("memory cache reports freshness and collapses lock acquisition", async () => {
  const key = `test:${process.pid}:${Date.now()}`;
  await setCachedData(key, { value: 1 }, 30, 0);
  assert.deepEqual((await getCachedEntry(key))?.data, { value: 1 });
  assert.equal(await acquireCacheLock(`${key}:lock`, 30), true);
  assert.equal(await acquireCacheLock(`${key}:lock`, 30), false);
});
