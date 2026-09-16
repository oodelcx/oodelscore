import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectToDatabase, SiteContent, SITE_CONTENT_PAGES, type SiteContentPage } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ page: string }> };

const PAGE_SET: readonly string[] = SITE_CONTENT_PAGES;

// Marketing pages are ISR-cached (revalidate = 60s each) so real traffic
// doesn't hit Mongo on every request — but that meant a save here only
// took effect after up to a minute, which reads as "the toggle didn't
// work" if you check right away. "menu" backs the nav + footer on every
// marketing page, so it needs all of them revalidated, not just its own.
const MARKETING_ROUTES_BY_PAGE: Record<string, string[]> = {
  menu: ["/", "/product", "/solutions", "/pricing", "/company", "/contact", "/privacy", "/terms"],
  home: ["/"],
  pricing: ["/pricing"],
  product: ["/product"],
  solutions: ["/solutions"],
  company: ["/company"],
  contact: ["/contact"],
  privacy: ["/privacy"],
  terms: ["/terms"],
  login: [], // login/forgot-password/set-password are `dynamic = "force-dynamic"` — always read fresh, nothing to revalidate
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { page } = await params;
  if (!PAGE_SET.includes(page)) {
    return NextResponse.json({ status: "error", message: "Unknown page" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (Array.isArray(body.navItems)) update.navItems = body.navItems;
  if (Array.isArray(body.sections)) update.sections = body.sections;
  if (body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
      if (typeof value === "string") fields[key] = value;
    }
    update.fields = fields;
  }

  await connectToDatabase();
  const doc = await SiteContent.findOneAndUpdate(
    { page: page as SiteContentPage },
    { $set: update },
    { upsert: true, new: true }
  );

  for (const route of MARKETING_ROUTES_BY_PAGE[page] ?? []) {
    revalidatePath(route);
  }

  return NextResponse.json({
    status: "ok",
    page: {
      page: doc.page,
      navItems: doc.navItems,
      sections: doc.sections,
      fields: Object.fromEntries(doc.fields),
    },
  });
}
