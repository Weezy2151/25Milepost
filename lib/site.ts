/**
 * Where this deployment lives.
 *
 * The layout worked this out for its metadata; the server-rendered structured
 * data, the sitemap and robots.txt all need the same answer, and none of them
 * may invent a domain. Falls back the way the layout always did: an explicit
 * setting, then the Vercel production URL, then localhost for development.
 */
const configured =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3000";

export const siteUrl = new URL(/^https?:\/\//.test(configured) ? configured : `https://${configured}`);

/** The origin with no trailing slash, for building links by hand. */
export const siteOrigin = siteUrl.origin;
