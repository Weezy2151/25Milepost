import { after } from "next/server";

import { acquireCacheLock, cacheBackendName, getCachedEntry, setCachedData } from "../../../db/cache";
import { distanceFromOrigin, extractTown, ORIGIN } from "../../../lib/geo";
import { describe, resolveImages } from "../../../lib/enrich";
import { eventsPayloadSchema, liveEventSchema, type EventKind, type EventsPayload, type EventSetting, type LiveEvent, type SourceHealth } from "../../../lib/events";
import { EVENTS_HEALTH_KEY, healthSnapshotSchema, type HealthSnapshot } from "../../../lib/health";
import { parseIcalOccurrences } from "../../../lib/ical";
import { assertSafePublicUrl, EVENT_IMAGE_HOSTS, fetchPublicText } from "../../../lib/safe-fetch";
import { parseErieParks, parseGrowthZone, parseStepOutBuffalo, parseVisitBuffalo, type ScrapedEvent } from "../../../lib/scrape";

export type { EventSetting, LiveEvent } from "../../../lib/events";

const ZONE = "America/New_York";
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

/**
 * Feeds answer a browser and stall or 403 an unfamiliar agent.
 * Explore & More returned 403 to the old "The 25-Mile Post family event index"
 * string and serves its calendar fine with this one.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LIBRARY_FEEDS = [
  ["Library Programs", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=12898"],
  ["Library Crafts", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=16301"],
] as const;

/**
 * The Events Calendar REST API, where a site exposes it.
 *
 * Preferred over the matching ?ical=1 feed: it filters server-side by date and
 * carries categories, cost, a featured image and a structured venue, so these
 * events arrive richer than anything the iCal parser can recover.
 */
const TRIBE_FEEDS = [
  ["EverythingOP", "https://everythingop.com", "southtowns", "Orchard Park"],
  ["Orchard Park Chamber", "https://orchardparkchamber.org", "southtowns", "Orchard Park"],
  ["Buffalo Rising", "https://www.buffalorising.com", "city", "Buffalo"],
] as const;

/*
 * Removed 2026-08-23, all confirmed dead rather than merely quiet:
 *   West Seneca Recreation  — 200 OK, valid iCalendar, zero VEVENTs
 *   Hamburg Recreation      — townofhamburgny.gov does not respond at all
 *   Buffalo Special/City/Sponsored — buffalony.gov completes TLS then hangs
 * They were failing silently behind Promise.allSettled and only added latency.
 */
const ICS_FEEDS = [
  ["Town of Orchard Park", "https://www.orchardparkny.gov/events/?ical=1", "southtowns"],
  ["Town of Evans", "https://townofevansny.gov/events/month/?ical=1&shortcode=a96c91f8", "southtowns"],
  ["Southtowns Regional Chamber", "https://southtownsregionalchamber.org/?post_type=tribe_events&ical=1&eventDisplay=list", "southtowns"],
  ["Explore & More", "https://exploreandmore.org/events/?ical=1", "city"],
] as const;

/**
 * Listings worth having that publish no feed at all, scraped from HTML.
 *
 * Step Out Buffalo carries the region's broadest day-by-day event inventory —
 * no iCal, no RSS, and its WordPress install exposes no events endpoint. The
 * East Aurora Chamber is the only East Aurora
 * calendar in a machine-readable shape: the Advertiser's site does not answer,
 * and the village posts nothing but board meetings.
 *
 * `kind` picks the parser; `town` is the fallback patch for a source whose
 * cards carry no address of their own.
 */
type ScrapeParser = "stepout" | "visitbuffalo" | "growthzone" | "erieparks";

const SCRAPED_FEEDS: ReadonlyArray<readonly [string, string, ScrapeParser, "southtowns" | "city", string]> = [
  ["Step Out Buffalo", "https://stepoutbuffalo.com/all-events/", "stepout", "southtowns", ""],
  ["Visit Buffalo", "https://visitbuffalo.com/events/", "visitbuffalo", "city", "Buffalo"],
  ["East Aurora Chamber", "https://business.eanycc.com/eventcalendar", "growthzone", "southtowns", "East Aurora"],
  ["Erie County Parks", "https://www3.erie.gov/parks/events", "erieparks", "southtowns", ""],
] as const;

const branchInfo: Record<string, { town: string; distance: number; area: "southtowns" | "city" }> = {
  "Orchard Park Public Library": { town: "Orchard Park", distance: 1, area: "southtowns" },
  "Hamburg Public Library": { town: "Hamburg", distance: 12, area: "southtowns" },
  "Lake Shore Branch Library": { town: "Lakeshore", distance: 11, area: "southtowns" },
  "Eden Library": { town: "Eden", distance: 16, area: "southtowns" },
  "Elma Public Library": { town: "Elma", distance: 10, area: "southtowns" },
  "West Seneca Public Library": { town: "West Seneca", distance: 9, area: "southtowns" },
  "Lackawanna Public Library": { town: "Lackawanna", distance: 10, area: "southtowns" },
  "Boston Free Library": { town: "Boston", distance: 17, area: "southtowns" },
  "Aurora Town Public Library": { town: "East Aurora", distance: 12, area: "southtowns" },
  "Marilla Free Library": { town: "Marilla", distance: 16, area: "southtowns" },
  "Lancaster Public Library": { town: "Lancaster", distance: 18, area: "southtowns" },
  "Anna Reinstein Memorial Library": { town: "Cheektowaga", distance: 16, area: "southtowns" },
  "Julia Boyer Reinstein Library": { town: "Cheektowaga", distance: 18, area: "southtowns" },
  "Central Library": { town: "Buffalo", distance: 18, area: "city" },
  "Crane Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Dudley Branch Library": { town: "Buffalo", distance: 14, area: "city" },
  "East Clinton Branch Library": { town: "Buffalo", distance: 13, area: "city" },
  "Elaine M. Panty Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Frank E. Merriweather, Jr. Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Isaías González-Soto Branch Library": { town: "Buffalo", distance: 16, area: "city" },
  "Leroy R. Coles, Jr. Branch Library": { town: "Buffalo", distance: 18, area: "city" },
  "North Park Branch Library": { town: "Buffalo", distance: 18, area: "city" },
  "Riverside Branch Library": { town: "Buffalo", distance: 20, area: "city" },
};

