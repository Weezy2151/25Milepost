import type { NextConfig } from "next";
import { EVENT_IMAGE_HOSTS } from "./lib/image-hosts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Keep the optimizer and server-side URL validator on one allowlist. Exact
    // and wildcard entries cover both a site's apex and its trusted subdomains.
    remotePatterns: EVENT_IMAGE_HOSTS.flatMap((hostname) => [
      { protocol: "https" as const, hostname, pathname: "/**" },
      { protocol: "https" as const, hostname: `**.${hostname}`, pathname: "/**" },
    ]),
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [32, 48, 64, 96, 128, 256],
    qualities: [70],
    minimumCacheTTL: 7 * 24 * 60 * 60,
    maximumRedirects: 3,
    maximumResponseBody: 4_000_000,
    dangerouslyAllowLocalIP: false,
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      ],
    }];
  },
};

export default nextConfig;
