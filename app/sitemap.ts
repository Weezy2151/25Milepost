import type { MetadataRoute } from "next";

import { siteOrigin } from "../lib/site";

/**
 * One page, refreshed daily.
 *
 * The guide is a single view of a moving week rather than a set of separate
 * pages, so the sitemap says so plainly instead of inventing per-day URLs that
 * would all serve the same document.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteOrigin}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
