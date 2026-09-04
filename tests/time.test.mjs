import assert from "node:assert/strict";
import test from "node:test";

import { formatMinutes, parseEventTime, parseStartMinutes } from "../lib/time.ts";

const at = (hour, minute = 0) => hour * 60 + minute;

test("parses a single start time", () => {
  assert.deepEqual(parseEventTime("2 PM"), { startMinutes: at(14), endMinutes: null });
  assert.deepEqual(parseEventTime("10:30 AM"), { startMinutes: at(10, 30), endMinutes: null });
  assert.deepEqual(parseEventTime("9 PM"), { startMinutes: at(21), endMinutes: null });
});

test("borrows the meridiem across a range", () => {
  // The start carries no AM/PM of its own; the end states it for both.
  assert.deepEqual(parseEventTime("7–9 PM"), { startMinutes: at(19), endMinutes: at(21) });
  assert.deepEqual(parseEventTime("4:30–6:30 PM"), { startMinutes: at(16, 30), endMinutes: at(18, 30) });
  assert.deepEqual(parseEventTime("5–7 PM"), { startMinutes: at(17), endMinutes: at(19) });
});

test("keeps a range that states both meridiems", () => {
  assert.deepEqual(parseEventTime("11 AM–10 PM"), { startMinutes: at(11), endMinutes: at(22) });
  assert.deepEqual(parseEventTime("7 AM–1 PM"), { startMinutes: at(7), endMinutes: at(13) });
  assert.deepEqual(parseEventTime("7:30 AM–1 PM"), { startMinutes: at(7, 30), endMinutes: at(13) });
});

test("corrects a range that borrowing would run backwards", () => {
  // "11–1 PM" is an 11 AM start, not an 11 PM one.
  assert.deepEqual(parseEventTime("11–1 PM"), { startMinutes: at(11), endMinutes: at(13) });
  assert.deepEqual(parseEventTime("9–1 PM"), { startMinutes: at(9), endMinutes: at(13) });
});

test("handles noon and midnight, which the 12-hour clock gets wrong", () => {
  assert.equal(parseStartMinutes("12 PM"), at(12));
  assert.equal(parseStartMinutes("12 AM"), at(0));
  assert.equal(parseStartMinutes("12:30 AM"), at(0, 30));
  assert.deepEqual(parseEventTime("12–3 PM"), { startMinutes: at(12), endMinutes: at(15) });
});

test("treats a second reading as an end time only inside a range", () => {
  // Two offered start times, not a range.
  assert.deepEqual(parseEventTime("10:30 or 11:30 AM"), { startMinutes: at(10, 30), endMinutes: null });
  // Trailing prose, not a range.
  assert.deepEqual(parseEventTime("6:35 PM first pitch"), { startMinutes: at(18, 35), endMinutes: null });
  // Explicit range words do count.
  assert.deepEqual(parseEventTime("2 PM to 4 PM"), { startMinutes: at(14), endMinutes: at(16) });
});

test("reads the start out of a listing with trailing detail", () => {
  assert.deepEqual(parseEventTime("7–10 PM · film at sunset"), { startMinutes: at(19), endMinutes: at(22) });
  assert.deepEqual(parseEventTime("11 AM–10 PM · midway noon–11"), { startMinutes: at(11), endMinutes: at(22) });
  assert.equal(parseStartMinutes("1 PM"), at(13));
});

test("returns unknown rather than guessing", () => {
  const unknown = { startMinutes: null, endMinutes: null };
  assert.deepEqual(parseEventTime("All day"), unknown);
  assert.deepEqual(parseEventTime("all-day"), unknown);
  assert.deepEqual(parseEventTime("During library hours"), unknown);
  assert.deepEqual(parseEventTime("See listing"), unknown);
  assert.deepEqual(parseEventTime("Times vary"), unknown);
  assert.deepEqual(parseEventTime(""), unknown);
  assert.deepEqual(parseEventTime(undefined), unknown);
  assert.deepEqual(parseEventTime(null), unknown);
});

test("ignores numbers that are not clock readings", () => {
  // A bare figure with no meridiem anywhere cannot be resolved.
  assert.equal(parseStartMinutes("Doors at 7"), null);
  // Out-of-range hours are not clocks.
  assert.equal(parseStartMinutes("Route 219 detour"), null);
});

test("formatMinutes round-trips the app's display style", () => {
  assert.equal(formatMinutes(at(14)), "2 PM");
  assert.equal(formatMinutes(at(16, 30)), "4:30 PM");
  assert.equal(formatMinutes(at(0)), "12 AM");
  assert.equal(formatMinutes(at(12)), "12 PM");
  assert.equal(formatMinutes(at(9, 5)), "9:05 AM");
});
