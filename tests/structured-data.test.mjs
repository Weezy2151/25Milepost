import assert from "node:assert/strict";
import test from "node:test";

import { eventJsonLd, eventsJsonLd } from "../lib/structured-data.ts";

const SITE = "https://example.test";

const makeEvent = (overrides = {}) => ({
  id: "market-2026-09-05",
  area: "southtowns",
  town: "Hamburg",
  day: "SAT",
  date: "Sat, Sep 5",
  dateKey: "2026-09-05",
  time: "7:30 AM–1 PM",
  title: "Hamburg Farmers Market",
  venue: "45 Church St",
  distance: 7,
  description: "Local growers and producers.",
  cost: "Free entry",
  source: "Erie Grown",
  url: "https://example.test/market",
  mapUrl: "https://example.test/map",
  tags: ["Market"],
  accent: "mint",
  kind: "Markets & food",
  setting: "outdoor",
  startMinutes: 7 * 60 + 30,
  endMinutes: 13 * 60,
  ...overrides,
});

test("an event carries its real start and end as local times", () => {
  const data = eventJsonLd(makeEvent(), SITE);
  assert.equal(data["@type"], "Event");
  assert.equal(data.name, "Hamburg Farmers Market");
  assert.equal(data.startDate, "2026-09-05T07:30:00");
  assert.equal(data.endDate, "2026-09-05T13:00:00");
  assert.equal(data.location.address.addressLocality, "Hamburg");
  assert.equal(data.location.address.addressRegion, "NY");
  assert.equal(data.organizer.name, "Erie Grown");
});

test("a listing with no readable clock gets a date and no invented time", () => {
  const data = eventJsonLd(makeEvent({ time: "All day", startMinutes: null, endMinutes: null }), SITE);
  assert.equal(data.startDate, "2026-09-05");
  assert.equal(data.endDate, undefined);
});

test("an event with no stated end has a start only", () => {
  const data = eventJsonLd(makeEvent({ time: "2 PM", startMinutes: 14 * 60, endMinutes: null }), SITE);
  assert.equal(data.startDate, "2026-09-05T14:00:00");
  assert.equal(data.endDate, undefined);
});

test("only a plainly free listing is described as costing nothing", () => {
  assert.equal(eventJsonLd(makeEvent({ cost: "Free entry" }), SITE).offers.price, 0);
  // Prose prices are not numbers and must not be guessed at.
  assert.equal(eventJsonLd(makeEvent({ cost: "$22 single · $99 family pack" }), SITE).offers, undefined);
  assert.equal(eventJsonLd(makeEvent({ cost: "Free with 4+ canned goods · otherwise $19" }), SITE).offers, undefined);
});

test("coordinates are included only when the event has them", () => {
  assert.equal(eventJsonLd(makeEvent({ lat: 42.7, lon: -78.8 }), SITE).location.geo.latitude, 42.7);
  assert.equal(eventJsonLd(makeEvent({ lat: undefined, lon: undefined }), SITE).location.geo, undefined);
});

test("an event with no source link falls back to its place on this page", () => {
  const data = eventJsonLd(makeEvent({ url: "" }), SITE);
  assert.equal(data.url, `${SITE}/#event-market-2026-09-05`);
});

test("the graph is capped so the page does not carry the whole week", () => {
  const events = Array.from({ length: 40 }, (unused, index) => makeEvent({ id: `e-${index}` }));
  const graph = eventsJsonLd(events, SITE, 25);
  assert.equal(graph["@context"], "https://schema.org");
  assert.equal(graph["@graph"].length, 25);
});

test("the serialized graph cannot break out of its script tag", () => {
  const nasty = makeEvent({ title: "Trivia </script><script>alert(1)</script>" });
  const json = JSON.stringify(eventsJsonLd([nasty], SITE)).replace(/</g, "\\u003c");
  assert.ok(!json.includes("</script>"), "no closing script tag may survive serialization");
  assert.ok(!json.includes("<script"), "no opening script tag either");
});
