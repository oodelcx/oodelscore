import { NextResponse } from "next/server";
import { SEED_SITE_CONTENT } from "@oodelscore/shared";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";

const SEED_PRODUCT = SEED_SITE_CONTENT.find((s) => s.page === "product")!;
const SEED_COLLEAGUE_PULSE = SEED_SITE_CONTENT.find((s) => s.page === "colleague-pulse")!;
const SEED_SOLUTIONS = SEED_SITE_CONTENT.find((s) => s.page === "solutions")!;

interface Feature {
  tag: string;
  headline: string;
  body: string;
  group?: "understand" | "act";
  // Curated subset shown in the nav mega-menu — a SaaS nav lists the
  // headline items, not every feature on the page (that's what /product
  // itself is for). Falls back to "show everything" only if literally
  // nothing is marked, so an old/incompletely-migrated features list still
  // renders something instead of an empty column.
  menuFeatured?: boolean;
}

interface IndustryDetail {
  slug: string;
  name: string;
}

// Mirrors product/page.tsx's featureSlug() exactly — the anchor a feature's
// own section registers itself under. Duplicated rather than cross-imported
// from that route file to keep this route independent of another route's
// internals.
function featureSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface NavLink {
  label: string;
  href: string;
}
interface MegaSection {
  columns: { label: string; items: NavLink[] }[];
  seeAllHref?: string;
  seeAllLabel?: string;
}

async function buildProductMenu(page: "product" | "colleague-pulse", seed: (typeof SEED_SITE_CONTENT)[number]): Promise<MegaSection> {
  const content = await getSiteContent(page);
  let features = parseJsonArray<Feature>(content.fields.features);
  // A DB doc saved before feature/product `group` tagging existed still has
  // its `features` key (so the fields-merge fallback in getSiteContent
  // never kicks in) but every item is missing `group`, which would leave
  // Act empty forever until someone re-saves the Features editor in Admin.
  // Self-heal the same way a brand-new install would: fall back to the
  // seed's tagged list.
  if (!features.some((f) => f.group === "act")) {
    features = parseJsonArray<Feature>(seed.fields.features);
  }
  const curated = features.some((f) => f.menuFeatured) ? features.filter((f) => f.menuFeatured) : features;
  const toLink = (f: Feature): NavLink => ({ label: f.tag, href: `/${page}#${featureSlug(f.tag)}` });
  const understand = curated.filter((f) => f.group !== "act").map(toLink);
  const act = curated.filter((f) => f.group === "act").map(toLink);

  return {
    columns: [
      { label: "Understand", items: understand },
      { label: "Act", items: act },
    ],
    seeAllHref: `/${page}`,
    seeAllLabel: "See every feature →",
  };
}

// Public, read-only, and cheap — same 60s revalidation window as the
// marketing pages themselves, so a Site Content edit (adding/renaming a
// feature, an industry) shows up in the mega-menu without a redeploy.
export const revalidate = 60;

export async function GET() {
  const [product, colleaguePulse, solutions] = await Promise.all([
    buildProductMenu("product", SEED_PRODUCT),
    buildProductMenu("colleague-pulse", SEED_COLLEAGUE_PULSE),
    getSiteContent("solutions"),
  ]);

  let industries = parseJsonArray<IndustryDetail>(solutions.fields.industryDetails);
  if (industries.length === 0) industries = parseJsonArray<IndustryDetail>(SEED_SOLUTIONS.fields.industryDetails);
  // Each industry now has its own page (see solutions/[slug]) — no more
  // routing every industry to the same shared anchor, which is what made
  // this column read as "no data" (every link went to the same place).
  const industryLinks: NavLink[] = industries.map((i) => ({ label: i.name, href: `/solutions/${i.slug}` }));
  const structureLinks: NavLink[] = [
    { label: "Single-location businesses", href: "/solutions#standalone" },
    { label: "Multi-branch groups", href: "/solutions#group" },
    { label: "Enterprise", href: "/solutions#enterprise" },
  ];

  return NextResponse.json({
    status: "ok",
    product,
    "colleague-pulse": colleaguePulse,
    solutions: {
      columns: [
        { label: "By Industry", items: industryLinks },
        { label: "By Structure", items: structureLinks },
      ],
    },
  });
}
