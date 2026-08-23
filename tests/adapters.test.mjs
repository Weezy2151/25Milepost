import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCachedEntry, setCachedData, acquireCacheLock } from "../db/cache.ts";
import { parseStoredPlan } from "../lib/events.ts";
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