function localDateKey(date = new Date()) {
  return LOCAL_DATE_FORMATTER.format(date);
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function textBetween(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";
}

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function cleanHtml(value: string) {
  return decode(value).replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatTime(raw: string) {
  if (!raw || raw === "00:00:00") return "All day";
  const [hourText, minute] = raw.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}${minute === "00" ? "" : `:${minute}`} ${suffix}`;
}

function formatDate(key: string) {
  return DATE_FORMATTER.format(new Date(`${key}T12:00:00Z`));
}

function dayLabel(key: string, todayKey: string) {
  if (key === todayKey) return "TODAY";
  if (key === addDays(todayKey, 1)) return "TOMORROW";
  return DAY_FORMATTER.format(new Date(`${key}T12:00:00Z`)).toUpperCase();
}

function safeImage(image?: string) {
  if (!image) return undefined;
  if (image.startsWith("/") && !image.startsWith("//")) return image;
  try {
    return assertSafePublicUrl(image, [...EVENT_IMAGE_HOSTS]).toString();
  } catch {
    return undefined;
  }
}

/** Town names come back from the geo lookup as lowercase keys; the UI shows them. */
function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function mapUrl(venue: string, town: string) {
  // Sources that carry no venue pass an empty string; dropping it keeps the
  // query from reading "East Aurora East Aurora NY".
  const query = [venue, venue.toLowerCase().includes(town.toLowerCase()) ? "" : town, "NY"].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

/**
 * Closed municipal business and nightlife nobody is browsing a day out for.
 * Excluded from every source regardless of audience.
 */
const NOT_AN_OUTING =
  /nightclub|bar crawl|pub crawl|burlesque|casino night|board meeting|planning board|zoning|public hearing|work session|commission meeting|committee meeting|council meeting|court calendar|budget hearing|caucus|fundraiser donation drop off/;

/**
 * An explicit age gate. Disqualifying on a municipal or library listing, but
 * routine on the trivia and tasting listings this app deliberately carries —
 * so sources that are adult by design pass `allowAgeGated` and label the card.
 */
const AGE_GATED = /adult only|adults only|ages 21|21\+|18\+|cocktail/;

function familyFriendly(title: string, audiences: string[], description: string, allowAgeGated = false) {
  const text = `${title} ${description}`.toLowerCase();
  if (NOT_AN_OUTING.test(text)) return false;
  if (!allowAgeGated && AGE_GATED.test(text)) return false;
  if (audiences.length === 0) return true;
  return audiences.some((audience) => /child|teen|all ages|family|young adult/i.test(audience));
}

const KIND_RULES: Array<[RegExp, EventKind]> = [
  [/fair\b|festival|parade|mela|art spree|block party|street party/, "Fairs & festivals"],
  [/concert|live music|music series|jazz|bandstand|orchestra|symphony|open mic|acoustic|\bband\b|karaoke/, "Live music"],
  [/museum|zoo|dinosaur|shakespeare|theater|theatre|movie|film|tour\b|history|gallery|exhibit/, "Museums & culture"],
  [/farmers? market|farm market|\bmarket\b|food truck|tasting|taste of|brewery|brewing|\bbeer\b|cider|winery|\bwine\b|urban farm|harvest|chili cook|bbq|barbecue/, "Markets & food"],
  [/baseball|bisons|buffalo bills|football|sport|fitness|yoga|pickleball|bocce|\bbike\b|\brun\b|\b5k\b/, "Sports & active"],
  [/park\b|nature|hike|outdoor|beach|garden|wildlife|trail|soap making/, "Outdoors"],
  [/trivia|quiz night|bingo|game night|comedy/, "Community"],
  [/library|libcal|b&ecpl/, "Library"],
];

/**
 * Pick a category, weighting the title over the description.
 *
 * Descriptions mention food and parking for almost everything, which is how an
 * outdoor movie night ended up filed under "Markets & food". The title says
 * what an event *is*, so it gets the first pass on its own; the description is
 * only consulted when the title is uninformative.
 */
function classify(title: string, description: string, source: string): EventKind {
  const headline = title.toLowerCase();
  for (const [pattern, kind] of KIND_RULES) if (pattern.test(headline)) return kind;

  const body = `${description} ${source}`.toLowerCase();
  for (const [pattern, kind] of KIND_RULES) if (pattern.test(body)) return kind;

  return "Community";
}

function inferSetting(title: string, description: string, venue: string, tags: string[], kind: EventKind): EventSetting {
  const text = `${title} ${description} ${venue} ${tags.join(" ")} ${kind}`.toLowerCase();
  if (/fairgrounds|depot|brewery|pavilion|museum & grounds|zoo/i.test(text)) return "both";
  if (/library|museum|indoor|escape|play cafe|theatre|storytime|microscope|board game|lego|tinkering|sensory/i.test(text)) return "indoor";
  if (/park|outdoor|market|farmers market|hike|trail|stadium|lawn|garden|beach|waterfront|parade|picnic|canalside|bubble day|running|bike|sports|tractor pull/i.test(text)) return "outdoor";
  if (kind === "Library" || kind === "Museums & culture") return "indoor";
  if (kind === "Markets & food" || kind === "Outdoors" || kind === "Sports & active") return "outdoor";
  return "both";
}

/**
 * Per-feed timeout. Measured cold: Buffalo Rising 4.4–5.5s, Town of Evans ~7s,
 * so the previous 8s clipped them on a slow morning. Feeds are fetched in
 * parallel, so this is close to the whole route's wall clock.
 */
const FEED_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, headers: HeadersInit, timeoutMs = 4000, maxBytes = 3_000_000): Promise<string> {
  return fetchPublicText(url, { headers, timeoutMs, maxBytes });
}

function parseLibrary(xml: string, todayKey: string, endKey: string): LiveEvent[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap((match, index) => {
    const item = match[1];
    const dateKey = decode(textBetween(item, "libcal:date"));
    if (dateKey < todayKey || dateKey > endKey) return [];
    const venue = cleanHtml(textBetween(item, "libcal:campus"));
    const info = branchInfo[venue];
    if (!info) return [];
    const title = cleanHtml(textBetween(item, "title"));
    const description = cleanHtml(textBetween(item, "libcal:description"));
    if (/citizenship test|summer reading (program|logs?|raffle)|kids summer reading|read it & keep it|reading challenge|passive program/i.test(title)) return [];
    const audiences = [...item.matchAll(/<libcal:audience>([\s\S]*?)<\/libcal:audience>/gi)].map((value) => cleanHtml(value[1]));
    if (!familyFriendly(title, audiences, description)) return [];
    const start = decode(textBetween(item, "libcal:start"));
    const end = decode(textBetween(item, "libcal:end"));
    const registrations = decode(textBetween(item, "libcal:registrations")) === "true";
    const category = cleanHtml(textBetween(item, "category"));
    const url = decode(textBetween(item, "link"));
    const image = decode(textBetween(item, "libcal:feat_image"));
    const time = start === "00:00:00" ? "All day" : `${formatTime(start)}${end && end !== "23:59:59" ? `–${formatTime(end)}` : ""}`;
    const tags = [category || "Library", ...audiences.slice(0, 2)].filter(Boolean);
    const kind = "Library" as const;
    const setting = inferSetting(title, description, venue, tags, kind);

    const located = place(venue, info.town);
    if (located.distance > 25) return [];

    return [{
      id: `lib-${decode(textBetween(item, "libcal:eventid")) || index}-${dateKey}`,
      area: info.area, town: info.town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey, time,
      title, venue, ...located,
      description: describe(description, title, venue, info.town),
      cost: `Free${registrations ? " · registration may be required" : ""}`,
      source: "Buffalo & Erie County Public Library", url, mapUrl: mapUrl(venue, info.town),
      tags,
      accent: ["mint", "sky", "sun", "coral", "purple"][index % 5], image: image || undefined, today: dateKey === todayKey,
      kind, setting, priority: 1,
    }];
  });
}

/* ------------------------------------------- The Events Calendar REST API */

type TribeVenue = { venue?: string; address?: string; city?: string; state?: string };
type TribeEvent = {
  id?: number;
  title?: string;
  description?: string;
  excerpt?: string;
  url?: string;
  cost?: string;
  all_day?: boolean;
  start_date?: string;
  end_date?: string;
  image?: false | { url?: string };
  venue?: TribeVenue | unknown[];
  categories?: Array<{ name?: string }>;
  tags?: Array<{ name?: string }>;
};

/** Tribe returns `[]` for "no venue" and an object otherwise. */
function tribeVenue(value: TribeEvent["venue"]): TribeVenue {
  return value && !Array.isArray(value) ? (value as TribeVenue) : {};
}

function tribeImage(value: TribeEvent["image"]) {
  return value && typeof value === "object" && typeof value.url === "string" ? value.url : undefined;
}

/** "2026-08-24 16:00:00" -> "4 PM", or "All day" for all-day events. */
function tribeTime(startDate: string, allDay: boolean) {
  if (allDay) return "All day";
  const time = startDate.split(" ")[1];
  return time ? formatTime(time) : "All day";
}

/**
 * Normalise one site's Events Calendar API response.
 *
 * `defaultTown` is the site's own patch — EverythingOP is Orchard Park unless a
 * listing says otherwise. Regional sites cover far more than 25 miles, so any
 * event we cannot actually place is dropped rather than allowed to claim the
 * UNKNOWN_DISTANCE fallback; a local site keeps the fallback because its
 * listings are local by construction.
 */
function parseTribe(
  json: string,
  source: string,
  defaultArea: "southtowns" | "city",
  defaultTown: string,
  todayKey: string,
  endKey: string,
  regional: boolean,
): LiveEvent[] {
  let parsed: { events?: TribeEvent[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed.events) ? parsed.events : [];

  return items.flatMap((item, index) => {
    const start = item.start_date ?? "";
    const startKey = start.slice(0, 10);
    const itemEndKey = (item.end_date ?? start).slice(0, 10);
    if (!startKey || itemEndKey < todayKey || startKey > endKey) return [];

    const title = cleanHtml(item.title ?? "");
    if (!title) return [];
    const description = cleanHtml(item.description ?? item.excerpt ?? "");
    if (!familyFriendly(title, [], description)) return [];

    const place_ = tribeVenue(item.venue);
    const venue = cleanHtml(place_.venue ?? "") || defaultTown;
    const addressText = [place_.venue, place_.address, place_.city].filter(Boolean).join(" ");
    const town = place_.city?.trim() || titleCase(extractTown(addressText) ?? "") || (regional ? "" : defaultTown);
    if (regional && !town) return [];

    const located = place(venue, town || defaultTown);
    if (located.distance > 25) return [];
    if (regional && located.distancePrecision === "region") return [];

    const resolvedTown = town || defaultTown;
    const area = resolvedTown.toLowerCase() === "buffalo" ? "city" : defaultArea;
    const categories = (item.categories ?? []).map((category) => cleanHtml(category.name ?? "")).filter(Boolean);
    const kind = classify(title, `${description} ${categories.join(" ")}`, source);
    const tags = [kind, ...categories.slice(0, 2)].filter(Boolean);
    const cost = cleanHtml(item.cost ?? "") || (/\bfree\b/i.test(description) ? "Free" : "See listing");

    return dateKeysInRange(startKey, itemEndKey, todayKey, endKey).map((dateKey) => ({
      id: `tribe-${source}-${item.id ?? index}-${dateKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      area, town: resolvedTown, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey,
      time: tribeTime(start, item.all_day === true),
      title, venue, ...located,
      description: describe(description, title, venue, resolvedTown),
      cost,
      source, url: item.url ?? "", mapUrl: mapUrl(venue, resolvedTown),
      tags,
      accent: ["sun", "coral", "sky", "mint", "purple"][index % 5],
      image: tribeImage(item.image),
      today: dateKey === todayKey,
      kind, setting: inferSetting(title, description, venue, tags, kind),
      // Above municipal listings, below the hand-picked marquee events.
      priority: kind === "Community" ? 5 : 6,
    }));
  });
}

/* ------------------------------------------------ Ticketmaster Discovery */

type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  description?: string;
  pleaseNote?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTBD?: boolean; timeTBD?: boolean } };
  images?: Array<{ url?: string; width?: number; ratio?: string }>;
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
  _embedded?: { venues?: Array<{ name?: string; city?: { name?: string }; address?: { line1?: string } }> };
};

