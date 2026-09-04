import assert from "node:assert/strict";
import test from "node:test";

import {
  activeCriteria,
  buildSearchIndex,
  DEFAULT_CRITERIA,
  DEFAULT_VIEW,
  driveMinutes,
  filterEvents,
  isFree,
  matchesVibe,
  searchText,
  settingLabel,
  viewReducer,
} from "../lib/filter.ts";

/** A complete event, so each test can override only the field under test. */
function makeEvent(overrides = {}) {
  return {
    id: "sample",
    area: "southtowns",
    town: "Orchard Park",
    day: "TODAY",
    date: "Wed, Sep 4",
    dateKey: "2026-09-04",
    time: "2 PM",
    title: "Sample Event",
    venue: "Sample Venue",
    distance: 4,
    description: "A sample listing.",
    cost: "Free",
    source: "Test",
    url: "https://example.test/event",
    mapUrl: "https://example.test/map",
    tags: [],
    accent: "mint",
    kind: "Community",
    setting: "both",
    ...overrides,
  };
}

const vibeOf = (event, vibe) => matchesVibe(event, vibe, searchText(event));

test("isFree only accepts listings with no dollar figure", () => {
  assert.equal(isFree("Free"), true);
  assert.equal(isFree("Free · registration required"), true);
  assert.equal(isFree("  free entry"), true);
  // A discount is not the same as a free event.
  assert.equal(isFree("Free with 4+ canned goods · otherwise $19 adult"), false);
  assert.equal(isFree("12 & under free"), false);
  assert.equal(isFree("$22 single · $99 family pack"), false);
  assert.equal(isFree("Ticket prices vary"), false);
});

test("driveMinutes floors at five minutes and scales with distance", () => {
  assert.equal(driveMinutes(0), 5);
  assert.equal(driveMinutes(1), 5);
  assert.equal(driveMinutes(16), 30);
  assert.equal(driveMinutes(25), 47);
});

test("settingLabel covers every setting including an absent one", () => {
  assert.equal(settingLabel("indoor"), "Indoor");
  assert.equal(settingLabel("outdoor"), "Outdoor");
  assert.equal(settingLabel("both"), "Indoor + outdoor");
  assert.equal(settingLabel(undefined), "Indoor + outdoor");
});

test("the 'get outside' vibe never returns an explicitly indoor event", () => {
  assert.equal(vibeOf(makeEvent({ setting: "outdoor" }), "outside"), true);
  assert.equal(vibeOf(makeEvent({ setting: "both" }), "outside"), true);

  // Regression: a library in a town whose name contains "Park" is not outdoors.
  const library = makeEvent({
    setting: "indoor",
    town: "Orchard Park",
    venue: "Orchard Park Public Library",
    title: "Reptiles Around the World",
    kind: "Library",
  });
  assert.equal(vibeOf(library, "outside"), false);

  // Nor is an indoor program that merely talks about nature.
  const natureTalk = makeEvent({ setting: "indoor", title: "Nature Slideshow", venue: "Eden Library" });
  assert.equal(vibeOf(natureTalk, "outside"), false);
});

test("the 'get outside' vibe still matches a real park, ignoring the town name", () => {
  const realPark = makeEvent({ setting: undefined, town: "Orchard Park", venue: "Chestnut Ridge Park" });
  assert.equal(vibeOf(realPark, "outside"), true);

  // The town name alone must not qualify a venue that is not a park.
  const depot = makeEvent({ setting: undefined, town: "Orchard Park", venue: "Orchard Park BR&P Depot", title: "Cruise Night" });
  assert.equal(vibeOf(depot, "outside"), false);

  const trail = makeEvent({ setting: undefined, title: "Ranger-led Hike", description: "A guided trail walk." });
  assert.equal(vibeOf(trail, "outside"), true);
});

test("the 'keep kids busy' vibe excludes age-gated events", () => {
  const storytime = makeEvent({ title: "Story Time", kind: "Library" });
  assert.equal(vibeOf(storytime, "kids"), true);

  const barTrivia = makeEvent({ title: "Bar Trivia", description: "21+ only, at the brewery.", kind: "Community" });
  assert.equal(vibeOf(barTrivia, "kids"), false);

  // The age gate can arrive as a tag rather than prose.
  const tagged = makeEvent({ title: "Family Night", tags: ["21+"], description: "Kids welcome upstairs." });
  assert.equal(vibeOf(tagged, "kids"), false);

  const adultsOnly = makeEvent({ title: "Museum After Dark", description: "Adults only evening at the museum." });
  assert.equal(vibeOf(adultsOnly, "kids"), false);
});

test("the 'rain plan' vibe never returns an explicitly outdoor event", () => {
  assert.equal(vibeOf(makeEvent({ setting: "indoor" }), "rain"), true);

  // Regression: an outdoor concert on a library lawn is not a rain plan.
  const lawnConcert = makeEvent({ setting: "outdoor", venue: "Hamburg Library Lawn", title: "Summer Concert" });
  assert.equal(vibeOf(lawnConcert, "rain"), false);
});

