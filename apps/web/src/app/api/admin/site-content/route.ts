import { NextResponse } from "next/server";
import { connectToDatabase, SiteContent, SITE_CONTENT_PAGES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

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
      return {
        page,
        navItems: doc?.navItems ?? [],
        sections: doc?.sections ?? [],
        fields: doc ? Object.fromEntries(doc.fields) : {},
      };
    }),
  });
}
