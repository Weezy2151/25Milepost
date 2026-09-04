import assert from "node:assert/strict";
import test from "node:test";

import { buildIcs, foldLine, googleCalendarUrl } from "../lib/ics-write.ts";

const SITE = "https://example.test";
const NOW = new Date("2026-09-04T10:00:00Z");

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

const lines = (ics) => ics.split("\r\n");
const find = (ics, prefix) => lines(ics).find((line) => line.startsWith(prefix));

test("a timed event is written with its local start and end", () => {
  const ics = buildIcs([makeEvent()], { siteOrigin: SITE, now: NOW });
  assert.equal(find(ics, "DTSTART"), "DTSTART;TZID=America/New_York:20260905T073000");
  assert.equal(find(ics, "DTEND"), "DTEND;TZID=America/New_York:20260905T130000");
  assert.equal(find(ics, "SUMMARY"), "SUMMARY:Hamburg Farmers Market");
  assert.equal(find(ics, "LOCATION"), "LOCATION:45 Church St\\, Hamburg\\, NY");
  assert.equal(find(ics, "UID"), "UID:market-2026-09-05@25milepost");
});

test("the document is a well-formed calendar with CRLF endings", () => {
  const ics = buildIcs([makeEvent()], { siteOrigin: SITE, now: NOW });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /VERSION:2\.0/);
  assert.equal(lines(ics).filter((l) => l === "BEGIN:VEVENT").length, 1);
  assert.equal(lines(ics).filter((l) => l === "END:VEVENT").length, 1);
  // A bare \n would break parsers that split on CRLF.
  assert.ok(!/[^\r]\n/.test(ics), "every line must end with CRLF");
});

test("an event with no stated end is booked for a sensible span", () => {
  const ics = buildIcs([makeEvent({ startMinutes: 14 * 60, endMinutes: null })], { siteOrigin: SITE, now: NOW });
  assert.equal(find(ics, "DTSTART"), "DTSTART;TZID=America/New_York:20260905T140000");
  assert.equal(find(ics, "DTEND"), "DTEND;TZID=America/New_York:20260905T153000");
});

test("an event with no readable clock becomes an all-day entry", () => {
  const ics = buildIcs([makeEvent({ time: "All day", startMinutes: null, endMinutes: null })], { siteOrigin: SITE, now: NOW });
  assert.equal(find(ics, "DTSTART"), "DTSTART;VALUE=DATE:20260905");
  // A date-only end is exclusive, so it is the following day.
  assert.equal(find(ics, "DTEND"), "DTEND;VALUE=DATE:20260906");
});

test("text is escaped so punctuation cannot break the format", () => {
  const ics = buildIcs(
    [makeEvent({ title: "Trivia; bingo, too", description: "Line one\nLine two \\ end" })],
    { siteOrigin: SITE, now: NOW },
  );
  assert.equal(find(ics, "SUMMARY"), "SUMMARY:Trivia\\; bingo\\, too");
  const description = lines(ics).find((line) => line.startsWith("DESCRIPTION"));
  assert.ok(description.includes("Line one\\nLine two \\\\ end"), description);
});

test("long lines are folded at 75 octets without splitting a character", () => {
  const folded = foldLine(`SUMMARY:${"a".repeat(200)}`);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1, "a long line must fold");
  assert.ok(parts.every((part) => Buffer.byteLength(part, "utf8") <= 75));
  assert.ok(parts.slice(1).every((part) => part.startsWith(" ")), "continuations are marked with a space");
  // Unfolding restores the original exactly.
  assert.equal(parts.map((part, index) => (index === 0 ? part : part.slice(1))).join(""), `SUMMARY:${"a".repeat(200)}`);
});

test("folding never cuts a multi-byte character in half", () => {
  const title = `SUMMARY:${"é".repeat(60)}`;
  const folded = foldLine(title);
  assert.ok(!folded.includes("�"), "no replacement characters");
  assert.equal(folded.split("\r\n").map((p) => p.replace(/^ /, "")).join(""), title);
});

test("several events share one calendar document", () => {
  const ics = buildIcs([makeEvent(), makeEvent({ id: "second", title: "Second" })], { siteOrigin: SITE, now: NOW });
  assert.equal(lines(ics).filter((l) => l === "BEGIN:VEVENT").length, 2);
  assert.equal(lines(ics).filter((l) => l === "BEGIN:VCALENDAR").length, 1);
});

test("the Google Calendar link carries the local time and zone", () => {
  const url = new URL(googleCalendarUrl(makeEvent(), SITE));
  assert.equal(url.searchParams.get("dates"), "20260905T073000/20260905T130000");
  assert.equal(url.searchParams.get("ctz"), "America/New_York");
  assert.equal(url.searchParams.get("text"), "Hamburg Farmers Market");
  assert.match(url.searchParams.get("location"), /Hamburg/);
});

test("a clockless event links as an all-day Google entry", () => {
  const url = new URL(googleCalendarUrl(makeEvent({ startMinutes: null, endMinutes: null }), SITE));
  assert.equal(url.searchParams.get("dates"), "20260905/20260906");
  assert.equal(url.searchParams.get("ctz"), null);
});

test("what we write, our own iCalendar reader can read back", async () => {
  // lib/ical.ts parses other people's calendars; running our own output
  // through it is the closest thing to checking a real calendar app.
  const { parseIcalOccurrences } = await import("../lib/ical.ts");

  const ics = buildIcs(
    [
      makeEvent({ id: "timed", title: "Hamburg Farmers Market" }),
      makeEvent({ id: "allday", title: "Depot Museum Open", startMinutes: null, endMinutes: null }),
    ],
    { siteOrigin: SITE, now: NOW },
  );

  const parsed = parseIcalOccurrences(ics, "2026-09-01", "2026-09-30");
  assert.equal(parsed.length, 2, "both events should survive the round trip");

  const timed = parsed.find((event) => event.title === "Hamburg Farmers Market");
  assert.equal(timed.dateKey, "2026-09-05");
  assert.equal(timed.allDay, false);
  assert.equal(timed.time, "7:30 AM");

  const allDay = parsed.find((event) => event.title === "Depot Museum Open");
  assert.equal(allDay.dateKey, "2026-09-05");
  assert.equal(allDay.allDay, true);
});

test("escaped punctuation survives the round trip unescaped", async () => {
  const { parseIcalOccurrences } = await import("../lib/ical.ts");
  const ics = buildIcs([makeEvent({ title: "Trivia; bingo, too" })], { siteOrigin: SITE, now: NOW });
  const [parsed] = parseIcalOccurrences(ics, "2026-09-01", "2026-09-30");
  assert.equal(parsed.title, "Trivia; bingo, too");
});
