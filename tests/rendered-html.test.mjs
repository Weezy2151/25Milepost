import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the server never presents the bundled snapshot as today's listings", async () => {
  // The route is prerendered, so inspecting Next's production artifact tests
  // the exact HTML Vercel will serve without booting a disposable server.
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");

  // Only what a visitor can actually see. The scripts carry the serialized
  // payload, where a live recurring event may share a title with a snapshot
  // entry — matching against those would fail for the wrong reason.
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");

  assert.match(visible, /The 25-Mile Post/);
  assert.match(visible, /Town of Orchard Park/);
  assert.match(visible, /Village of Hamburg/);
  assert.match(visible, /Orchard Park Bee/);
  assert.match(visible, /Hamburg Sun/);

  // The bundled safety net is a hardcoded copy from months ago. These two
  // titles appear nowhere in the live feed layers, so seeing either rendered
  // means the snapshot reached the page as though it were current.
  assert.doesNotMatch(visible, /Reptiles Around the World/);
  assert.doesNotMatch(visible, /Fossil Frenzy/);

  // The greeting and any stored itinerary resolve after mount, so the server
  // markup must stay time- and storage-independent.
  assert.match(visible, /Hello, Orchard Park\./);
  assert.doesNotMatch(visible, /Good (morning|afternoon|evening), Orchard Park/);
});

test("the prerendered page matches whichever cache state it was built against", async () => {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  const cards = (html.match(/<article class="card /g) ?? []).length;
  const loading = /Loading live calendars/.test(html);
  const structured = /application\/ld\+json/.test(html);

  // The page reads whatever the shared cache holds at build or revalidate
  // time, so both outcomes are correct — but they must be self-consistent.
  // A build with a cold cache shows the loading state and describes nothing;
  // a build with a warm one renders real cards and describes them for search
  // engines. What must never happen is cards with no data behind them.
  if (cards === 0) {
    assert.ok(loading, "with no cached listings the page must show its loading state");
    assert.ok(!structured, "there is nothing to describe to a search engine");
  } else {
    assert.ok(!loading, "rendered listings must not also claim to be loading");
    assert.ok(structured, "rendered listings must be described as schema.org events");
  }
});

test("schedules a Vercel Cron warm-up of the events cache", async () => {
  const vercelJson = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(vercelJson.crons) && vercelJson.crons.length > 0, "vercel.json must declare crons");
  assert.ok(vercelJson.crons.every((cron) => cron.path === "/api/cron/events"), "crons should use the authenticated warm-up route");
});
