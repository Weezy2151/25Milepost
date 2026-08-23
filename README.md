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
- `app/api/events/route.ts` fetches eleven live sources — library RSS, two
  Events Calendar REST APIs, four iCalendar feeds and three scraped HTML
  listings — merges in known
  recurring/seasonal events where no live feed already covers them, geocodes
  venues (`lib/geo.ts`), cleans descriptions and resolves preview images
  (`lib/enrich.ts`), and returns the combined, deduped, sorted list.
- `db/cache.ts` caches that combined payload in memory for an hour so repeat
  visitors don't each pay for a full round of live feed fetches. This is a per-instance
  cache — see "Caching on Vercel" below.
- `vercel.json` declares two Vercel Cron Jobs that hit `/api/events` each
  morning to warm the cache ahead of the first visitor, mirroring the
  scheduled warm-up this project originally ran as a Cloudflare Worker cron
  trigger.

## Event sources

Fetched live on each refresh (see the feed tables at the top of
`app/api/events/route.ts`):

| Source | Format | Covers |
| --- | --- | --- |
| Buffalo & Erie County Public Library (2 feeds) | LibCal RSS | Branch programs across Erie County |
| EverythingOP | Events Calendar REST | Orchard Park village and town |
| Buffalo Rising | Events Calendar REST | Regional festivals, concerts, tours |
| Town of Orchard Park | iCalendar | Town meetings and rec events |
| Town of Evans | iCalendar | Evans / Angola / Derby |
| Southtowns Regional Chamber | iCalendar | Hamburg and Southtowns business events |
| Explore & More | iCalendar | Children's museum programming |
| Step Out Buffalo (2 pages) | Scraped HTML | Trivia, bar bingo, brewery tastings, open mics |
| East Aurora Chamber | Scraped HTML (schema.org) | East Aurora village events |

Two hand-maintained layers sit alongside them: `RECURRING_TEMPLATES` (weekly
seasonal staples) and `featuredMajorEvents` (a short marquee list). Recurring
templates are a **fallback** — `dropSupersededRecurring` removes any template
entry that a live feed already covers that day, so the live copy wins. The
featured list cannot refresh itself, so `FEATURED_REVIEWED_THROUGH` logs a
warning once it goes stale.

### Optional: Ticketmaster

Set `TICKETMASTER_API_KEY` (free key from
[developer.ticketmaster.com](https://developer.ticketmaster.com/)) to add
ticketed concerts, festivals and games within the 25-mile radius. Without the
key the source is skipped and everything else works unchanged. This is the only
source that carries touring live music.

### Adding or replacing a source

Prefer a site's Events Calendar REST API (`/wp-json/tribe/events/v1/events`)
over its `?ical=1` feed where both exist — it filters by date server-side and
carries categories, cost, images and a structured venue.

Two things to know before adding one:

- **Send a browser User-Agent.** Several hosts (Explore & More among them) 403
  an unfamiliar agent. `USER_AGENT` in the route is shared by the feed fetches
  and the Open Graph image lookup in `lib/enrich.ts`.
- **Mark regional sources `regional: true`.** Wide-net sources list venues far
  outside the radius. Unplaceable venues fall back to `UNKNOWN_DISTANCE` (18
  miles) and would otherwise slip through the 25-mile filter, so regional
  sources drop any event they cannot actually place. Add out-of-range towns to
  `TOWNS` in `lib/geo.ts` so they resolve and then get filtered.

### Scraped sources

Two listings publish nothing machine-readable and cover something no feed does,
so `lib/scrape.ts` parses their rendered HTML:

- **Step Out Buffalo** is the region's only reliable listing of weekly trivia,
  bar bingo and brewery tastings. Its WordPress install exposes no events
  endpoint and it serves no iCal or RSS. Cards are parsed out of
  `/music-nightlife/` and `/food-drink-events/`.
- **East Aurora Chamber** runs on GrowthZone, which marks each card up with
  schema.org microdata — dates come from `itemprop` meta tags rather than
  display text, which makes it the sturdier of the two.

Both are regional listings, so `parseScraped` drops anything it cannot place in
a known town, and caps each scraped source at four events a day so a single
night of bar events cannot crowd out the rest of the list. Step Out Buffalo's
pages also mix real events with standing restaurant promotion, so a listing has
to read as an event by its title or the site's own category label to be kept —
see `NIGHTLIFE_EVENT` and `STANDING_PROMOTION` in the route.

Scraping breaks when markup moves. The signal is a source that suddenly reports
`count: 0` in the payload's `sources` array; the route already logs that case.

Known dead ends, checked 2026-08-23: `townofhamburgny.gov` and
`buffalony.gov` do not respond at all; West Seneca's iCalendar feed returns a
valid but permanently empty calendar. All five were removed. For East Aurora:
`eastaurorany.com` (the Advertiser) does not answer at all, the village
calendar at `eastaurora.gov` is board and commission meetings only, the Roycroft
Campus runs The Events Calendar but has posted nothing since 2025, and
`eastauroraevents.com` is one venue rather than a calendar — its weekend flea
market is carried as a recurring template instead.

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