test("the 'after 5' vibe reads the actual start hour", () => {
  assert.equal(vibeOf(makeEvent({ time: "7–9 PM" }), "evening"), true);
  assert.equal(vibeOf(makeEvent({ time: "5 PM" }), "evening"), true);
  assert.equal(vibeOf(makeEvent({ time: "4:30–6:30 PM" }), "evening"), false);
  assert.equal(vibeOf(makeEvent({ time: "10:30 AM" }), "evening"), false);
  // Noon and midnight are the two hours the 12-hour clock gets wrong most often.
  assert.equal(vibeOf(makeEvent({ time: "12 PM" }), "evening"), false);
  assert.equal(vibeOf(makeEvent({ time: "12 AM" }), "evening"), false);
  // Evening-flavoured content still qualifies when the time is unreadable.
  assert.equal(vibeOf(makeEvent({ time: "See listing", title: "Live Music Night" }), "evening"), true);
});

test("the 'worth the drive' vibe starts at twelve miles", () => {
  assert.equal(vibeOf(makeEvent({ distance: 11 }), "drive"), false);
  assert.equal(vibeOf(makeEvent({ distance: 12 }), "drive"), true);
});

test("the 'eat & browse' vibe matches food listings by kind or wording", () => {
  assert.equal(vibeOf(makeEvent({ kind: "Markets & food" }), "food"), true);
  assert.equal(vibeOf(makeEvent({ title: "Farmers Market" }), "food"), true);
  assert.equal(vibeOf(makeEvent({ title: "Town Board Meeting" }), "food"), false);
});

test("filterEvents applies distance, setting, kind, saved and text together", () => {
  const events = [
    makeEvent({ id: "near-free", distance: 2, kind: "Library", setting: "indoor", title: "Story Time" }),
    makeEvent({ id: "far-market", distance: 18, kind: "Markets & food", setting: "outdoor", title: "Farmers Market" }),
    makeEvent({ id: "mid-music", distance: 9, kind: "Live music", setting: "outdoor", title: "Summer Concert" }),
  ];
  const index = buildSearchIndex(events);
  const ids = (criteria, saved = new Set()) =>
    filterEvents(index, { ...DEFAULT_CRITERIA, ...criteria }, saved).map((event) => event.id);

  assert.deepEqual(ids({}), ["near-free", "far-market", "mid-music"]);
  assert.deepEqual(ids({ maxDistance: 10 }), ["near-free", "mid-music"]);
  assert.deepEqual(ids({ setting: "indoor" }), ["near-free"]);
  assert.deepEqual(ids({ kind: "Live music" }), ["mid-music"]);
  assert.deepEqual(ids({ query: "  MARKET " }), ["far-market"]);
  assert.deepEqual(ids({ showSaved: true }, new Set(["mid-music"])), ["mid-music"]);
  assert.deepEqual(ids({ sort: "closest" }), ["near-free", "mid-music", "far-market"]);
});

test("filterEvents keeps the source order untouched when sorting by recommendation", () => {
  const events = [makeEvent({ id: "a", distance: 20 }), makeEvent({ id: "b", distance: 1 })];
  const result = filterEvents(buildSearchIndex(events), DEFAULT_CRITERIA, new Set());
  assert.deepEqual(result.map((event) => event.id), ["a", "b"]);
});

test("an event with no kind can still be matched through its tags", () => {
  const event = makeEvent({ id: "legacy", kind: undefined, tags: ["Library"] });
  const ids = filterEvents(buildSearchIndex([event]), { ...DEFAULT_CRITERIA, kind: "Library" }, new Set());
  assert.deepEqual(ids.map((item) => item.id), ["legacy"]);
});

test("activeCriteria lists only what the visitor actually changed", () => {
  assert.deepEqual(activeCriteria(DEFAULT_CRITERIA), []);
  assert.deepEqual(
    activeCriteria({ ...DEFAULT_CRITERIA, vibe: "kids", maxDistance: 10, query: "  music  " }),
    [
      { key: "vibe", label: "Keep kids busy" },
      { key: "maxDistance", label: "Within 10 mi" },
      { key: "query", label: "“music”" },
    ],
  );
  // Whitespace alone is not a search.
  assert.deepEqual(activeCriteria({ ...DEFAULT_CRITERIA, query: "   " }), []);
});

test("viewReducer sets, clears and resets", () => {
  const set = (state, action) => viewReducer(state, action);

  const withKind = set(DEFAULT_VIEW, { type: "kind", value: "Live music" });
  assert.equal(withKind.kind, "Live music");
  assert.equal(withKind.day, null, "changing a filter must not move the selected day");

  const onDay = set(withKind, { type: "day", value: "2026-09-06" });
  assert.equal(onDay.day, "2026-09-06");

  // Clearing one filter leaves the others and the day alone.
  const cleared = set(set(onDay, { type: "vibe", value: "kids" }), { type: "clear", key: "vibe" });
  assert.equal(cleared.vibe, "all");
  assert.equal(cleared.kind, "Live music");
  assert.equal(cleared.day, "2026-09-06");

  // "Clear all filters" keeps you on the day you were looking at...
  const filtersCleared = set(cleared, { type: "clearFilters" });
  assert.equal(filtersCleared.kind, "All activities");
  assert.equal(filtersCleared.day, "2026-09-06");

  // ...while the empty-state reset also returns you to today.
  assert.deepEqual(set(cleared, { type: "resetAll" }), DEFAULT_VIEW);
});

test("viewReducer returns the same object when nothing changed", () => {
  const state = viewReducer(DEFAULT_VIEW, { type: "kind", value: "Library" });
  assert.equal(viewReducer(state, { type: "kind", value: "Library" }), state);
});
