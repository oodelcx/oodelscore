import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  connectToDatabase,
  SiteContent,
  SITE_CONTENT_PAGES,
  SEED_SITE_CONTENT,
  logAuditEvent,
  type SiteContentPage,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ page: string }> };

const PAGE_SET: readonly string[] = SITE_CONTENT_PAGES;

// Same revalidation map as the PATCH handler in ../route.ts — kept in sync
// there; a reset touches the same public routes a manual save would.
const MARKETING_ROUTES_BY_PAGE: Record<string, string[]> = {
  menu: ["/", "/product", "/colleague-pulse", "/solutions", "/pricing", "/company", "/contact", "/privacy", "/terms"],
  home: ["/"],
  pricing: ["/pricing"],
  product: ["/product"],
  "colleague-pulse": ["/colleague-pulse"],
  solutions: ["/solutions"],
  company: ["/company"],
  contact: ["/contact"],
  privacy: ["/privacy"],
  terms: ["/terms"],
  login: [],
};

/**
 * "Reset this page to latest platform defaults" — the only way pending
 * copy changes made to `packages/shared/src/seedData/siteContent.ts` (this
 * repo has no automated re-seed on deploy, and no live DB access from a
 * coding session) ever reach the live site: an existing DB `SiteContent`
 * doc is only ever read, never refreshed from the seed, once it exists.
 * This completely OVERWRITES the DB doc's fields (and navItems/sections
 * for "menu") with the current seed values — any manual admin edits made
 * on that page since it was last saved are discarded. The admin UI confirms
 * this with the admin before calling it.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.emailAndSiteContent.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { page } = await params;
  if (!PAGE_SET.includes(page)) {
    return NextResponse.json({ status: "error", message: "Unknown page" }, { status: 404 });
  }

  const seed = SEED_SITE_CONTENT.find((s) => s.page === page);
  if (!seed) {
    return NextResponse.json({ status: "error", message: "No seed defaults for this page" }, { status: 404 });
  }

  await connectToDatabase();
  const before = await SiteContent.findOne({ page: page as SiteContentPage });

  const doc = await SiteContent.findOneAndUpdate(
    { page: page as SiteContentPage },
    { $set: { navItems: seed.navItems, sections: seed.sections, fields: seed.fields } },
    { upsert: true, new: true }
  );

  for (const route of MARKETING_ROUTES_BY_PAGE[page] ?? []) {
    revalidatePath(route);
  }

  await logAuditEvent({
    actor: session.user,
    action: "site_content.reset_to_defaults",
    targetType: "SiteContent",
    targetId: doc._id.toString(),
    targetLabel: page,
    before: before
      ? { navItems: before.navItems, sections: before.sections, fields: Object.fromEntries(before.fields) }
      : null,
    after: { navItems: doc.navItems, sections: doc.sections, fields: Object.fromEntries(doc.fields) },
  });

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