/** Widest image at least 640px, so cards get something usable rather than a thumbnail. */
function ticketmasterImage(images: TicketmasterEvent["images"]) {
  const usable = (images ?? []).filter((image) => image.url?.startsWith("https://") && (image.width ?? 0) >= 640);
  return usable.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function ticketmasterCost(ranges: TicketmasterEvent["priceRanges"]) {
  const range = (ranges ?? [])[0];
  if (!range || typeof range.min !== "number") return "Ticket prices vary";
  const min = Math.round(range.min);
  const max = typeof range.max === "number" ? Math.round(range.max) : min;
  return min === max ? `$${min}` : `$${min}–$${max}`;
}

/**
 * Ticketed concerts, festivals and games within the radius.
 *
 * This is the only source that reliably carries touring live music and big
 * ticketed events; the municipal and community calendars never listed them.
 * Optional — without TICKETMASTER_API_KEY the source is simply skipped.
 */
function parseTicketmaster(json: string, todayKey: string, endKey: string): LiveEvent[] {
  let parsed: { _embedded?: { events?: TicketmasterEvent[] } };
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const items = parsed._embedded?.events ?? [];

  return items.flatMap((item, index) => {
    const dateKey = item.dates?.start?.localDate ?? "";
    if (!dateKey || dateKey < todayKey || dateKey > endKey) return [];

    const title = cleanHtml(item.name ?? "");
    if (!title) return [];
    const description = cleanHtml(item.info ?? item.description ?? item.pleaseNote ?? "");
    if (!familyFriendly(title, [], description)) return [];

    const place_ = (item._embedded?.venues ?? [])[0] ?? {};
    const venue = cleanHtml(place_.name ?? "");
    if (!venue) return [];
    const town = place_.city?.name?.trim() || titleCase(extractTown(`${venue} ${place_.address?.line1 ?? ""}`) ?? "") || "";
    if (!town) return [];

    const located = place(venue, town);
    if (located.distance > 25 || located.distancePrecision === "region") return [];

    const genres = (item.classifications ?? [])
      .flatMap((classification) => [classification.segment?.name, classification.genre?.name])
      .filter((name): name is string => Boolean(name) && name !== "Undefined");
    const kind = classify(title, `${description} ${genres.join(" ")}`, "Ticketmaster");
    const tags = [kind, ...genres.slice(0, 2)];
    const start = item.dates?.start;

    return [{
      id: `tm-${item.id ?? index}-${dateKey}`,
      area: town.toLowerCase() === "buffalo" ? "city" : "southtowns",
      town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey,
      time: start?.timeTBD || !start?.localTime ? "See listing" : formatTime(start.localTime),
      title, venue, ...located,
      description: describe(description, title, venue, town),
      cost: ticketmasterCost(item.priceRanges),
      source: "Ticketmaster", url: item.url ?? "", mapUrl: mapUrl(venue, town),
      tags,
      accent: ["purple", "coral", "sun", "sky", "mint"][index % 5],
      image: ticketmasterImage(item.images),
      today: dateKey === todayKey,
      kind, setting: inferSetting(title, description, venue, tags, kind),
      priority: 7,
    }];
  });
}

function inferTown(location: string, area: "southtowns" | "city") {
  const places = ["Orchard Park", "Hamburg", "West Seneca", "Eden", "Elma", "Boston", "Blasdell", "Lackawanna", "East Aurora", "Lancaster", "South Buffalo"];
  return places.find((place) => location.toLowerCase().includes(place.toLowerCase())) ?? (area === "city" ? "Buffalo" : "Orchard Park");
}

/** Venue-level coordinates and a real driving estimate, not a per-town constant. */
function place(venue: string, town: string) {
  const { distance, coords, precision } = distanceFromOrigin(venue, town);
  return { distance, lat: coords.lat, lon: coords.lon, distancePrecision: precision };
}

function parseIcs(ics: string, source: string, defaultArea: "southtowns" | "city", todayKey: string, endKey: string): LiveEvent[] {
  return parseIcalOccurrences(ics, todayKey, endKey, ZONE).flatMap((item, index) => {
    const { dateKey, title } = item;
    const description = cleanHtml(item.description);
    if (!familyFriendly(title, [], description)) return [];
    const venue = item.location || source;
    const sourceTown = source === "Town of Evans" ? "Lakeshore" : source === "West Seneca Recreation" ? "West Seneca" : source === "Hamburg Recreation" ? "Hamburg" : "";
    const town = sourceTown || inferTown(venue, defaultArea);
    const located = place(venue, town);
    if (located.distance > 25) return [];
    const area = town === "Buffalo" ? "city" : defaultArea;
    const sourceUrl = source === "Town of Orchard Park" ? "https://www.orchardparkny.gov/events/" : source === "Town of Evans" ? "https://townofevansny.gov/events/" : source === "West Seneca Recreation" ? "https://westsenecany.myrec.com/info/calendar/list.aspx" : source === "Hamburg Recreation" ? "https://www.townofhamburgny.gov/Calendar.aspx" : "https://www.buffalony.gov/calendar.aspx?CID=34&view=list";
    const url = item.url || sourceUrl;
    const kind = classify(title, description, source);
    const tags = [kind, source.includes("Orchard") ? "Orchard Park" : "Community"];
    const setting = inferSetting(title, description, venue, tags, kind);

    return [{
      id: `ics-${source}-${item.uid || index}-${dateKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      area, town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey,
      time: item.time, title, venue, ...located,
      description: describe(description, title, venue, town),
      cost: /\bfree\b/i.test(description) ? "Free" : "See listing",
      source, url, mapUrl: mapUrl(venue, town),
      tags,
      accent: ["coral", "sky", "mint", "sun", "purple"][index % 5],
      today: dateKey === todayKey, kind, setting,
      priority: kind === "Community" ? 2 : 4,
    }];
  });
}

/* ------------------------------------------------- scraped HTML listings */

/**
 * Step Out Buffalo mixes real events with standing restaurant promotions.
 * Keep its event inventory broad, while still dropping offers that are plainly
 * menu advertisements rather than something happening at a particular time.
 */
const STANDING_PROMOTION =
  /dish alert|pizza of the month|half[- ]?off|1\/2 price|\bspecials?\b|new menu|now serving|happy hour|\bdeal\b|new dish|menu item/i;

/** Listings that are technically scheduled but weak as a recommendation. */
const ROUTINE_FILLER =
  /church services?|toastmasters|weekly meetings?|networking|business related|sunday brunch|brunch (?:at|@|in the)|open studio hours?/i;

/** Signals that an event is likely worth making a plan around. */
const HIGH_INTEREST =
  /festival|concert|live music|comedy|theat(?:er|re)|tour\b|fair\b|market|workshop|class\b|parade|fireworks|film|movie|art show|craft show|tasting|trivia|bingo|hike|walk\b|run\b|yoga|dance|game\b|kids|family|museum|exhibit/i;

/** Chamber calendars are half member networking; that is not a day out. */
const MEMBER_BUSINESS =
  /chamber connections|book club|ribbon cutting|networking|mixer|luncheon|board of directors|annual meeting/i;

function stepOutInterest(item: ScrapedEvent) {
  const text = `${item.title} ${item.category}`;
  if (/cancelled|canceled/i.test(text)) return -100;
  let score = HIGH_INTEREST.test(text) ? 6 : 2;
  if (/festival|concert|comedy|theat(?:er|re)|tour\b|fair\b|parade|fireworks/i.test(text)) score += 3;
  if (ROUTINE_FILLER.test(text)) score -= 8;
  if (item.recurring) score -= 1;
  if (item.end > item.start) score -= 1;
  return score;
}

/** Stable per-event id fragment: the listing's own slug, not its position. */
function slugOf(url: string) {
  return (url.split("?")[0].replace(/\/+$/, "").split("/").pop() ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
}

/**
 * Turn scraped cards into events.
 *
 * Both scraped sources are regional rather than local — Step Out Buffalo lists
 * Jamestown and Niagara County alongside Orchard Park — so anything that cannot
 * be placed in a known town is dropped rather than allowed the flattering
 * UNKNOWN_DISTANCE fallback. `defaultTown` covers the one source whose cards
 * carry no address at all, the East Aurora Chamber.
 */
function parseScraped(
  items: ScrapedEvent[],
  source: string,
  parser: ScrapeParser,
  defaultArea: "southtowns" | "city",
  defaultTown: string,
  todayKey: string,
  endKey: string,
): LiveEvent[] {
  const stepOut = parser === "stepout";

  const scoredEvents = items.flatMap((item, index): Array<{ event: LiveEvent; interest: number }> => {
    if (item.end < todayKey || item.start > endKey) return [];
    const context = `${item.description} ${item.category}`;
    if (!familyFriendly(item.title, [], context, stepOut)) return [];
    const interest = stepOut ? stepOutInterest(item) : 0;
    if (stepOut && (STANDING_PROMOTION.test(item.title) || interest < 0)) return [];
    if (!stepOut && MEMBER_BUSINESS.test(item.title)) return [];

    const town = titleCase(extractTown(`${item.venue} ${item.address}`) ?? "") || defaultTown;
    if (!town) return [];
    // The chamber calendar names no venue, so the village itself is the label.
    const venue = item.venue || `Village of ${town}`;
    const located = place(venue, town);
    if (located.distance > 25 || located.distancePrecision === "region") return [];

    const kind = classify(item.title, context, source);
    const tags = [kind, item.category, item.recurring ? "Runs weekly" : "", AGE_GATED.test(`${item.title} ${context}`.toLowerCase()) ? "21+" : ""]
      .filter(Boolean)
      .slice(0, 4);

    return dateKeysInRange(item.start, item.end, todayKey, endKey).map((dateKey) => ({
      interest,
      event: {
        id: `scrape-${slugOf(item.url) || index}-${dateKey}`,
        area: town.toLowerCase() === "buffalo" ? "city" : defaultArea,
        town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey,
        time: item.time,
        title: item.title, venue, ...located,
        description: describe(item.description, item.title, venue, town),
        cost: /\bfree\b/i.test(`${item.title} ${item.description}`) ? "Free" : "See listing",
        source, url: item.url, mapUrl: mapUrl(item.venue, town),
        tags,
        accent: ["purple", "sky", "coral", "mint", "sun"][index % 5],
        image: item.image,
        today: dateKey === todayKey,
        kind, setting: inferSetting(item.title, item.description, venue, tags, kind),
        // Strong Step Out listings can rank alongside the other live feeds;
        // routine recurring listings remain useful but sit lower in the day.
        priority: parser === "stepout" ? Math.max(4, Math.min(8, interest)) : parser === "erieparks" ? 8 : 7,
      },
    }));
  });

  // Rank before limiting so source order cannot let filler crowd out a better
  // listing later in the page. Venue diversity prevents a fair's dozens of
  // micro-events from consuming the whole day.
  scoredEvents.sort((a, b) => b.interest - a.interest || b.event.priority - a.event.priority || a.event.time.localeCompare(b.event.time));
  const dailyLimit = parser === "stepout" ? 80 : 12;
  const perDay = new Map<string, number>();
  const perVenueDay = new Map<string, number>();
  return scoredEvents.filter(({ event }) => {
    const count = perDay.get(event.dateKey) ?? 0;
    if (count >= dailyLimit) return false;
    const venueKey = `${event.dateKey}|${event.venue.toLowerCase()}`;
    const venueCount = perVenueDay.get(venueKey) ?? 0;
    if (parser === "stepout" && venueCount >= 8) return false;
    perDay.set(event.dateKey, count + 1);
    perVenueDay.set(venueKey, venueCount + 1);
    return true;
  }).map(({ event }) => event);
}

type RecurringTemplate = {
  idPrefix: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  monthStart?: number; // 1-12
  monthEnd?: number; // 1-12
  area: "southtowns" | "city";
  town: string;
  time: string;
  title: string;
  venue: string;
  distance: number;
  description: string;
  cost: string;
  source: string;
  url: string;
  tags: string[];
  kind: EventKind;
  setting: EventSetting;
  priority: number;
};

const RECURRING_TEMPLATES: RecurringTemplate[] = [
  // Monday
  {
    idPrefix: "op-farmers-market",
    dayOfWeek: 1,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "Orchard Park",
    time: "4–7 PM",
    title: "Village of Orchard Park Farmers Market",
    venue: "Historic Orchard Park Train Depot · 395 S Lincoln Ave",
    distance: 1,
    description: "Local produce and community vendors gather at the depot for Orchard Park's convenient Monday evening market.",
    cost: "Free entry",
    source: "EverythingOP",
    url: "https://everythingop.com/series/village-of-orchard-park-farmers-market/",
    tags: ["Farmers market", "Local", "Depot"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 9,
  },
  {
    idPrefix: "levitt-la-krema",
    dayOfWeek: 1,
    monthStart: 6,
    monthEnd: 8,
    area: "city",
    town: "Buffalo",
    time: "5–8 PM · music 5:30",
    title: "Levitt VIBE Buffalo · Lawn Concert",
    venue: "Ralph C. Wilson Jr. Centennial Park",
    distance: 17,
    description: "Bring chairs or a picnic for a free lawn concert near the splash pad, with food trucks and community vendors.",
    cost: "Free",
    source: "Ralph Wilson Park",
    url: "https://rwparkbuffalo.org/levitt/",
    tags: ["Concert", "Picnic", "Splash pad"],
    kind: "Live music",
    setting: "outdoor",
    priority: 8,
  },
  // Tuesday
  {
    idPrefix: "au-some-morning",
    dayOfWeek: 2,
    area: "city",
    town: "Buffalo",
    time: "9:30–11:30 AM",
    title: "Au-Some Morning Edition",
    venue: "Explore & More Children's Museum",
    distance: 19,
    description: "A sensory-friendly museum morning welcomes autistic children, friends and families for calm play, art and tinkering.",
    cost: "Free · registration required",
    source: "Explore & More",
    url: "https://exploreandmore.org/education/au-some-evenings/",
    tags: ["Sensory-friendly", "Museum", "Kids"],
    kind: "Museums & culture",
    setting: "indoor",
    priority: 8,
  },
  // Wednesday
  {
    idPrefix: "east-aurora-market-wed",
    dayOfWeek: 3,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "East Aurora",
    time: "7 AM–1 PM",
    title: "East Aurora Farmers Market",
    venue: "115 Riley St · beside the Classic Rink",
    distance: 12,
    description: "The midweek edition offers seasonal produce, meat, cheese, flowers, baked goods and other local farm products.",
    cost: "Free entry",
    source: "Erie Grown",
    url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market",
    tags: ["Farmers market", "Produce", "Local"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 7,
  },
  {
    idPrefix: "midweek-hamburg-market",
    dayOfWeek: 3,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "Hamburg",
    time: "10 AM–2 PM",
    title: "Mid-Week Hamburg Farmers Market",
    venue: "Peace Park · 22 Buffalo St",
    distance: 8,
    description: "Restock on produce, baked goods, flowers and specialty foods at a compact family-friendly midweek market in the village.",
    cost: "Free entry",
    source: "WNY Thrive · Southtowns Regional Chamber",
    url: "https://www.wnythrive.com/updates/mid-week-farmers-market-819",
    tags: ["Farmers market", "Village", "Local food"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 8,
  },
  {
    idPrefix: "op-cruise-night",
    dayOfWeek: 3,
    monthStart: 5,
    monthEnd: 9,
    area: "southtowns",
    town: "Orchard Park",
    time: "4:30–8 PM",
    title: "Cruise Night at the Depot",
    venue: "Orchard Park BR&P Depot · 370–380 S Lincoln Ave",
    distance: 1,
    description: "Classic cars gather beside the historic train depot for an easy close-to-home evening with food available to purchase.",
    cost: "Free admission",
    source: "WNY Railway Historical Society",
    url: "https://www.wnyrhs.org/orchard-park-depot-events",
    tags: ["Classic cars", "Depot", "Local"],
    kind: "Community",
    setting: "both",
    priority: 8,
  },
  {
    idPrefix: "epic-storytime",
    dayOfWeek: 3,
    monthStart: 6,
    monthEnd: 8,
    area: "city",
    town: "Buffalo",
    time: "10:30 AM–12:30 PM",
    title: "EPIC Storytime at Canalside",
    venue: "Canalside Great Lawn",
    distance: 19,
    description: "Stories and extended literacy activities help children ages 0–8 and caregivers learn and play together outdoors.",
    cost: "Free · registration required",
    source: "Buffalo Waterfront",
    url: "https://buffalowaterfront.com/events/epic-childrens-programming",
    tags: ["Storytime", "Literacy", "Waterfront"],
    kind: "Outdoors",
    setting: "outdoor",
    priority: 7,
  },
  // Thursday
  {
    idPrefix: "west-seneca-market",
    dayOfWeek: 4,
    monthStart: 5,
    monthEnd: 9,
    area: "southtowns",
    town: "West Seneca",
    time: "4–7 PM",
    title: "West Seneca Farmers Market · Kids Day",
    venue: "West Seneca Town Center · 1250 Union Rd",
    distance: 9,
    description: "More than 50 local vendors, produce, baked goods, dinner options, acoustic music and extra kids activities take over the Town Center lawn.",
    cost: "Free entry",
    source: "Town of West Seneca summer flyer",
    url: "https://www.westseneca.gov/DocumentCenter/View/760/Summer-2026-Newsletter-FINAL?bidId=",
    tags: ["Farmers market", "Kids Day", "Food"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 9,
  },
  {
    idPrefix: "op-stadium-run",
    dayOfWeek: 4,
    area: "southtowns",
    town: "Orchard Park",
    time: "6 PM",
    title: "Bills Stadium Run with Nike",
    venue: "Wayland Brewing · 3740 N Buffalo St",
    distance: 2,
    description: "Join a roughly five-mile community run from Wayland Brewing to the new Bills stadium and back.",
    cost: "See registration",
    source: "EverythingOP",
    url: "https://everythingop.com/event/bills-stadium-run-with-nike/",
    tags: ["Running", "Bills", "Local"],
    kind: "Sports & active",
    setting: "outdoor",
    priority: 7,
  },
  // Friday
  {
    idPrefix: "canalside-kids",
    dayOfWeek: 5,
    monthStart: 6,
    monthEnd: 8,
    area: "city",
    town: "Buffalo",
    time: "10:30 AM",
    title: "Canalside for Kids Walking Tour",
    venue: "Waterway of Change Museum · Longshed",
    distance: 19,
    description: "A guide turns waterfront history into a one-mile, stroller-friendly adventure designed for children ages 5–10.",
    cost: "Free · registration required",
    source: "Explore Buffalo",
    url: "https://explorebuffalo.org/waterfront/canalside-for-kids/",
    tags: ["Tour", "History", "Kids"],
    kind: "Museums & culture",
    setting: "outdoor",
    priority: 7,
  },
  {
    idPrefix: "free-play-friday",
    dayOfWeek: 5,
    monthStart: 6,
    monthEnd: 8,
    area: "city",
    town: "Buffalo",
    time: "11 AM–1 PM",
    title: "Free Play Friday with Explore & More",
    venue: "Canalside · Pierce Lawn",
    distance: 19,
    description: "Explore & More brings free outdoor children's play, sports and hands-on activities to the waterfront.",
    cost: "Free",
    source: "Buffalo Waterfront",
    url: "https://buffalowaterfront.com/events/free-play-fridays-with-explore-more",
    tags: ["Play", "Kids", "Waterfront"],
    kind: "Outdoors",
    setting: "outdoor",
    priority: 7,
  },
  {
    idPrefix: "wild-robot",
    dayOfWeek: 5,
    monthStart: 6,
    monthEnd: 8,
    area: "city",
    town: "Buffalo",
    time: "7–10 PM · film at sunset",
    title: "Family Movie Night: The Wild Robot",
    venue: "Prospect Park · Connecticut & Niagara",
    distance: 17,
    description: "Bring a blanket or chair for the animated family adventure under the stars, with light refreshments while supplies last.",
    cost: "Free",
    source: "Buffalo Olmsted Parks",
    url: "https://www.bfloparks.org/event/movie-nights/2026-08-14/",
    tags: ["Movie", "Outdoor", "Family"],
    kind: "Museums & culture",
    setting: "outdoor",
    priority: 8,
  },
  // Saturday
  {
    idPrefix: "hamburg-farmers-market",
    dayOfWeek: 6,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "Hamburg",
    time: "7:30 AM–1 PM",
    title: "Hamburg Farmers Market",
    venue: "45 Church St · Village of Hamburg",
    distance: 8,
    description: "Shop a deep lineup of local growers and producers at this rain-or-shine Southtowns market running since 1977.",
    cost: "Free entry",
    source: "Erie Grown",
    url: "https://www3.erie.gov/eriegrown/eriegrown/eriegrown/growers/hamburg-farmers-market",
    tags: ["Farmers market", "Local food", "Rain or shine"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 8,
  },
  {
    idPrefix: "east-aurora-market-sat",
    dayOfWeek: 6,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "East Aurora",
    time: "7 AM–1 PM",
    title: "East Aurora Farmers Market",
    venue: "115 Riley St · beside the Classic Rink",
    distance: 12,
    description: "Browse seasonal produce, meat, cheese, flowers, baked goods and other farm products from Western New York vendors.",
    cost: "Free entry",
    source: "Erie Grown",
    url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market",
    tags: ["Farmers market", "Produce", "Local"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 7,
  },
  {
    idPrefix: "east-aurora-flea-sat",
    dayOfWeek: 6,
    area: "southtowns",
    town: "East Aurora",
    time: "9 AM–4:30 PM · gates 8:30",
    title: "East Aurora Flea & Farmers Market",
    venue: "Gallery 20A · 11167 Big Tree Rd",
    distance: 12,
    description: "Farm produce, antiques, collectibles and general merchandise fill 180,000 square feet of indoor and outdoor expo space every weekend.",
    cost: "Free entry",
    source: "East Aurora Events",
    url: "https://eastauroraevents.com/east-aurora-flea-market",
    tags: ["Flea market", "Antiques", "Produce"],
    kind: "Markets & food",
    setting: "both",
    priority: 7,
  },
  {
    idPrefix: "op-depot-museum",
    dayOfWeek: 6,
    area: "southtowns",
    town: "Orchard Park",
    time: "10 AM–2 PM",
    title: "Orchard Park Depot Museum Open",
    venue: "Orchard Park BR&P Depot · 370–380 S Lincoln Ave",
    distance: 1,
    description: "Step inside Orchard Park's restored railroad depot for a close-to-home look at local transportation history.",
    cost: "Free admission",
    source: "WNY Railway Historical Society",
    url: "https://www.wnyrhs.org/orchard-park-depot-events",
    tags: ["Railroad", "Museum", "Local history"],
    kind: "Museums & culture",
    setting: "indoor",
    priority: 7,
  },
  // Sunday
  {
    idPrefix: "south-buffalo-market",
    dayOfWeek: 0,
    monthStart: 6,
    monthEnd: 9,
    area: "southtowns",
    town: "South Buffalo",
    time: "9 AM–1 PM",
    title: "South Buffalo Farmers Market",
    venue: "Cazenovia Park Casino lawn",
    distance: 12,
    description: "Local growers and makers pair with live music, free 9:30 yoga and neighborhood bike rides for a lively Sunday market.",
    cost: "Free entry",
    source: "South Buffalo Farmers Market",
    url: "https://southbuffalofarmersmarket.com/visit-the-market",
    tags: ["Farmers market", "Music", "Yoga"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 8,
  },
  {
    idPrefix: "east-aurora-flea-sun",
    dayOfWeek: 0,
    area: "southtowns",
    town: "East Aurora",
    time: "9 AM–4:30 PM · gates 8:30",
    title: "East Aurora Flea & Farmers Market",
    venue: "Gallery 20A · 11167 Big Tree Rd",
    distance: 12,
    description: "The Sunday half of the weekend market, with the same mix of farm stands, antiques dealers and general merchandise indoors and out.",
    cost: "Free entry",
    source: "East Aurora Events",
    url: "https://eastauroraevents.com/east-aurora-flea-market",
    tags: ["Flea market", "Antiques", "Produce"],
    kind: "Markets & food",
    setting: "both",
    priority: 7,
  },
  {
    idPrefix: "eden-farmers-market",
    dayOfWeek: 0,
    monthStart: 5,
    monthEnd: 10,
    area: "southtowns",
    town: "Eden",
    time: "9 AM–1 PM",
    title: "Eden Farmers Market",
    venue: "Eden Community Park · 8712 Sandrock Rd",
    distance: 16,
    description: "A small-town Sunday market with produce, baked goods and local makers on the green.",
    cost: "Free entry",
    source: "Eden Community Association",
    url: "https://edenny.gov/news/",
    tags: ["Farmers market", "Local", "Small town"],
    kind: "Markets & food",
    setting: "outdoor",
    priority: 6,
  },
  {
    idPrefix: "knox-farm-trail-walk",
    dayOfWeek: 6,
    monthStart: 4,
    monthEnd: 10,
    area: "southtowns",
    town: "East Aurora",
    time: "9–11 AM",
    title: "Guided Trail Walk",
    venue: "Knox Farm State Park",
    distance: 12,
    description: "A relaxed, family-paced loop through meadow and woodland trails on the former Knox estate.",
    cost: "Free · Empire Pass or day-use fee for parking",
    source: "Knox Farm State Park",
    url: "https://parks.ny.gov/parks/knoxfarm/",
    tags: ["Hiking", "Nature", "Free"],
    kind: "Outdoors",
    setting: "outdoor",
    priority: 6,
  },
  {
    idPrefix: "chestnut-ridge-family-hike",
    dayOfWeek: 0,
    monthStart: 4,
    monthEnd: 10,
    area: "southtowns",
    town: "Orchard Park",
    time: "10 AM–noon",
    title: "Chestnut Ridge Family Hike",
    venue: "Chestnut Ridge Park",
    distance: 3,
    description: "Easy trails, playgrounds and the Eternal Flame waterfall make this an easy Sunday morning close to Orchard Park.",
    cost: "Free · parking fee on peak days",
    source: "Erie County Parks",
    url: "https://www3.erie.gov/parks/chestnut-ridge-park",
    tags: ["Hiking", "Nature", "Waterfall"],
    kind: "Outdoors",
    setting: "outdoor",
    priority: 6,
  },
  {
    idPrefix: "op-library-lego-club",
    dayOfWeek: 2,
    area: "southtowns",
    town: "Orchard Park",
    time: "4–5 PM",
    title: "LEGO Club",
    venue: "Orchard Park Public Library",
    distance: 1,
    description: "Free-build with the library's LEGO collection in a drop-in, all-ages session close to home.",
    cost: "Free · drop-in",
    source: "B&ECPL",
    url: "https://www.buffalolib.org/locations-hours/orchard-park-public-library",
    tags: ["LEGO", "Kids", "Drop-in"],
    kind: "Library",
    setting: "indoor",
    priority: 5,
  },
  {
    idPrefix: "boston-town-band-shell",
    dayOfWeek: 4,
    monthStart: 6,
    monthEnd: 8,
    area: "southtowns",
    town: "Boston",
    time: "6:30–8 PM",
    title: "Boston Town Band Shell Concert",
    venue: "Boston Town Park",
    distance: 17,
    description: "A free summer evening concert on the town green — bring chairs and a picnic.",
    cost: "Free",
    source: "Town of Boston",
    url: "https://www.bostonny.gov/events",
    tags: ["Concert", "Free", "Picnic"],
    kind: "Live music",
    setting: "outdoor",
    priority: 6,
  },
  {
    idPrefix: "west-seneca-movie-night",
    dayOfWeek: 5,
    monthStart: 6,
    monthEnd: 8,
    area: "southtowns",
    town: "West Seneca",
    time: "8:30 PM · at dusk",
    title: "Movies in the Park",
    venue: "Harlem Road Community Center",
    distance: 8,
    description: "A free outdoor family movie night on the lawn, weather permitting.",
    cost: "Free",
    source: "Town of West Seneca",
    url: "https://www.westseneca.gov/calendar.aspx",
    tags: ["Movie", "Outdoor", "Family"],
    kind: "Museums & culture",
    setting: "outdoor",
    priority: 6,
  },
  {
    idPrefix: "bisons-game",
    dayOfWeek: 0,
    monthStart: 4,
    monthEnd: 9,
    area: "city",
    town: "Buffalo",
    time: "6:35 PM first pitch",
    title: "Bisons Super Hero Night",
    venue: "Sahlen Field",
    distance: 19,
    description: "A family baseball night adds Marvel costume photos, a comic giveaway for early arrivals and postgame fireworks.",
    cost: "$22 single · $99 family pack",
    source: "Buffalo Bisons",
    url: "https://www.milb.com/buffalo/events/marvel",
    tags: ["Baseball", "Super heroes", "Fireworks"],
    kind: "Sports & active",
    setting: "outdoor",
    priority: 9,
  },
];

type SpecificFeatured = {
  id: string;
  area: "southtowns" | "city";
  town: string;
  dateKey: string;
  endDateKey?: string;
  time: string;
  title: string;
  venue: string;
  distance: number;
  description: string;
  cost: string;
  source: string;
  url: string;
  tags: string[];
  kind: EventKind;
  setting: EventSetting;
  priority: number;
};

function generateDynamicRecurringEvents(todayKey: string, endKey: string): LiveEvent[] {
  const events: LiveEvent[] = [];
  let current = todayKey;
  let dayOffset = 0;

  while (current <= endKey) {
    const d = new Date(`${current}T12:00:00Z`);
    const dayOfWeek = d.getUTCDay();
    const month = d.getUTCMonth() + 1;

    for (const template of RECURRING_TEMPLATES) {
      if (template.dayOfWeek === dayOfWeek) {
        if (template.monthStart && template.monthEnd) {
          if (month < template.monthStart || month > template.monthEnd) continue;
        }

        const date = formatDate(current);
        const day = dayLabel(current, todayKey);
        events.push({
          id: `${template.idPrefix}-${current}`,
          area: template.area,
          town: template.town,
          day,
          date,
          dateKey: current,
          time: template.time,
          title: template.title,
          venue: template.venue,
          ...place(template.venue, template.town),
          description: template.description,
          cost: template.cost,
          source: template.source,
          url: template.url,
          mapUrl: mapUrl(template.venue, template.town),
          tags: template.tags,
          accent: ["coral", "sun", "mint", "sky", "purple"][(events.length + dayOffset) % 5],
          today: current === todayKey,
          kind: template.kind,
          setting: template.setting,
          priority: template.priority,
        });
      }
    }

    current = addDays(current, 1);
    dayOffset++;
  }

  return events;
}

/**
 * Date of the last human pass over the marquee list below.
 *
 * These entries are hand-written and cannot refresh themselves, so a stale list
 * quietly empties the spotlight rail. The warning is the reminder to revisit.
 */
const FEATURED_REVIEWED_THROUGH = "2026-08-31";

/**
 * A short hand-picked list of the season's genuinely big draws.
 *
 * Deliberately small: one-off dated events belong in a live feed wherever one
 * exists. Only add something here when no feed carries it and missing it would
 * be embarrassing.
 */
function featuredMajorEvents(todayKey: string, endKey: string): LiveEvent[] {
  if (todayKey > FEATURED_REVIEWED_THROUGH) {
    console.warn(`[events] featured list not reviewed since ${FEATURED_REVIEWED_THROUGH}; entries may be stale`);
  }
  const specific: SpecificFeatured[] = [
    {
      id: "erie-county-fair",
      area: "southtowns",
      town: "Hamburg",
      dateKey: todayKey,
      endDateKey: "2026-08-23",
      time: "11 AM–10 PM · midway noon–11",
      title: "Erie County Fair",
      venue: "Hamburg Fairgrounds · 5600 McKinley Pkwy",
      distance: 6,
      description: "The Southtowns' giant annual fair packs rides, farm animals, 4-H exhibits, food, live entertainment and special daily programs into one full-day outing.",
      cost: "$19 adult · 12 & under free · special-day discounts",
      source: "Erie County Fair",
      url: "https://www.ecfair.org/p/info/admissionparking",
      tags: ["Fair", "Rides", "Animals"],
      kind: "Fairs & festivals",
      setting: "both",
      priority: 10,
    },
    {
      id: "destination-dinosaur",
      area: "city",
      town: "Buffalo",
      dateKey: todayKey,
      endDateKey: "2026-08-31",
      time: "10 AM–5 PM · shows noon & 2",
      title: "Destination Dinosaur",
      venue: "Buffalo Zoo",
      distance: 17,
      description: "Walk among life-size animatronic dinosaurs, dig for fossils and catch two educational dino shows during a flexible zoo day.",
      cost: "$25.95 adult · $19.95 child",
      source: "Buffalo Zoo",
      url: "https://buffalozoo.org/series/destination-dinosaur/",
      tags: ["Zoo", "Dinosaurs", "All day"],
      kind: "Museums & culture",
      setting: "both",
      priority: 9,
    },
  ];

  return specific.flatMap((item, index) => {
    const activeEnd = item.endDateKey ?? item.dateKey;
    if (activeEnd < todayKey || item.dateKey > endKey) return [];
    const dateKey = item.dateKey < todayKey ? todayKey : item.dateKey;
    const date = item.endDateKey ? `${formatDate(dateKey)}–${formatDate(item.endDateKey)}` : formatDate(dateKey);
    return [{
      ...item,
      ...place(item.venue, item.town),
      dateKey,
      date,
      day: dayLabel(dateKey, todayKey),
      today: dateKey === todayKey,
      mapUrl: mapUrl(item.venue, item.town),
      accent: ["coral", "sun", "mint", "sky", "purple"][index % 5],
    }];
  });
}

function capLibraries(events: LiveEvent[]) {
  const library = events.filter((event) => event.kind === "Library").sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.distance - b.distance);
  const nonLibrary = events.filter((event) => event.kind !== "Library");
  const byVenue = new Map<string, number>();
  const byDayArea = new Map<string, number>();
  const selected = library.filter((event) => {
    const venueCount = byVenue.get(event.venue) ?? 0;
    const dayAreaKey = `${event.dateKey}|${event.area}`;
    const dayAreaCount = byDayArea.get(dayAreaKey) ?? 0;
    if (venueCount >= 3 || dayAreaCount >= 3) return false;
    byVenue.set(event.venue, venueCount + 1);
    byDayArea.set(dayAreaKey, dayAreaCount + 1);
    return true;
  }).slice(0, 32);
  return [...nonLibrary, ...selected];
}

const TITLE_STOPWORDS = new Set(["the", "and", "for", "with", "annual", "village", "town", "city", "series", "event", "events", "of", "at", "in", "on", "a", "an"]);

/** Significant words in a title, for loose matching between two sources. */
function titleWords(title: string) {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((word) => word.length > 2 && !TITLE_STOPWORDS.has(word)),
  );
}

/**
 * Drop hand-written recurring entries that a live feed now covers.
 *
 * `dedupe` only catches exact title+venue collisions, so the templated
 * "Village of Orchard Park Farmers Market" survived alongside EverythingOP's
 * listing of the same market at a slightly differently-worded depot. The
 * template is the fallback: when a real feed carries the event that day, the
 * live copy wins, because it has the current time, cost and image.
 */
function dropSupersededRecurring(recurring: LiveEvent[], live: LiveEvent[]) {
  const liveByDate = new Map<string, Set<string>[]>();
  for (const event of live) {
    const bucket = liveByDate.get(event.dateKey) ?? [];
    bucket.push(titleWords(event.title));
    liveByDate.set(event.dateKey, bucket);
  }

  return recurring.filter((event) => {
    const sameDay = liveByDate.get(event.dateKey);
    if (!sameDay) return true;
    const words = titleWords(event.title);
    if (words.size === 0) return true;
    return !sameDay.some((other) => {
      if (other.size === 0) return false;
      let shared = 0;
      for (const word of words) if (other.has(word)) shared += 1;
      return shared / Math.min(words.size, other.size) >= 0.6;
    });
  });
}

function dedupe(events: LiveEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, "")}|${event.dateKey}|${event.venue.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Inclusive occurrence keys, clipped to the API's visible date window.
 *  Spans longer than 14 days are almost certainly scraped tour listings or
 *  season-long ranges, not genuine daily events — collapse them to the first
 *  date rather than cloning the event onto every intervening day. */
function dateKeysInRange(startKey: string, endKey: string, windowStart: string, windowEnd: string) {
  const first = startKey < windowStart ? windowStart : startKey;
  const last = endKey > windowEnd ? windowEnd : endKey;
  if (first > last) return [];
  // Safety cap: a 14+ day span is a season/tour, not a daily event.
  const daySpan = Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000);
  if (daySpan > 14) return [first];
  const keys: string[] = [];
  for (let key = first; key <= last; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/** Cold refresh fans out to every feed plus image lookups; the default 10s is tight. */
export const maxDuration = 30;

const CACHE_TTL_SECONDS = 2 * 3600;
/** How long a payload stays servable as stale past its freshness window. */
const CACHE_GRACE_SECONDS = 6 * 3600;
/** The safety net keeps a week, so a multi-day outage still has real listings. */
const LAST_GOOD_TTL_SECONDS = 7 * 24 * 3600;
// Eight days at an 80-card Step Out allowance plus municipal/library feeds can
// legitimately exceed 600. Keep a generous payload ceiling so later week days
// are not truncated after the first few busy dates.
const MAX_EVENTS = 1_000;
const FULL_CACHE_CONTROL = {
  browser: "public, max-age=60, must-revalidate",
  cdn: "public, max-age=300, stale-while-revalidate=60",
  vercel: "public, max-age=900, stale-while-revalidate=60",
};
const PARTIAL_CACHE_CONTROL = {
  browser: "public, max-age=15, must-revalidate",
  cdn: "public, max-age=120, stale-while-revalidate=60",
  vercel: "public, max-age=120, stale-while-revalidate=60",
};
const DEGRADED_CACHE_CONTROL = {
  browser: "public, max-age=0, must-revalidate",
  cdn: "public, max-age=60",
  vercel: "public, max-age=60",
};

function cacheKeyFor(todayKey: string) {
  return `events:balanced-v11:${todayKey}`;
}

/**
 * Date-independent key for the newest payload that ever built successfully.
 *
 * The per-day key expires with its day, so the first reader on a morning when
 * every feed is down used to fall all the way through to the bundled snapshot
 * — a hardcoded copy from months ago. Yesterday's real listings are wrong
 * about which day it is; the snapshot is wrong about everything.
 */
const LAST_GOOD_KEY = "events:balanced-v11:last-good";
const REFRESH_LOCK_SECONDS = maxDuration + 5;

function validPayload(value: unknown): EventsPayload | null {
  const parsed = eventsPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function responseHeaders(payload: EventsPayload, cacheStatus: string) {
  const controls = payload.freshness.state !== "fresh"
    ? DEGRADED_CACHE_CONTROL
    : payload.sources.some((source) => !source.ok) ? PARTIAL_CACHE_CONTROL : FULL_CACHE_CONTROL;
  return {
    "Cache-Control": controls.browser,
    "CDN-Cache-Control": controls.cdn,
    "Vercel-CDN-Cache-Control": controls.vercel,
    "X-Cache": cacheStatus,
  };
}

async function recordSourceHealth(sources: SourceHealth[], builtFor: string) {
  const now = new Date().toISOString();
  const previous = await getCachedEntry<HealthSnapshot>(EVENTS_HEALTH_KEY);
  const previousHealth = healthSnapshotSchema.safeParse(previous?.data);
  const byName = new Map((previousHealth.success ? previousHealth.data.sources : []).map((source) => [source.name, source]));
  const snapshot: HealthSnapshot = {
    checkedAt: now,
    builtFor,
    healthy: sources.some((source) => source.ok),
    sources: sources.map((source) => {
      const before = byName.get(source.name);
      return {
        ...source,
        lastSuccessAt: source.ok ? now : before?.lastSuccessAt,
        consecutiveFailures: source.ok ? 0 : (before?.consecutiveFailures ?? 0) + 1,
      };
    }),
  };
  try {
    await setCachedData(EVENTS_HEALTH_KEY, snapshot, LAST_GOOD_TTL_SECONDS, 0);
  } catch (error) {
    console.error("[events] failed to persist source health", error);
  }
}

function withFreshness(
  payload: EventsPayload,
  state: EventsPayload["freshness"]["state"],
  ageSeconds: number,
): EventsPayload {
  return { ...payload, freshness: { ...payload.freshness, state, ageSeconds, store: cacheBackendName() } };
}

function cachedFreshness(payload: EventsPayload, stale: boolean): EventsPayload["freshness"]["state"] {
  if (payload.freshness.state === "last-good") return "last-good";
  return stale ? "stale" : payload.freshness.state;
}

/**
 * Fetch every source, normalise, enrich and cache.
 *
 * Exported so the scheduled worker can warm the cache each morning — otherwise
 * the first visitor after the TTL expires pays for all live feed fetches.
 */
function hasTicketmasterKey() {
  return Boolean(process.env.TICKETMASTER_API_KEY);
}

/**
 * Concerts, festivals and games inside the radius, when a key is configured.
 * Returns an empty list otherwise, so the app runs unchanged without one.
 */
function ticketmasterRequest(todayKey: string, endKey: string, headers: HeadersInit) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];
  const query = new URLSearchParams({
    apikey: apiKey,
    latlong: `${ORIGIN.lat},${ORIGIN.lon}`,
    radius: "25",
    unit: "miles",
    startDateTime: `${todayKey}T00:00:00Z`,
    endDateTime: `${endKey}T23:59:59Z`,
    size: "100",
    sort: "date,asc",
  });
  return [
    (async () => {
      const started = Date.now();
      const text = await fetchWithTimeout(`https://app.ticketmaster.com/discovery/v2/events.json?${query}`, headers, FEED_TIMEOUT_MS);
      return { name: "Ticketmaster", kind: "ticketmaster" as const, area: "city" as const, text, durationMs: Date.now() - started };
    })(),
  ];
}

/**
 * The Events Calendar caps a response page at 50 records. Buffalo Rising often
 * exceeds that across an eight-day window, so fetch the advertised remaining
 * pages instead of silently treating the first page as the complete calendar.
 */
async function fetchTribePages(origin: string, todayKey: string, endKey: string, headers: HeadersInit) {
  const url = new URL(`${origin}/wp-json/tribe/events/v1/events`);
  url.searchParams.set("start_date", todayKey);
  url.searchParams.set("end_date", endKey);
  url.searchParams.set("per_page", "50");

  const firstText = await fetchWithTimeout(url.toString(), headers, FEED_TIMEOUT_MS);
  let first: { events?: TribeEvent[]; total_pages?: number };
  try {
    first = JSON.parse(firstText);
  } catch {
    return firstText;
  }

  const totalPages = Math.min(Math.max(first.total_pages ?? 1, 1), 5);
  if (totalPages === 1) return firstText;
  const remaining = await Promise.allSettled(
    Array.from({ length: totalPages - 1 }, async (_, index) => {
      const pageUrl = new URL(url);
      pageUrl.searchParams.set("page", String(index + 2));
      return fetchWithTimeout(pageUrl.toString(), headers, FEED_TIMEOUT_MS);
    }),
  );
  const events = [...(first.events ?? [])];
  for (const result of remaining) {
    if (result.status === "rejected") {
      console.warn("[events] a later calendar page failed; retaining successful pages", result.reason);
      continue;
    }
    try {
      const page = JSON.parse(result.value) as { events?: TribeEvent[] };
      if (Array.isArray(page.events)) events.push(...page.events);
    } catch {
      // Keep the successful pages; source health will report their event count.
    }
  }
  return JSON.stringify({ ...first, events });
}

/** Visit Buffalo paginates its HTML calendar with `tribe_paged`. Six pages
 * cover the visible week in normal conditions while keeping the scrape bounded
 * if the site grows a much longer archive. */
async function fetchVisitBuffaloPages(url: string, todayKey: string, endKey: string, headers: HeadersInit) {
  const firstUrl = new URL(url);
  // Visit Buffalo exposes the same controls as query parameters. Supplying the
  // exact window keeps its pagination focused on the dates the app displays.
  firstUrl.searchParams.set("event-date-from", todayKey);
  firstUrl.searchParams.set("event-date-to", endKey);
  const visitHeaders = { ...headers, "user-agent": "Wget/1.21.4" };
  const firstText = await fetchWithTimeout(firstUrl.toString(), visitHeaders, FEED_TIMEOUT_MS, 8_000_000);
  const pages = await Promise.all(
    Array.from({ length: 5 }, async (_, index) => {
      const pageUrl = new URL(firstUrl);
      pageUrl.searchParams.set("tribe_paged", String(index + 2));
      return fetchWithTimeout(pageUrl.toString(), visitHeaders, FEED_TIMEOUT_MS, 8_000_000);
    }),
  );
  return [firstText, ...pages].join("\n");
}

async function buildEventsPayload(): Promise<EventsPayload> {
  const todayKey = localDateKey();
  const endKey = addDays(todayKey, 7);
  const headers = { "user-agent": USER_AGENT };

  // 2. Fetch live feeds with timeouts. Fewer, healthier feeds means we can
  //    afford to wait a little longer on each than the old 4s.
  const requests = [
    ...LIBRARY_FEEDS.map(async ([name, url]) => {
      const started = Date.now();
      const text = await fetchWithTimeout(url, headers, FEED_TIMEOUT_MS);
      return { name, kind: "library" as const, text, durationMs: Date.now() - started };
    }),
    ...TRIBE_FEEDS.map(async ([name, origin, area, town]) => {
      const started = Date.now();
      const text = await fetchTribePages(origin, todayKey, endKey, headers);
      return { name, kind: "tribe" as const, area: area as "southtowns" | "city", town, regional: name === "Buffalo Rising", text, durationMs: Date.now() - started };
    }),
    ...ICS_FEEDS.map(async ([name, url, area]) => {
      const started = Date.now();
      const text = await fetchWithTimeout(url, headers, FEED_TIMEOUT_MS);
      return { name, kind: "ics" as const, area: area as "southtowns" | "city", text, durationMs: Date.now() - started };
    }),
    ...SCRAPED_FEEDS.map(async ([name, url, parser, area, town]) => {
      const started = Date.now();
      // Step Out's all-events index is intentionally exhaustive and is larger
      // than the compact category pages; keep the tighter limit for every
      // other scrape while allowing this one page to be read completely.
      const text = parser === "visitbuffalo"
        ? await fetchVisitBuffaloPages(url, todayKey, endKey, headers)
        : await fetchWithTimeout(
            url,
            { ...headers, "accept-encoding": "gzip, deflate" },
            FEED_TIMEOUT_MS,
            parser === "stepout" ? 8_000_000 : 3_000_000,
          );
      return { name, kind: "scrape" as const, parser, area, town, text, durationMs: Date.now() - started };
    }),
    ...ticketmasterRequest(todayKey, endKey, headers),
  ];

  // Feed names, in the same order as `requests`, so a rejection can still say
  // which source failed instead of the old anonymous "Source unavailable".
  const requestNames = [
    ...LIBRARY_FEEDS.map(([name]) => name),
    ...TRIBE_FEEDS.map(([name]) => name),
    ...ICS_FEEDS.map(([name]) => name),
    ...SCRAPED_FEEDS.map(([name]) => name),
    ...(hasTicketmasterKey() ? ["Ticketmaster"] : []),
  ];

  const settled = await Promise.allSettled(requests);
  const events: LiveEvent[] = [];
  const sources = settled.map((result, index) => {
    const name = requestNames[index];
    if (result.status === "rejected") {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[events] source failed: ${name} — ${error}`);
      return { name, ok: false, error };
    }
    const before = events.length;
    try {
      if (result.value.kind === "library") {
        events.push(...parseLibrary(result.value.text, todayKey, endKey));
      } else if (result.value.kind === "tribe") {
        events.push(
          ...parseTribe(result.value.text, name, result.value.area, result.value.town, todayKey, endKey, result.value.regional),
        );
      } else if (result.value.kind === "ticketmaster") {
        events.push(...parseTicketmaster(result.value.text, todayKey, endKey));
      } else if (result.value.kind === "scrape") {
        const scraped =
        result.value.parser === "stepout"
          ? parseStepOutBuffalo(result.value.text, todayKey)
          : result.value.parser === "visitbuffalo"
            ? parseVisitBuffalo(result.value.text, todayKey)
          : result.value.parser === "erieparks"
              ? parseErieParks(result.value.text)
              : parseGrowthZone(result.value.text);
        events.push(
          ...parseScraped(scraped, name, result.value.parser, result.value.area, result.value.town, todayKey, endKey),
        );
      } else {
        events.push(...parseIcs(result.value.text, name, result.value.area, todayKey, endKey));
      }
      const count = events.length - before;
      // A valid calendar can legitimately be quiet inside an eight-day window.
      // It still responded and should not trigger the site's outage warning.
      if (count === 0) console.info(`[events] source has no matching events in the requested window: ${name}`);
      return {
        name,
        ok: true,
        count,
        durationMs: result.value.durationMs,
      };
    } catch (error) {
      events.splice(before);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[events] source could not be parsed: ${name} — ${message}`);
      return { name, ok: false, error: message, durationMs: result.value.durationMs };
    }
  });

  // 3. Merge: live feeds first, then hand-written recurring entries only where
  //    no live feed already covers them, then the marquee attractions.
  const recurring = dropSupersededRecurring(generateDynamicRecurringEvents(todayKey, endKey), events);
  const major = featuredMajorEvents(todayKey, endKey);
  const allEvents = [...major, ...recurring, ...events];

  const validEvents = allEvents.flatMap((event) => {
    const parsed = liveEventSchema.safeParse({ ...event, image: safeImage(event.image) });
    if (!parsed.success) {
      console.warn(`[events] dropped invalid event: ${event.title}`);
      return [];
    }
    return [parsed.data];
  });
  const normalized = capLibraries(dedupe(validEvents)).sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || b.priority - a.priority || a.distance - b.distance || a.time.localeCompare(b.time)
  ).slice(0, MAX_EVENTS);

  // 4. Give image-less events a real preview picture where the source page has one
  const needImages = normalized.filter((event) => !event.image);
  const images = await resolveImages(needImages.map((event) => event.url));
  const withImages = normalized.map((event) =>
    event.image || !images.has(event.url) ? event : { ...event, image: images.get(event.url) },
  );

  const mix = withImages.reduce<Record<string, number>>((counts, event) => {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    return counts;
  }, {});

  const payload: EventsPayload = {
    events: withImages,
    count: withImages.length,
    updatedAt: new Date().toISOString(),
    window: { from: todayKey, to: endKey },
    sources,
    mix,
    freshness: { state: "fresh", ageSeconds: 0, builtFor: todayKey, store: cacheBackendName() },
  };

  const validated = validPayload(payload);
  if (!validated) throw new Error("normalized events payload failed schema validation");
  await recordSourceHealth(sources, todayKey);

  // 5. A build that produced nothing means every source failed at once — a
  //    network partition or a bad deploy, not a genuinely empty week. Serve
  //    the last payload that worked instead of an empty page, and do not
  //    overwrite the safety net with the failure.
  if (!sources.some((source) => source.ok)) {
    const rescued = await lastGoodPayload();
    const degraded = rescued ? { ...rescued, sources } : withFreshness(validated, "stale", 0);
    await cacheDegraded(todayKey, degraded);
    return degraded;
  }

  // 6. Cache every usable result for today, but only replace the week-long
  // safety copy when at least two independent sources produced a useful set.
  const promoteLastGood = sources.filter((source) => source.ok).length >= 2 && validated.events.length >= 5;
  const writes = await Promise.allSettled([
    setCachedData(cacheKeyFor(todayKey), validated, CACHE_TTL_SECONDS, CACHE_GRACE_SECONDS),
    ...(promoteLastGood ? [setCachedData(LAST_GOOD_KEY, validated, LAST_GOOD_TTL_SECONDS, 0)] : []),
  ]);
  for (const write of writes) if (write.status === "rejected") console.error("[events] cache write failed", write.reason);
  if (!promoteLastGood) console.warn("[events] partial build retained without replacing last-good cache");

  return validated;
}

