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
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent("menu");
  return { title: content.fields.siteName || DEFAULT_SITE_NAME };
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
