import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "./error-boundary";

const title = "The 25-Mile Post | Family Things To Do Near Orchard Park";
const description =
  "A handpicked morning guide to family events happening today and this week within about 25 miles of Orchard Park, New York.";

const deploymentHost = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3000";
const metadataBase = new URL(/^https?:\/\//.test(deploymentHost) ? deploymentHost : `https://${deploymentHost}`);
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  icons: { icon: "/og.png", shortcut: "/og.png" },
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "The 25-Mile Post family field guide" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

// Applies the saved theme before first paint so the page never flashes the wrong palette.
const themeBoot = `try{var t=localStorage.getItem("twenty-five-mile-post-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
