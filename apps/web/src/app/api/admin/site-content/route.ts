import { NextResponse } from "next/server";
import { connectToDatabase, SiteContent, SITE_CONTENT_PAGES, SEED_SITE_CONTENT } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { mergeNavItems } from "@/lib/siteContent";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const pages = await SiteContent.find({ page: { $in: SITE_CONTENT_PAGES } });
  const byPage = new Map(pages.map((p) => [p.page, p]));

  return NextResponse.json({
    status: "ok",
    pages: SITE_CONTENT_PAGES.map((page) => {
      const doc = byPage.get(page);
      // A page that's never been saved through this CMS has no DB doc yet,
      // but the public site still renders it via the same seed defaults
      // (see lib/siteContent.ts's getSiteContent) — fall back to those here
      // too, so this screen shows what's actually live instead of blank
      // fields that would silently wipe the real copy if saved as-is.
      const seed = SEED_SITE_CONTENT.find((s) => s.page === page);
      // Same self-healing merge the public marketing nav uses (see
      // lib/siteContent.ts's getSiteContent / mergeNavItems) — without it, a
      // DB doc that predates a newly-seeded nav key (e.g. "how-it-works")
      // never shows up here as a manageable toggle even though it correctly
      // renders on the live site via the seed fallback.
      const navItems = doc ? (seed ? mergeNavItems(doc.navItems, seed.navItems) : doc.navItems) : (seed?.navItems ?? []);
      return {
        page,
        navItems,
        sections: doc?.sections ?? seed?.sections ?? [],
        fields: doc ? Object.fromEntries(doc.fields) : (seed?.fields ?? {}),
      };
    }),
  });
}
