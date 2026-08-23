import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PORT = 4173 + (process.pid % 1000);

/**
 * Boots the production Next.js server (`next start`, against the build
 * produced by `npm run build`) on a scratch port, fetches "/", and returns
 * the rendered HTML. Assumes `next build` has already been run — CI/local
 * runs should do `npm run build && npm test`.
 */
async function withServer(run) {
  const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT) },
  });

  let ready = false;
  const readyPromise = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      const text = chunk.toString();
      if (/Ready in|started server/i.test(text)) {
        ready = true;
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      if (!ready) reject(new Error(`next start exited early (code ${code})`));
    });
  });

  let readyTimer;
  try {
    await Promise.race([
      readyPromise,
      new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error("next start timed out")), 30_000); }),
    ]);
  } finally {
    clearTimeout(readyTimer);
  }

  try {
    return await run(`http://localhost:${PORT}`);
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
}

test("server-renders the static events finder with a last-known snapshot", async () => {
  const html = await withServer(async (base) => {
    const response = await fetch(base, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    return response.text();
  });

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
  assert.ok(vercelJson.crons.every((cron) => cron.path === "/api/events"), "crons should warm the events route");
});
