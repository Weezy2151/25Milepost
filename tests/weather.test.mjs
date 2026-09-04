import assert from "node:assert/strict";
import test from "node:test";

import { dayAdvisory, weatherEmoji } from "../lib/weather.ts";

const day = (overrides = {}) => ({
  dateKey: "2026-09-05",
  label: "Clear",
  high: 70,
  low: 55,
  rain: 10,
  code: 0,
  ...overrides,
});

test("a pleasant day carries no advisory", () => {
  assert.equal(dayAdvisory(day()), null);
  assert.equal(dayAdvisory(null), null);
  // Just under the rain threshold is still a fine day out.
  assert.equal(dayAdvisory(day({ rain: 39 })), null);
});

test("rain is flagged from 40% up", () => {
  const advisory = dayAdvisory(day({ rain: 40 }));
  assert.equal(advisory?.kind, "rain");
  assert.match(advisory.headline, /40% chance of rain/);
  assert.equal(advisory.suggestsIndoor, true);
});

test("Western New York weather beyond rain is flagged too", () => {
  assert.equal(dayAdvisory(day({ code: 95, rain: 80 }))?.kind, "storm");
  assert.equal(dayAdvisory(day({ code: 73, high: 28 }))?.kind, "snow");
  assert.equal(dayAdvisory(day({ code: 85 }))?.kind, "snow", "snow showers count as snow");
  assert.equal(dayAdvisory(day({ high: 12, code: 3 }))?.kind, "cold");
  assert.equal(dayAdvisory(day({ high: 91, code: 0 }))?.kind, "heat");
});

test("only the most consequential advisory is returned", () => {
  // A snowy, freezing, wet day is one warning, not three.
  const advisory = dayAdvisory(day({ code: 73, high: 14, rain: 90 }));
  assert.equal(advisory?.kind, "snow");
});

test("heat does not send people indoors, it moves them to the cool hours", () => {
  assert.equal(dayAdvisory(day({ high: 95 }))?.suggestsIndoor, false);
});

test("weatherEmoji covers each band of WMO codes", () => {
  assert.equal(weatherEmoji(0), "☀️");
  assert.equal(weatherEmoji(3), "⛅");
  assert.equal(weatherEmoji(45), "🌫️");
  assert.equal(weatherEmoji(65), "🌧️");
  assert.equal(weatherEmoji(75), "❄️");
  assert.equal(weatherEmoji(96), "⛈️");
});
