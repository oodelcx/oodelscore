import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/siteContent";

/**
 * Public: the login/forgot-password/set-password visual panel's headline,
 * fetched client-side since AuthShell renders inside those "use client"
 * pages. Never 500s — getSiteContent() falls back to seed defaults if the
 * DB is unreachable.
 */
export async function GET() {
  const content = await getSiteContent("login");
  return NextResponse.json({
    status: "ok",
    headline: content.fields.heroHeadline ?? "",
    highlight: content.fields.heroHighlight ?? "",
  });
}
