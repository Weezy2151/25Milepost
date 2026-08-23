# The 25-Mile Post

A handpicked morning guide to family events happening today and this week
within about 25 miles of Orchard Park, New York. Built with the Next.js App
Router and deployable on Vercel.

## Prerequisites

- Node.js `>=20.9.0`

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## How it works

- `app/page.tsx` is the client-rendered events finder. It boots from a bundled
  fallback snapshot (`app/events-data.ts`, dated `SNAPSHOT_DATE`) so the page
  never shows a blank state, then refreshes itself from `/api/events` once
  mounted.
- `app/api/events/route.ts` fetches live library RSS and municipal iCalendar
  feeds, merges in a set of known recurring/seasonal events, geocodes venues
  (`lib/geo.ts`), cleans descriptions and resolves preview images
  (`lib/enrich.ts`), and returns the combined, deduped, sorted list.
- `db/cache.ts` caches that combined payload in memory for an hour so repeat
  visitors don't each pay for nine live feed fetches. This is a per-instance
  cache — see "Caching on Vercel" below.
- `vercel.json` declares two Vercel Cron Jobs that hit `/api/events` each
  morning to warm the cache ahead of the first visitor, mirroring the
  scheduled warm-up this project originally ran as a Cloudflare Worker cron
  trigger.

## Deploying to Vercel

This is a standard Next.js app — import the repo in the Vercel dashboard (or
run `vercel`) and it will be auto-detected and built with no extra
configuration. No environment variables are required for the app to run.

### Caching on Vercel

`db/cache.ts` is an in-memory cache, so it only helps within a single warm
serverless function instance — it is not shared across instances or durable
across cold starts. That's fine for smoothing out bursts of traffic, but if
you want the cache to actually stay warm between the two daily cron hits (see
`vercel.json`), swap it for a shared store such as Vercel KV or Upstash Redis:
keep the same `getCachedData` / `setCachedData` function signatures in
`db/cache.ts` and everything else (the API route, the cron warm-up) keeps
working unchanged.

The Vercel Hobby plan limits cron jobs to once a day; the second entry in
`vercel.json` requires a Pro plan. Trim `vercel.json` to one entry if you're
on Hobby.

## Useful Commands

- `npm run dev` — start local development
- `npm run build` — production build
- `npm start` — run the production build locally
- `npm test` — build first, then run `npm test` to server-render the page and
  check its markup (see `tests/rendered-html.test.mjs`)
- `npm run lint` — ESLint

## Project history

This app started from an OpenAI "Sites" template (`vinext` on Cloudflare
Workers, with optional D1/R2 bindings and ChatGPT sign-in helpers). Those
platform-specific pieces have been removed so the app runs as a plain
Next.js/Vercel deployment; the actual events-finder code was already written
against standard Next.js APIs (`next/headers`, the App Router, Route
Handlers) and needed no changes.
