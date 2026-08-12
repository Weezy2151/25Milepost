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

test("server-renders the August 12 morning edition", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /The 25-Mile Post/);
  assert.match(html, /Morning edition · Wednesday, August 12, 2026/);
  assert.match(html, /Erie County Fair Opening Day/);
  assert.match(html, /Destination Dinosaur/);
  assert.match(html, /EPIC Storytime on the Lawn/);
  assert.match(html, /Summer Youth Showcase/);
  assert.match(html, /Au-Some Morning Edition/);
  assert.match(html, /Rock the Block/);
  assert.match(html, /Eleven vetted picks through Wednesday/);
  assert.doesNotMatch(html, /Tuesday, August 11, 2026|Movie in the Park: Tangled|Family Fort Night|Pokémon Club/);

  assert.equal((html.match(/<article class="today-card/g) ?? []).length, 5);
  assert.equal((html.match(/<article class="week-story"/g) ?? []).length, 11);
});

test("keeps the newspaper interactions and hosting metadata in source", async () => {
  const [page, layout, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /twenty-five-mile-post-clippings/);
  assert.match(page, /api\.open-meteo\.com/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /event\.days \?\? \[event\.day\]/);
  assert.match(page, /setMaxDistance/);
  assert.match(page, /setActiveFilter/);
  assert.match(page, /setActiveDay/);
  assert.match(layout, /The 25-Mile Post \| Family Things To Do Near Orchard Park/);
  assert.match(layout, /images: \[\{ url: imageUrl/);

  const manifest = JSON.parse(hosting);
  assert.equal(manifest.project_id, "appgprj_6a7a45f3b30481919b110ea039820221");
});
