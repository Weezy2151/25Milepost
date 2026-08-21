import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "The 25-Mile Post | Family Things To Do Near Orchard Park";
const description =
  "A handpicked morning guide to family events happening today and this week within about 25 miles of Orchard Park, New York.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    icons: { icon: "/og.png", shortcut: "/og.png" },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1730, height: 909, alt: "The 25-Mile Post family field guide" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

// Applies the saved theme before first paint so the page never flashes the wrong palette.
const themeBoot = `try{var t=localStorage.getItem("twenty-five-mile-post-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
