import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server-renders the static events finder with a last-known snapshot", async () => {
  // The route is statically generated, so inspecting Next's production artifact
  // tests the exact HTML Vercel will serve without booting a disposable server.
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");

  assert.match(html, /The 25-Mile Post/);
  assert.match(html, /Cruise Night at the Depot/);
  assert.doesNotMatch(html, /Fossil Frenzy Play Cafe/);
  assert.match(html, /Erie County Fair/);
  assert.doesNotMatch(html, /Au-Some Morning Edition/);
  assert.match(html, /Pick a day this week/);
  assert.match(html, /Town of Orchard Park/);
  assert.match(html, /Village of Hamburg/);
  assert.match(html, /Orchard Park Bee/);
  assert.match(html, /Hamburg Sun/);

  // The greeting and any stored itinerary resolve after mount, so the server
  // markup must stay time- and storage-independent.
  assert.match(html, /Hello, Orchard Park\./);
  assert.doesNotMatch(html, /Good (morning|afternoon|evening), Orchard Park/);

  // Server-side, "today" defaults to whichever day the snapshot flags — that's
  // the erie fair, cruise night, concert and East Aurora market (4 of the 8
  // fallback events); the rest live on other day tabs until picked.
  assert.equal((html.match(/<article class="card /g) ?? []).length, 4);
  assert.match(html, /East Aurora Farmers Market/);
});

test("schedules a Vercel Cron warm-up of the events cache", async () => {
  const vercelJson = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(vercelJson.crons) && vercelJson.crons.length > 0, "vercel.json must declare crons");
  assert.ok(vercelJson.crons.every((cron) => cron.path === "/api/cron/events"), "crons should use the authenticated warm-up route");
});
