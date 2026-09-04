import assert from "node:assert/strict";
import test from "node:test";

import { buildItinerary, routeUrl } from "../lib/itinerary.ts";

const makeEvent = (overrides = {}) => ({
  id: "stop",
  area: "southtowns",
  town: "Hamburg",
  day: "SAT",
  date: "Sat, Sep 5",
  dateKey: "2026-09-05",
  time: "10 AM",
  title: "A Stop",
  venue: "Somewhere",
  distance: 7,
  description: "",
  cost: "Free",
  source: "Test",
  url: "",
  mapUrl: "https://example.test/map",
  tags: [],
  accent: "mint",
  kind: "Community",
  setting: "both",
  startMinutes: 600,
  endMinutes: 660,
  ...overrides,
});

test("stops are ordered by when they start, not when they were added", () => {
  const { stops } = buildItinerary([
    makeEvent({ id: "afternoon", startMinutes: 840, endMinutes: 900 }),
    makeEvent({ id: "morning", startMinutes: 540, endMinutes: 600 }),
    makeEvent({ id: "midday", startMinutes: 720, endMinutes: 780 }),
  ]);
  assert.deepEqual(stops.map((stop) => stop.event.id), ["morning", "midday", "afternoon"]);
});

test("an overlap with the previous stop is flagged", () => {
  const { stops, clashCount } = buildItinerary([
    makeEvent({ id: "first", startMinutes: 600, endMinutes: 720 }),
    makeEvent({ id: "second", startMinutes: 660, endMinutes: 780 }),
  ]);
  assert.equal(stops[0].clashes, false);
  assert.equal(stops[1].clashes, true);
  assert.equal(clashCount, 1);
});

test("a stop with no stated end cannot prove a clash", () => {
  // It is assumed to run until the next thing rather than to overlap it.
  const { stops, clashCount } = buildItinerary([
    makeEvent({ id: "first", startMinutes: 600, endMinutes: null }),
    makeEvent({ id: "second", startMinutes: 660, endMinutes: 780 }),
  ]);
  assert.equal(stops[1].clashes, false);
  assert.equal(clashCount, 0);
});

test("travel is offered only between stops that both have coordinates", () => {
  const withCoords = buildItinerary([
    makeEvent({ id: "a", startMinutes: 540, endMinutes: 600, lat: 42.767, lon: -78.744 }),
    makeEvent({ id: "b", startMinutes: 720, endMinutes: 780, lat: 42.716, lon: -78.829 }),
  ]);
  assert.equal(withCoords.stops[0].travel, null, "the first stop has nothing to travel from");
  assert.ok(withCoords.stops[1].travel.miles > 0);
  assert.ok(withCoords.stops[1].travel.minutes >= 5);

  // Guessing from distance-to-Orchard-Park would call these neighbours; we say nothing.
  const withoutCoords = buildItinerary([
    makeEvent({ id: "a", startMinutes: 540, distance: 10, lat: undefined, lon: undefined }),
    makeEvent({ id: "b", startMinutes: 720, distance: 10, lat: undefined, lon: undefined }),
  ]);
  assert.equal(withoutCoords.stops[1].travel, null);
});

test("a connection too short for the drive is flagged as tight", () => {
  const { stops } = buildItinerary([
    // Ends 12:00, and the next starts 12:05 nearly twenty miles away.
    makeEvent({ id: "a", startMinutes: 600, endMinutes: 720, lat: 42.767, lon: -78.744 }),
    makeEvent({ id: "b", startMinutes: 725, endMinutes: 800, lat: 42.9, lon: -78.87 }),
  ]);
  assert.equal(stops[1].tight, true);
  assert.equal(stops[1].clashes, false, "a tight connection is not an overlap");
});

test("a comfortable gap is not flagged", () => {
  const { stops } = buildItinerary([
    makeEvent({ id: "a", startMinutes: 540, endMinutes: 600, lat: 42.767, lon: -78.744 }),
    makeEvent({ id: "b", startMinutes: 900, endMinutes: 960, lat: 42.716, lon: -78.829 }),
  ]);
  assert.equal(stops[1].tight, false);
});

test("events with no readable time are kept aside rather than placed in the day", () => {
  const { stops, unscheduled } = buildItinerary([
    makeEvent({ id: "timed", startMinutes: 600 }),
    makeEvent({ id: "anytime", time: "All day", startMinutes: null, endMinutes: null }),
  ]);
  assert.deepEqual(stops.map((stop) => stop.event.id), ["timed"]);
  assert.deepEqual(unscheduled.map((event) => event.id), ["anytime"]);
});

test("the route runs from Orchard Park through every stop", () => {
  const url = new URL(routeUrl([
    makeEvent({ id: "a", venue: "First Place", town: "Hamburg" }),
    makeEvent({ id: "b", venue: "Second Place", town: "Eden" }),
  ]));
  assert.equal(url.searchParams.get("origin"), "Orchard Park, NY");
  assert.equal(url.searchParams.get("destination"), "Second Place, Eden, NY");
  assert.equal(url.searchParams.get("waypoints"), "First Place, Hamburg, NY");
  assert.equal(url.searchParams.get("travelmode"), "driving");
});

test("a single stop needs no waypoints, and an empty plan has no route", () => {
  const url = new URL(routeUrl([makeEvent({ venue: "Only Place", town: "Eden" })]));
  assert.equal(url.searchParams.get("destination"), "Only Place, Eden, NY");
  assert.equal(url.searchParams.get("waypoints"), null);
  assert.equal(routeUrl([]), null);
});
