import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_VIEW } from "../lib/filter.ts";
import { overlayFromHash, overlayToHash, viewFromParams, viewToParams, viewToUrl } from "../lib/url.ts";

const params = (view) => viewToParams(view).toString();
const roundTrip = (view) => viewFromParams(viewToParams(view));

test("an untouched view writes no query string at all", () => {
  assert.equal(params(DEFAULT_VIEW), "");
  assert.equal(viewToUrl(DEFAULT_VIEW, "/"), "/");
});

test("only what the visitor changed is written", () => {
  assert.equal(params({ ...DEFAULT_VIEW, vibe: "kids" }), "vibe=kids");
  assert.equal(params({ ...DEFAULT_VIEW, day: "2026-09-05" }), "day=2026-09-05");
  assert.equal(params({ ...DEFAULT_VIEW, maxDistance: 10 }), "within=10");
  assert.equal(params({ ...DEFAULT_VIEW, showSaved: true }), "saved=1");
  assert.equal(params({ ...DEFAULT_VIEW, freeOnly: true }), "free=1");
  assert.equal(params({ ...DEFAULT_VIEW, sort: "closest" }), "sort=closest");
  // "auto" is the default, so it stays out of the URL.
  assert.equal(params({ ...DEFAULT_VIEW, sort: "auto" }), "");
});

test("a search is trimmed before it reaches the URL", () => {
  assert.equal(params({ ...DEFAULT_VIEW, query: "  farmers market  " }), "q=farmers+market");
  assert.equal(params({ ...DEFAULT_VIEW, query: "   " }), "");
});

test("every view survives a round trip through the URL", () => {
  const view = {
    day: "2026-09-06",
    kind: "Live music",
    setting: "outdoor",
    vibe: "evening",
    maxDistance: 15,
    sort: "closest",
    query: "concert",
    showSaved: true,
    freeOnly: true,
  };
  assert.deepEqual(roundTrip(view), view);
  assert.deepEqual(roundTrip(DEFAULT_VIEW), DEFAULT_VIEW);
});

test("the weekend is a day selection the URL can carry", () => {
  assert.equal(params({ ...DEFAULT_VIEW, day: "weekend" }), "day=weekend");
  assert.equal(viewFromParams(new URLSearchParams("day=weekend")).day, "weekend");
  assert.equal(viewFromParams(new URLSearchParams("day=whenever")).day, null);
});

test("junk in the address bar is ignored rather than trusted", () => {
  const view = viewFromParams(
    new URLSearchParams({
      day: "not-a-date",
      kind: "Underwater basket weaving",
      setting: "underground",
      vibe: "chaos",
      within: "-5",
      sort: "by vibes",
      saved: "yes",
    }),
  );
  assert.deepEqual(view, DEFAULT_VIEW);
});

test("a distance outside the app's radius is rejected", () => {
  assert.equal(viewFromParams(new URLSearchParams("within=10")).maxDistance, 10);
  assert.equal(viewFromParams(new URLSearchParams("within=10.4")).maxDistance, 10);
  assert.equal(viewFromParams(new URLSearchParams("within=0")).maxDistance, null);
  assert.equal(viewFromParams(new URLSearchParams("within=1e9")).maxDistance, null);
  assert.equal(viewFromParams(new URLSearchParams("within=NaN")).maxDistance, null);
});

test("an overlong search is cut rather than carried whole", () => {
  const long = "a".repeat(500);
  assert.equal(viewFromParams(new URLSearchParams({ q: long })).query.length, 120);
});

test("viewToUrl builds the path, query and fragment together", () => {
  const view = { ...DEFAULT_VIEW, vibe: "kids", day: "2026-09-05" };
  assert.equal(viewToUrl(view, "/"), "/?day=2026-09-05&vibe=kids");
  assert.equal(viewToUrl(view, "/", "#my-day"), "/?day=2026-09-05&vibe=kids#my-day");
  assert.equal(viewToUrl(DEFAULT_VIEW, "/", "#event-abc"), "/#event-abc");
});

test("the fragment names which overlay is open", () => {
  assert.deepEqual(overlayFromHash("#my-day"), { kind: "my-day" });
  assert.deepEqual(overlayFromHash("#filters"), { kind: "filters" });
  assert.deepEqual(overlayFromHash("#event-lib-123-2026-09-05"), { kind: "event", id: "lib-123-2026-09-05" });
  assert.equal(overlayFromHash(""), null);
  assert.equal(overlayFromHash("#results"), null, "the skip link's target is not an overlay");
  assert.equal(overlayFromHash("#event-"), null);
});

test("an overlay round-trips through the fragment, ids escaped", () => {
  for (const overlay of [null, { kind: "my-day" }, { kind: "filters" }, { kind: "event", id: "abc-123" }]) {
    assert.deepEqual(overlayFromHash(overlayToHash(overlay)), overlay);
  }
  // Ids come from feeds and are not guaranteed to be URL-safe.
  const awkward = { kind: "event", id: "tribe/op #4?x=1" };
  assert.ok(!overlayToHash(awkward).includes(" "));
  assert.deepEqual(overlayFromHash(overlayToHash(awkward)), awkward);
});
