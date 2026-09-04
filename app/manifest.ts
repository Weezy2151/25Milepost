import type { MetadataRoute } from "next";

/**
 * Installed-app details.
 *
 * This is a phone-at-breakfast product — it belongs on a home screen, and it
 * should open the way it is read: a single page, in the paper's own colours.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The 25-Mile Post",
    short_name: "25-Mile Post",
    description:
      "A handpicked morning guide to family events happening today and this week within about 25 miles of Orchard Park, New York.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5f0",
    theme_color: "#102a43",
    categories: ["lifestyle", "travel", "events"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // A maskable icon keeps the mark inside the safe zone when a launcher
      // crops it to its own shape.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
