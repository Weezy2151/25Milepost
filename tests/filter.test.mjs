import assert from "node:assert/strict";
import test from "node:test";

import {
  activeCriteria,
  buildSearchIndex,
  DEFAULT_CRITERIA,
  DEFAULT_VIEW,
  driveMinutes,
  filterEvents,
  groupOtherDays,
  isFree,
  matchesDaySelection,
  matchesVibe,
  resolveSort,
  weekendKeys,
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

test("sorting by soonest orders the day and leaves unreadable times at the end", () => {
  const events = [
    makeEvent({ id: "evening", time: "7–9 PM" }),
    makeEvent({ id: "unknown", time: "During library hours" }),
    makeEvent({ id: "morning", time: "10:30 AM" }),
    makeEvent({ id: "afternoon", time: "4:30–6:30 PM" }),
  ];
  const sorted = filterEvents(buildSearchIndex(events), { ...DEFAULT_CRITERIA, sort: "soonest" }, new Set());
  assert.deepEqual(sorted.map((event) => event.id), ["morning", "afternoon", "evening", "unknown"]);
});

test("sorting by soonest prefers the normalized minutes over the display string", () => {
  // A live event carries minutes the API worked out; they win over the text.
  const events = [
    makeEvent({ id: "later", time: "See listing", startMinutes: 18 * 60, endMinutes: null }),
    makeEvent({ id: "earlier", time: "See listing", startMinutes: 9 * 60, endMinutes: null }),
  ];
  const sorted = filterEvents(buildSearchIndex(events), { ...DEFAULT_CRITERIA, sort: "soonest" }, new Set());
  assert.deepEqual(sorted.map((event) => event.id), ["earlier", "later"]);
});

test("resolveSort is chronological on today and editorial when planning ahead", () => {
  assert.equal(resolveSort("auto", true), "soonest");
  assert.equal(resolveSort("auto", false), "recommended");
  // An explicit choice is always honoured.
  assert.equal(resolveSort("closest", true), "closest");
  assert.equal(resolveSort("recommended", true), "recommended");
});

test("groupOtherDays gathers matches from the rest of the week in date order", () => {
  const events = [
    makeEvent({ id: "today-1", dateKey: "2026-09-04" }),
    makeEvent({ id: "sun-1", dateKey: "2026-09-06" }),
    makeEvent({ id: "sat-1", dateKey: "2026-09-05" }),
    makeEvent({ id: "sat-2", dateKey: "2026-09-05" }),
  ];
  const { groups, total } = groupOtherDays(events, "2026-09-04");

  assert.equal(total, 3, "the day being viewed is excluded from the count");
  assert.deepEqual(groups.map((group) => group.dateKey), ["2026-09-05", "2026-09-06"]);
  assert.deepEqual(groups[0].events.map((event) => event.id), ["sat-1", "sat-2"]);
});

test("groupOtherDays keeps one busy day from crowding out the others", () => {
  const events = [
    ...Array.from({ length: 5 }, (unused, index) => makeEvent({ id: `sat-${index}`, dateKey: "2026-09-05" })),
    makeEvent({ id: "sun-1", dateKey: "2026-09-06" }),
  ];
  const { groups, total } = groupOtherDays(events, "2026-09-04", { limit: 6, perDay: 3 });

  assert.equal(total, 6, "total counts every match, not just the ones listed");
  assert.equal(groups[0].events.length, 3, "a single day is capped");
  assert.deepEqual(groups[1].events.map((event) => event.id), ["sun-1"]);
});

test("groupOtherDays stops at the overall limit", () => {
  const events = Array.from({ length: 12 }, (unused, index) =>
    makeEvent({ id: `e-${index}`, dateKey: `2026-09-${String(5 + index).padStart(2, "0")}` }),
  );
  const { groups } = groupOtherDays(events, "2026-09-04", { limit: 4, perDay: 3 });
  assert.equal(groups.reduce((count, group) => count + group.events.length, 0), 4);
});

test("groupOtherDays ignores events with no date", () => {
  const events = [makeEvent({ id: "undated", dateKey: undefined }), makeEvent({ id: "dated", dateKey: "2026-09-05" })];
  const { groups, total } = groupOtherDays(events, "2026-09-04");
  assert.equal(total, 1);
  assert.deepEqual(groups[0].events.map((event) => event.id), ["dated"]);
});

test("weekendKeys picks out Saturday and Sunday", () => {
  // 2026-09-04 is a Friday.
  const week = ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"];
  assert.deepEqual(weekendKeys(week), ["2026-09-05", "2026-09-06"]);
  assert.deepEqual(weekendKeys(["2026-09-07", "2026-09-08"]), [], "a midweek stretch has no weekend");
});

test("a weekend selection matches either of its days", () => {
  const weekend = new Set(["2026-09-05", "2026-09-06"]);
  const saturday = makeEvent({ dateKey: "2026-09-05" });
  const monday = makeEvent({ dateKey: "2026-09-07" });

  assert.equal(matchesDaySelection(saturday, "weekend", weekend), true);
  assert.equal(matchesDaySelection(monday, "weekend", weekend), false);
  // A single date still matches only itself.
  assert.equal(matchesDaySelection(saturday, "2026-09-05", weekend), true);
  assert.equal(matchesDaySelection(saturday, "2026-09-06", weekend), false);
  // An undated event belongs to no selection.
  assert.equal(matchesDaySelection(makeEvent({ dateKey: undefined }), "weekend", weekend), false);
});
