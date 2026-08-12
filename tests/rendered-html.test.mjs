import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the dynamic events finder with a last-known snapshot", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /The 25-Mile Post/);
  assert.match(html, /Cruise Night at the Depot/);
  assert.match(html, /East Aurora Farmers Market/);
  assert.doesNotMatch(html, /Fossil Frenzy Play Cafe/);
  assert.match(html, /Erie County Fair/);
  assert.doesNotMatch(html, /Au-Some Morning Edition/);
  assert.match(html, /Loading this morning’s edition/);
  assert.match(html, /Southtowns/);
  assert.match(html, /Buffalo city/);
  assert.match(html, /Town of Orchard Park/);
  assert.match(html, /Town of Hamburg/);
  assert.match(html, /Orchard Park Bee/);
  assert.match(html, /Hamburg Sun/);
  assert.doesNotMatch(html, /Tuesday, August 11, 2026|Movie in the Park: Tangled|Teen Game Night|Delaware Park Flow Jam/);

  assert.equal((html.match(/<article class="event-card/g) ?? []).length, 8);
});

test("keeps live refresh, interactions, source adapters and hosting metadata", async () => {
  const [page, api, layout, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /twenty-five-mile-post-clippings/);
  assert.match(page, /api\.open-meteo\.com/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /fetch\("\/api\/events\?edition=balanced-v2"/);
  assert.doesNotMatch(page, /setInterval/);
  assert.match(page, /refreshed each morning/);
  assert.match(page, /What sounds good/);
  assert.match(page, /setTown/);
  assert.match(page, /setQuery/);
  assert.match(page, /setShowSaved/);
  assert.match(page, /Southtowns/);
  assert.match(page, /Destination Dinosaur/);
  assert.match(api, /buffalolib\.libcal\.com\/rss\.php/);
  assert.match(api, /orchardparkny\.gov\/events/);
  assert.match(api, /iCalendar\.aspx/);
  assert.match(api, /townofevansny\.gov\/events/);
  assert.match(api, /capLibraries/);
  assert.match(api, /s-maxage=86400/);
  assert.match(api, /West Seneca Farmers Market/);
  assert.match(api, /stale-while-revalidate/);
  assert.match(page, /Buffalo city/);
  assert.match(layout, /The 25-Mile Post \| Family Things To Do Near Orchard Park/);
  assert.match(layout, /images: \[\{ url: imageUrl/);

  const manifest = JSON.parse(hosting);
  assert.equal(manifest.project_id, "appgprj_6a7a45f3b30481919b110ea039820221");
});