/** The newest payload that ever built, labelled with how old it actually is. */
async function lastGoodPayload(): Promise<EventsPayload | null> {
  const entry = await getCachedEntry<EventsPayload>(LAST_GOOD_KEY);
  const payload = validPayload(entry?.data);
  if (!entry || !payload?.events.length) return null;
  const todayKey = localDateKey();
  const endKey = addDays(todayKey, 7);
  const events = payload.events
    .filter((event) => event.dateKey >= todayKey && event.dateKey <= endKey)
    .map((event) => ({
      ...event,
      today: event.dateKey === todayKey || undefined,
      day: dayLabel(event.dateKey, todayKey),
      date: formatDate(event.dateKey),
    }));
  if (!events.length) return null;
  const mix = events.reduce<Record<string, number>>((counts, event) => {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    return counts;
  }, {});
  console.warn(`[events] serving last-good payload from ${payload.window.from} (${entry.ageSeconds}s old)`);
  return withFreshness({ ...payload, events, count: events.length, mix, window: { from: todayKey, to: endKey } }, "last-good", entry.ageSeconds);
}

async function cacheDegraded(todayKey: string, payload: EventsPayload) {
  try {
    await setCachedData(cacheKeyFor(todayKey), payload, 300, 300);
  } catch (error) {
    console.error("[events] degraded-cache write failed", error);
  }
}

