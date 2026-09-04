import type { MetadataRoute } from "next";

import { siteOrigin } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API answers the page's own fetches; it is not content to index.
      disallow: "/api/",
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
