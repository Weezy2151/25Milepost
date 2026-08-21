/**
 * Turning raw feed text into something readable, and finding a picture for it.
 *
 * ICS DESCRIPTION fields and library RSS bodies arrive full of escaped newlines,
 * HTML entities, registration boilerplate and trailing "Contact us at…" blocks.
 * These helpers do the tidying, plus a bounded Open Graph image lookup so cards
 * have real photography instead of a pattern tile.
 */

import { getCachedData, setCachedData } from "../db/cache";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  deg: "°",
};

export function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[String(name).toLowerCase()] ?? match);
}

/** Phrases that are administrative noise rather than a description of the event. */
const BOILERPLATE = [
  /registration is required[^.]*\.?/gi,
  /please register[^.]*\.?/gi,
  /this (?:program|event) is (?:free and )?open to the public\.?/gi,
  /for more information[^.]*\.?/gi,
  /questions\?[^.]*\.?/gi,
  /call \(?\d{3}\)?[ -]?\d{3}-\d{4}[^.]*\.?/gi,
  /visit (?:us|our website)[^.]*\.?/gi,
  /click here[^.]*\.?/gi,
  /https?:\/\/\S+/gi,
  /\S+@\S+\.\S+/gi,
  /all ages welcome\.?/gi,
];

/**
 * Collapse a feed body into one clean paragraph.
 * Trims on a sentence boundary so cards never end mid-word.
 */
export function cleanDescription(raw: string, limit = 260) {
  let text = decodeEntities(raw ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\n|\\r/g, " ")
    .replace(/\r?\n/g, " ");

  for (const pattern of BOILERPLATE) text = text.replace(pattern, " ");

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= limit) return text;

  const window = text.slice(0, limit);
  const lastStop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastStop > limit * 0.5) return window.slice(0, lastStop + 1).trim();

  const lastSpace = window.lastIndexOf(" ");
  return `${window.slice(0, lastSpace > 0 ? lastSpace : limit).trim()}…`;
}

/** A description worth showing, or a sensible stand-in built from what we know. */
export function describe(raw: string, title: string, venue: string, town: string) {
  const cleaned = cleanDescription(raw);
  if (cleaned.length >= 40) return cleaned;
  if (cleaned.length > 0) return `${cleaned} At ${venue} in ${town}.`;
  return `${title} at ${venue} in ${town}.`;
}

/* ------------------------------------------------------------------ images */

const OG_TTL_SECONDS = 60 * 60 * 24 * 30; // Images move rarely; keep them a month.
const OG_TIMEOUT_MS = 2500;
/** Hard ceiling per refresh so a slow source can never stall the whole payload. */
const OG_BUDGET = 12;

function ogKey(url: string) {
  return `og:${url}`;
}

function absolute(candidate: string, base: string) {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

function extractOgImage(html: string, pageUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const resolved = absolute(decodeEntities(match[1]).trim(), pageUrl);
      if (resolved?.startsWith("https://")) return resolved;
    }
  }
  return null;
}

async function fetchOgImage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "The 25-Mile Post family event index", accept: "text/html" },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    // og:* lives in <head>; reading the first slice avoids pulling whole pages.
    const html = (await response.text()).slice(0, 60_000);
    return extractOgImage(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve preview images for a set of event URLs.
 *
 * Cached results are free. Uncached ones are looked up in parallel but capped
 * at OG_BUDGET per refresh, so this adds at most one timeout to a cache miss.
 * Returns a url -> image map; misses are cached as "" so we stop retrying them.
 */
export async function resolveImages(urls: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((url) => url.startsWith("https://")))];
  const resolved = new Map<string, string>();
  const pending: string[] = [];

  for (const url of unique) {
    const cached = await getCachedData<string>(ogKey(url));
    if (cached === null) pending.push(url);
    else if (cached) resolved.set(url, cached);
  }

  const batch = pending.slice(0, OG_BUDGET);
  await Promise.all(
    batch.map(async (url) => {
      const image = await fetchOgImage(url);
      await setCachedData(ogKey(url), image ?? "", OG_TTL_SECONDS);
      if (image) resolved.set(url, image);
    }),
  );

  return resolved;
}