const localRebuilds = new Map<string, Promise<EventsPayload>>();

function revalidateOnce(todayKey: string) {
  const existing = localRebuilds.get(todayKey);
  if (existing) return existing;
  const rebuild = (async () => {
    const acquired = await acquireCacheLock(`events:refresh-lock:${todayKey}`, REFRESH_LOCK_SECONDS);
    if (acquired) return buildEventsPayload();

    // Another instance owns the rebuild. Give it a short window to publish the
    // shared result instead of launching a duplicate thirteen-source fan-out.
    for (const waitMs of [200, 400, 800]) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const entry = await getCachedEntry<EventsPayload>(cacheKeyFor(todayKey));
      const payload = validPayload(entry?.data);
      if (entry && !entry.stale && payload?.events.length) return withFreshness(payload, payload.freshness.state, entry.ageSeconds);
    }
    const rescued = await lastGoodPayload();
    if (rescued) return rescued;
    return buildEventsPayload();
  })().finally(() => localRebuilds.delete(todayKey));
  localRebuilds.set(todayKey, rebuild);
  return rebuild;
}

export async function GET() {
  const todayKey = localDateKey();
  const cached = await getCachedEntry<EventsPayload>(cacheKeyFor(todayKey));
  const cachedPayload = validPayload(cached?.data);

  if (cached && cachedPayload?.events.length) {
    // 1. Warm and inside the two-hour freshness window: serve it as-is.
    if (!cached.stale) {
      const payload = withFreshness(cachedPayload, cachedFreshness(cachedPayload, false), cached.ageSeconds);
      return Response.json(payload, { headers: responseHeaders(payload, "HIT") });
    }

    // 2. Past the fresh window but inside the grace period: answer immediately from
    //    the stale copy and rebuild after the response is sent. Nobody waits
    //    on a dozen live feeds just because they were the first one back.
    after(async () => {
      try {
        await revalidateOnce(todayKey);
      } catch (error) {
        console.error("[events] background revalidate failed", error);
      }
    });
    const payload = withFreshness(cachedPayload, cachedFreshness(cachedPayload, true), cached.ageSeconds);
    return Response.json(payload, { headers: responseHeaders(payload, "STALE") });
  }

  // 3. Nothing cached: build it, and fall back to the last good payload if the
  //    build itself throws rather than merely coming back thin.
  try {
    const payload = await revalidateOnce(todayKey);
    return Response.json(payload, { headers: responseHeaders(payload, "MISS") });
  } catch (error) {
    console.error("[events] build failed", error);
    const rescued = await lastGoodPayload();
    if (rescued) return Response.json(rescued, { headers: responseHeaders(rescued, "LAST-GOOD") });
    throw error;
  }
}

/** Authenticated, uncached refresh used by the dedicated Vercel Cron route. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const payload = await revalidateOnce(localDateKey());
    const healthy = payload.freshness.state === "fresh" && payload.sources.some((source) => source.ok);
    return Response.json({ refreshed: healthy, count: payload.count, freshness: payload.freshness }, {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[events] scheduled refresh failed", error);
    return Response.json({ error: "Scheduled refresh failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
