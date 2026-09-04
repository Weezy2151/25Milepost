import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "./error-boundary";
import { ServiceWorker } from "./components/service-worker";
import { siteUrl } from "../lib/site";

const title = "The 25-Mile Post | Family Things To Do Near Orchard Park";
const description =
  "A handpicked morning guide to family events happening today and this week within about 25 miles of Orchard Park, New York.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  alternates: { canonical: "/" },
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The 25-Mile Post family field guide" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
};

// Applies the saved theme before first paint so the page never flashes the wrong palette.
const themeBoot = `try{var t=localStorage.getItem("twenty-five-mile-post-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
        <ServiceWorker />
      </body>
    </html>
  );
}
