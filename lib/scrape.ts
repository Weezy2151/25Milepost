/**
 * Scrapers for the good listings that publish no feed at all.
 *
 * Every other source in this app hands over iCalendar, RSS or JSON. These three
 * do not, and each covers something nothing else does:
 *
 *   Step Out Buffalo   — the only place in the region that reliably lists
 *                        weekly trivia, bar bingo and brewery tastings.
 *   East Aurora Chamber — the only machine-readable East Aurora calendar that
 *                        exists; the Advertiser's site does not answer at all
 *                        and the village calendar is board meetings only.
 *   Erie County Parks  — the county's ranger-led hikes and kids-and-families
 *                        programs, which appear on no other calendar here.
 *
 * Scraping rendered HTML is brittle by nature, so the parsers only reach for
 * fields the markup labels explicitly (a class name, a schema.org itemprop) and
 * drop anything they cannot read rather than guessing. A source that starts
 * returning zero events is the signal that the markup moved — the route already
 * logs that case.
 */

import { decodeEntities } from "./enrich.ts";

export type ScrapedEvent = {
  title: string;
  url: string;
  /** YYYY-MM-DD. `end` equals `start` for a single-day event. */
  start: string;
  end: string;
  /** Display string, already formatted: "7 PM", "3 PM–11 PM", "All day". */
  time: string;
  venue: string;
  /** Free-text address, used to resolve the town. Empty when the card omits it. */
  address: string;
  /** The source's own label for the event ("Trivia Night", "Beer"). */
  category: string;
  description: string;
  image?: string;
  /** The listing said "+more dates": this is the next of several occurrences. */
  recurring: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function text(value: string | undefined) {
  if (!value) return "";
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function isoKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Step Out Buffalo prints "Sat, Aug 29" with no year, so a December listing
 * read in January would land eleven months in the past. Pick the year that puts
 * the date just ahead of today rather than assuming the current one.
 */
function resolveYear(month: number, day: number, todayKey: string) {
  const year = Number(todayKey.slice(0, 4));
  const thisYear = isoKey(year, month, day);
  return thisYear >= shiftKey(todayKey, -2) ? thisYear : isoKey(year + 1, month, day);
}

/** "7:00 pm" -> "7 PM", "10:30 AM" -> "10:30 AM". */
function clock(raw: string) {
  const match = raw.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i);
  if (!match) return "";
  const [, hour, minute, half] = match;
  return `${Number(hour)}${minute === "00" ? "" : `:${minute}`} ${half.toUpperCase()}M`;
}

/** "3:00 pm - 11:00 pm" -> "3 PM–11 PM"; "All Day" -> "All day". */
function readTime(raw: string) {
  if (!raw || /all\s*day/i.test(raw)) return "All day";
  if (/times?\s*vary/i.test(raw)) return "See listing";
  const parts = [...raw.matchAll(/\d{1,2}:\d{2}\s*[ap]\.?m\.?/gi)].map((match) => clock(match[0])).filter(Boolean);
  if (parts.length === 0) return "See listing";
  return parts.slice(0, 2).join("–");
}

/* --------------------------------------------------------- Step Out Buffalo */

/**
 * Cards are `<li>` or `<div>` depending on which template the page uses, and
 * both nest further divs, so there is no closing tag to match on. Slicing from
 * one card opening to the next is what makes this parseable at all; the cap
 * keeps a trailing card from swallowing the rest of the document.
 */
function cardSlices(html: string, opening: RegExp, cap = 8000) {
  const starts = [...html.matchAll(opening)].map((match) => match.index ?? 0);
  return starts.map((start, index) => html.slice(start, Math.min(starts[index + 1] ?? html.length, start + cap)));
}

/** "Thu, Aug 27 +more dates • 3:00 pm - 11:00 pm" split into dates and a time. */
function readDateCell(cell: string, todayKey: string) {
  const [dates, ...rest] = cell.split("•");
  const found = [...dates.matchAll(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\b/g)]
    .map((match) => [MONTHS.indexOf(match[1].toLowerCase()) + 1, Number(match[2])] as const)
    .filter(([month]) => month > 0);
  if (found.length === 0) return null;

  const start = resolveYear(found[0][0], found[0][1], todayKey);
  const second = found[1] ? resolveYear(found[1][0], found[1][1], todayKey) : start;
  return {
    start,
    end: second >= start ? second : start,
    time: readTime(rest.join("•").trim()),
    recurring: /\+\s*more dates/i.test(dates),
  };
}

export function parseStepOutBuffalo(html: string, todayKey: string): ScrapedEvent[] {
  const seen = new Set<string>();
  return cardSlices(html, /<(?:li|div)\s+class="[^"]*\bcardBox\b[^"]*"/g).flatMap((card) => {
    const url = card.match(/href="(https:\/\/stepoutbuffalo\.com\/event\/[^"]+)"/)?.[1];
    const cell = card.match(/class="[^"]*\beventListDateColor\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1];
    if (!url || !cell) return [];

    const title = text(card.match(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const dates = readDateCell(text(cell), todayKey);
    if (!title || !dates) return [];

    // The same event appears in several carousels on one page.
    const key = `${url}|${dates.start}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const location = card.match(/<span class="locationName">([\s\S]*?)<\/span>([\s\S]*?)<\/p>/);
    const venue = text(location?.[1]);
    const image = card.match(/data-bg="(https:\/\/[^"]+)"/)?.[1];

    return [{
      title,
      url,
      ...dates,
      venue,
      address: text(location?.[2]).replace(/^[•·\s]+/, ""),
      category: text(card.match(/class="[^"]*imageTagListing[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]),
      description: "",
      image,
    }];
  });
}

/* -------------------------------------------------------- GrowthZone / MicroNet */

/**
 * Chamber-of-commerce calendars run on GrowthZone, which marks every card up
 * with schema.org microdata. That makes this the sturdiest scrape of the two:
 * the dates come from `itemprop` meta tags rather than from display text.
 */
export function parseGrowthZone(html: string): ScrapedEvent[] {
  return cardSlices(html, /<div class="card gz-events-card"/g, 6000).flatMap((card) => {
    const title = text(card.match(/itemprop="name">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const url = card.match(/<a href="([^"]+)"[^>]*class="[^"]*gz-event-card-title/)?.[1];
    const start = americanDate(card.match(/itemprop="startDate" content="([^"]+)"/)?.[1]);
    if (!title || !url || !start) return [];
    const end = americanDate(card.match(/itemprop="endDate" content="([^"]+)"/)?.[1]) ?? start;

    return [{
      title,
      url: decodeEntities(url),
      start,
      end: end >= start ? end : start,
      time: readTime(text(card.match(/class="gz-event-card-time">([\s\S]*?)<\/h5>/)?.[1])),
      venue: "",
      address: "",
      category: "",
      description: text(card.match(/itemprop="about">([\s\S]*?)<\/p>/)?.[1]),
      recurring: false,
    }];
  });
}

/** GrowthZone stamps its microdata as "8/30/2026 10:00:00 AM". */
function americanDate(raw: string | undefined) {
  const match = raw?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? isoKey(Number(match[3]), Number(match[1]), Number(match[2])) : null;
}

/* ------------------------------------------------------- Erie County Parks */

/**
 * The towns behind Erie County's park names.
 *
 * The listing prints a park, never a town — "Location: Chestnut Ridge" — and
 * the county's park names carry no address at all, so nothing downstream could
 * place them. Only parks whose town is certain are listed; anything else is
 * left unmapped, and `parseScraped` drops what it cannot place rather than
 * letting it claim the flattering UNKNOWN_DISTANCE fallback.
 */
const ERIE_PARK_TOWNS: Record<string, string> = {
  "akron falls": "Akron",
  "bennett beach": "Angola",
  "black rock canal": "Buffalo",
  "boston forest": "Boston",
  "chestnut ridge": "Orchard Park",
  "como lake": "Lancaster",
  "eighteen mile creek": "Hamburg",
  "ellicott creek": "Tonawanda",
  "elma meadows": "Elma",
  "emery": "Wales",
  "franklin gulf": "North Collins",
  "hunters creek": "Wales",
  "isle view": "Tonawanda",
  "red jacket": "Buffalo",
  "scoby dam": "Springville",
  "seneca bluffs": "Buffalo",
  "sprague brook": "Concord",
  "wendt": "Derby",
};

const LONG_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "2026-08-26T18:00:00-04:00" -> "6 PM". Reads the local wall clock, not UTC. */
function clockFromIso(iso: string) {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = match[2];
  return `${hour % 12 || 12}${minute === "00" ? "" : `:${minute}`} ${hour >= 12 ? "PM" : "AM"}`;
}

/** "Wednesday, August 26, 2026" -> "2026-08-26". */
function longDate(raw: string) {
  const match = raw.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const month = LONG_MONTHS.indexOf(match[1].toLowerCase()) + 1;
  return month > 0 ? isoKey(Number(match[3]), month, Number(match[2])) : null;
}

/**
 * Erie County Parks — ranger-led hikes, fishing lessons and kids-and-families
 * programs at Chestnut Ridge, Emery, Sprague Brook and the rest.
 *
 * This is the one part of the region's family calendar nothing else here
 * carried: the county runs its parks programming on a Drupal view with no
 * iCalendar, RSS or JSON endpoint of any kind. The markup is unusually kind
 * for a scrape, though — each row labels its title and category with a class
 * and stamps both ends of the event in `<time datetime>`, so the start comes
 * from a machine-readable attribute rather than from display text.
 */
export function parseErieParks(html: string): ScrapedEvent[] {
  return cardSlices(html, /<tr[\s>]/g, 12000).flatMap((row) => {
    const title = text(row.match(/<p class="event-title">([\s\S]*?)<\/p>/)?.[1]);
    if (!title) return [];

    const stamps = [...row.matchAll(/<time[^>]+datetime="([^"]+)"/g)].map((match) => match[1]);
    const start = stamps[0]?.slice(0, 10) || longDate(text(row.match(/<p class="event-date">([\s\S]*?)<\/p>/)?.[1]));
    if (!start) return [];

    // "Location: <a>Chestnut Ridge</a> <a>- Meadow Shelter</a>" — the first
    // anchor is the park, the optional second is the meeting spot inside it.
    const location = row.match(/Location:\s*<a[^>]*>([\s\S]*?)<\/a>(?:\s*<a[^>]*>([\s\S]*?)<\/a>)?/);
    const park = text(location?.[1]);
    if (!park) return [];
    // Erie prints "Chestnut Ridge"; the venue table is keyed "chestnut ridge park".
    const venue = /\bpark\b/i.test(park) ? park : `${park} Park`;
    // Park names run long — "Seneca Bluffs Natural Habitat Park" — so the map
    // is keyed by the distinguishing head of the name and matched by prefix.
    const key = park.toLowerCase();
    const town = Object.entries(ERIE_PARK_TOWNS).find(([name]) => key.startsWith(name))?.[1] ?? "";

    // "- Meeting Location: Main Parking Lot" -> "Main Parking Lot".
    const spot = text(location?.[2]).replace(/^[-–—•\s]+/, "").replace(/^meeting location:\s*/i, "");
    const summary = text(row.match(/<p>\s*<p>([\s\S]*?)<\/p>/)?.[1]);
    const image = row.match(/<img[^>]+src="(\/parks\/sites\/[^"]+)"/)?.[1];

    return [{
      title,
      // Programs that take registration link to their own form; the rest have
      // no page of their own, so the slug keeps ids distinct per event.
      url:
        row.match(/href="(https:\/\/www3\.erie\.gov\/parks\/form\/[^"]+)"/)?.[1] ??
        `https://www3.erie.gov/parks/events#${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      start,
      end: stamps[1]?.slice(0, 10) || start,
      time: stamps.length ? [...new Set(stamps.slice(0, 2).map(clockFromIso))].filter(Boolean).join("–") : "See listing",
      venue,
      address: town ? `${venue}, ${town}, NY` : venue,
      category: text(row.match(/<div class="cal-[^"]*">(?:&nbsp;|\s)*<\/div>\s*([^<]*)/)?.[1]),
      description: spot ? `${summary} Meets at ${spot}.`.trim() : summary,
      image: image ? `https://www3.erie.gov${image}` : undefined,
      recurring: false,
    }];
  });
}
