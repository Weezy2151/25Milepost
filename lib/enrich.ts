/**
 * Turning raw feed text into something readable, and finding a picture for it.
 *
 * ICS DESCRIPTION fields and library RSS bodies arrive full of escaped newlines,
 * HTML entities, registration boilerplate and trailing "Contact us at…" blocks.
 * These helpers do the tidying, plus a bounded Open Graph image lookup so cards
 * have real photography instead of a pattern tile.
 */

import { createHash } from "node:crypto";

import { getCachedData, setCachedData } from "../db/cache.ts";
import { assertSafePublicUrl, EVENT_IMAGE_HOSTS, EVENT_PAGE_HOSTS, fetchPublicText } from "./safe-fetch.ts";

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
/** Avoid one Redis REST read for every item in a pathological feed. */
const OG_CACHE_LOOKUP_BUDGET = 48;

function ogKey(url: string) {
  return `og:${createHash("sha256").update(url).digest("base64url")}`;
}

function canonicalPageUrl(raw: string) {
  const url = assertSafePublicUrl(raw, [...EVENT_PAGE_HOSTS]);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
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
      if (resolved?.startsWith("https://")) {
        try {
          assertSafePublicUrl(resolved, [...EVENT_IMAGE_HOSTS]);
          return resolved;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const html = await fetchPublicText(url, {
      timeoutMs: OG_TIMEOUT_MS,
      maxBytes: 80_000,
      contentTypes: ["text/html", "application/xhtml+xml"],
      headers: {
        // Same browser string the feed fetches use: event hosts 403 unknown agents.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        accept: "text/html",
      },
    });
    return extractOgImage(html, url);
  } catch {
    return null;
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
  const originalsByCanonical = new Map<string, string[]>();
  for (const original of urls) {
    try {
      const canonical = canonicalPageUrl(original);
      const originals = originalsByCanonical.get(canonical) ?? [];
      originals.push(original);
      originalsByCanonical.set(canonical, originals);
    } catch {
      // Ignore event links outside the page allowlist.
    }
  }
  const unique = [...originalsByCanonical.keys()].slice(0, OG_CACHE_LOOKUP_BUDGET);
  const resolved = new Map<string, string>();
  const pending: string[] = [];
  const applyImage = (canonical: string, image: string) => {
    for (const original of originalsByCanonical.get(canonical) ?? []) resolved.set(original, image);
  };

  const cachedEntries = await Promise.all(unique.map((url) => getCachedData<string>(ogKey(url))));
  unique.forEach((url, index) => {
    const cached = cachedEntries[index];
    if (cached === null) pending.push(url);
    else if (cached) applyImage(url, cached);
  });

  const batch = pending.slice(0, OG_BUDGET);
  const writes = await Promise.all(
    batch.map(async (url) => {
      const image = await fetchOgImage(url);
      if (image) applyImage(url, image);
      try {
        await setCachedData(ogKey(url), image ?? "", OG_TTL_SECONDS);
        return true;
      } catch {
        return false;
      }
    }),
  );
  if (writes.some((ok) => !ok)) console.warn("[events] one or more preview-image cache writes failed");

  return resolved;
}
