import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./global.css";
import { getSiteContent } from "@/lib/siteContent";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const DEFAULT_SITE_NAME = "OodelCX";

// Server-rendered, not a client fetch — the browser tab title is in the
// first byte of HTML, so there's no flash of a hardcoded default before
// the admin-edited name loads (same fix as AuthShell's login copy).
//
// `title.template` composes with every page's own `title` export (a
// marketing page sets `title: "Pricing"`, this turns it into
// "Pricing — OodelCX") so a Site Name rename in Admin propagates
// everywhere without editing every page. `title.default` covers pages
// that don't set their own title at all (every dashboard/auth/print page —
// deliberately left alone, see those layouts/pages: this rebrand pass is
// marketing-pages-only per product decision).
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent("menu");
  const siteName = content.fields.siteName || DEFAULT_SITE_NAME;
  const appUrl = process.env.APP_URL;
  return {
    // Required for social-share crawlers (WhatsApp, iMessage, Slack, etc.)
    // to resolve a page's og:image into an absolute URL — without this,
    // Next emits a relative path those crawlers can't fetch.
    ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
    title: { default: siteName, template: `%s — ${siteName}` },
    openGraph: { siteName, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

// One font, everywhere — dashboards, marketing site, and printable posters
// all inherit this instead of each defining its own font-family.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
