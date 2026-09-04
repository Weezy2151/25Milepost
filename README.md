# The 25-Mile Post

A handpicked morning guide to family events happening today and this week
within about 25 miles of Orchard Park, New York. Built with the Next.js App
Router and deployable on Vercel.

## Prerequisites

- Node.js `24.x` (the same major used by CI and Vercel)

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## How it works

- `app/page.tsx` is a server component that reads whatever the shared cache
  already holds and hands it to `app/events-client.tsx`, the interactive events
  finder, which refreshes itself from `/api/events` once mounted. The read is
  cache-only: building the payload means a dozen live calendar fetches, and a
  page render never pays for them. With a cold cache the page renders the same
  safe loading state it always did and the client's fetch does the building.
  If live calendars fail, the client falls back to the bundled snapshot
  (`app/events-data.ts`, dated `SNAPSHOT_DATE`) with an explicit stale-data
  warning; the server never renders that snapshot.
- The page is revalidated every 15 minutes (`export const revalidate`), so the
  HTML is CDN-cached rather than rebuilt per request. Today's listings are also
  emitted as schema.org `Event` JSON-LD, which is what earns a place in search
  engines' event results — the reason the listings need to be in the HTML at
  all. **This depends on a shared cache**: with only the in-memory store the
  page render and the API route do not share one, so the server render finds
  nothing and falls back to the loading state. Configure Redis (see "Caching on
  Vercel") for the server-rendered listings and their structured data.
- `/api/weather` validates and caches Orchard Park forecasts server-side. Event
  photos use Next.js image optimization directly; the optimizer's remote-host
  allowlist is shared with the server-side URL validator, so untrusted image
  origins are discarded before they reach the page.
- `app/api/events/route.ts` fetches thirteen live sources — library RSS, three
  Events Calendar REST APIs, four iCalendar feeds and four scraped HTML
  listings — merges in known
  recurring/seasonal events where no live feed already covers them, geocodes
  venues (`lib/geo.ts`), cleans descriptions and resolves preview images
  (`lib/enrich.ts`), and returns the combined, deduped, sorted list.
- `db/cache.ts` caches that combined payload for two hours — in a shared Redis
  store if one is configured, in memory otherwise. Entries stay servable for
  six hours past that window, so an expired payload is returned immediately while
  one leased rebuild runs behind the response, and a copy of the last payload that ever
  built successfully is kept for a week as a floor. See "Caching on Vercel".
- `/api/calendar/[id]` and `/api/calendar/my-day?id=…` hand out iCalendar
  files for one event or a whole itinerary, written by `lib/ics-write.ts` and
  served from the cached payload — a download never triggers a feed fetch.
- `vercel.json` declares two Vercel Cron Jobs that hit the authenticated
  `/api/cron/events` route each morning to warm the cache ahead of the first visitor, mirroring the
  scheduled warm-up this project originally ran as a Cloudflare Worker cron
  trigger.

## Event sources

Fetched live on each refresh (see the feed tables at the top of
`app/api/events/route.ts`):

| Source | Format | Covers |
| --- | --- | --- |
| Buffalo & Erie County Public Library (2 feeds) | LibCal RSS | Branch programs across Erie County |
| EverythingOP | Events Calendar REST | Orchard Park village and town |
| Orchard Park Chamber | Events Calendar REST | Home-town festivals, Oktoberfest, the arts expo |
| Buffalo Rising | Events Calendar REST | Regional festivals, concerts, tours |
| Town of Orchard Park | iCalendar | Town meetings and rec events |
| Town of Evans | iCalendar | Evans / Angola / Derby |
| Southtowns Regional Chamber | iCalendar | Hamburg and Southtowns business events |
| Explore & More | iCalendar | Children's museum programming |
| Step Out Buffalo | Scraped HTML | Trivia, bar bingo, brewery tastings, open mics |
| East Aurora Chamber | Scraped HTML (schema.org) | East Aurora village events |
| Erie County Parks | Scraped HTML (Drupal view) | Ranger-led hikes, kids-and-families and nature programs |

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

Three listings publish nothing machine-readable and cover something no feed
does, so `lib/scrape.ts` parses their rendered HTML:

- **Step Out Buffalo** is the region's only reliable listing of weekly trivia,
  bar bingo and brewery tastings. Its WordPress install exposes no events
  endpoint and it serves no iCal or RSS. Cards are parsed out of
  `/music-nightlife/` and `/food-drink-events/`.
- **East Aurora Chamber** runs on GrowthZone, which marks each card up with
  schema.org microdata — dates come from `itemprop` meta tags rather than
  display text, which makes it the sturdier of the three.
- **Erie County Parks** carries the county's ranger-led hikes, fishing lessons
  and kids-and-families programs at Chestnut Ridge, Emery, Sprague Brook and
  the rest — the one part of the region's family calendar nothing else here
  covered. It runs on a Drupal view with no iCalendar, RSS or JSON endpoint of
  any kind, but the markup labels each title and category with a class and
  stamps both ends of the event in `<time datetime>`, so start times come from
  an attribute rather than display text. The listing prints a park and never a
  town, so `ERIE_PARK_TOWNS` in `lib/scrape.ts` supplies it; parks whose town
  is not certain are left unmapped and their events are dropped.

All three are regional listings, so `parseScraped` drops anything it cannot
place in a known town, and caps each scraped source at four events a day so a
single night of bar events cannot crowd out the rest of the list. Step Out Buffalo's
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

### Categories still missing

Two family-relevant categories have no machine-readable source and are
deliberately absent rather than half-filled with guesses, checked 2026-08-23:

- **School district events** (concerts, plays, fundraisers). Orchard Park runs
  Finalsite, which answers 404 on every documented calendar endpoint and 403 on
  `site/RSS.aspx`; the rendered calendar page exposes only a feed UUID with no
  public reader. East Aurora's district site does not resolve at all. The
  category is also mostly board meetings and conference days, which
  `NOT_AN_OUTING` would drop anyway.
- **Church and fire-hall fundraisers** — fish fries, chicken BBQs, lawn fêtes.
  Genuinely among the most-searched WNY weekend categories and carried almost
  entirely on Facebook, which publishes no feed. This is what
  `RECURRING_TEMPLATES` exists for, but only with dates and times confirmed
  from a real listing: an invented church supper is worse than a missing one.

Also checked and rejected: the Buffalo Zoo, the Aquarium of Niagara and the
Erie County Fair all 403 both their REST and iCal endpoints; the Botanical
Gardens has no calendar index; Visit Buffalo Niagara sits behind a bot
challenge. Explore Buffalo's Events Calendar REST API does answer, but has
posted nothing — worth revisiting when their tour season opens.

## Deploying to Vercel

This is a standard Next.js app — import the GitHub repo in the Vercel dashboard
and it will be auto-detected and built with no custom build command. The app
still runs without most environment variables, but a shared Redis/KV backend is
required for reliable Vercel cron warm-ups, cross-instance caching, and
`/api/health` history. Without it, the app falls back to an in-process memory
cache isolated per serverless function. Scheduled warm-ups also require
`CRON_SECRET`; use a long random value and set it in every Vercel environment
where the cron should run. Vercel sends it to the cron route as a Bearer token.

Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin for absolute
social metadata; Vercel's production hostname is used automatically otherwise.
`TICKETMASTER_API_KEY` remains optional.

### Caching on Vercel

`db/cache.ts` prefers a shared Redis store and falls back to memory. Set either
pair of environment variables and the morning cron warm-up survives cold starts
and is shared across function instances, which is what makes it actually reach
the first reader:

| Provider | Variables |
| --- | --- |
| Vercel KV | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

With neither set it uses an in-process `Map`, which only helps inside a single
warm instance. Nothing else changes: both backends store the same envelope and
the route is identical either way. `/api/events` reports which one is live in
`freshness.store`. Cache keys include the Vercel environment, keeping preview
and production data separate even when they share a Redis database.

Three behaviours sit on top of whichever store is in use:

- **Stale-while-revalidate.** A payload is fresh for two hours and stays servable
  for six hours after that. Past the fresh window, the route answers from the stale
  copy immediately and rebuilds in `after()`, once the response is already on
  its way — nobody waits on thirteen live feeds because they happened to be the
  first reader back. A Redis lease and an in-process single-flight guard prevent
  simultaneous stale requests from fanning out again. Watch the `X-Cache`
  header: `HIT`, `STALE`, `MISS`, or
  `LAST-GOOD`.
- **A last-good copy**, written under a date-independent key with a one-week
  TTL. A morning where every feed fails falls back to the newest listings that
  ever built rather than to `app/events-data.ts` — yesterday's real events are
  wrong about which day it is, the bundled snapshot is wrong about everything.
- **Freshness in the payload.** `freshness.state` is `fresh`, `stale` or
  `last-good`, with `ageSeconds` and the `builtFor` date. The page reads it and
  says so: a `last-good` payload gets a banner naming the morning it was
  collected, and a `stale` one marks the "Events updated" row as refreshing.

Fresh responses may sit in Vercel's CDN for fifteen minutes; partial responses
use a two-minute edge window and degraded responses only one minute, so an
upstream outage cannot pin bad data for a day. `/api/health` exposes
the last check, per-source duration and count, last success, and consecutive
failures, returning 503 when the feed set is degraded.

Vercel cron schedules use UTC. Each configured job runs once per day, which is
compatible with the Hobby plan; Hobby execution can occur at any point within
the scheduled hour. The two entries warm the cache around 5 a.m. and 11 a.m.
Eastern during daylight-saving time.

## Useful Commands

- `npm run dev` — start local development
- `npm run build` — production build
- `npm start` — run the production build locally
- `npm test` — self-contained production build, unit tests, and rendered-page test
- `npm run test:unit` — fixture tests for iCalendar, scrapers, schemas, URL guards, and caching
- `npm run test:render` — verify production HTML (requires a build)
- `npm run typecheck` — TypeScript without emitting files
- `npm run lint` — ESLint

GitHub Actions runs install, lint, typecheck, unit tests, build, and the rendered
page test on every pull request and push to `main`.

## Project history

This app started from an OpenAI "Sites" template (`vinext` on Cloudflare
Workers, with optional D1/R2 bindings and ChatGPT sign-in helpers). Those
platform-specific pieces have been removed so the app runs as a plain
Next.js/Vercel deployment; the actual events-finder code was already written
against standard Next.js APIs (the App Router and Route Handlers) and needed no
platform-specific runtime bindings.
