import { NextResponse } from "next/server";
import { SEED_SITE_CONTENT } from "@oodelscore/shared";
import { getSiteContent, parseJsonArray } from "@/lib/siteContent";

const SEED_PRODUCT = SEED_SITE_CONTENT.find((s) => s.page === "product")!;
const SEED_SOLUTIONS = SEED_SITE_CONTENT.find((s) => s.page === "solutions")!;

interface Feature {
  tag: string;
  headline: string;
  body: string;
  group?: "understand" | "act";
}

// Mirrors product/page.tsx's featureSlug() exactly — the anchor a feature's
// own section on /product registers itself under. Duplicated rather than
// cross-imported from that route file to keep this route independent of
// another route's internals.
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

// Public, read-only, and cheap — same 60s revalidation window as the
// marketing pages themselves, so a Site Content edit (adding/renaming a
// feature, an industry) shows up in the mega-menu without a redeploy.
export const revalidate = 60;

export async function GET() {
  const [product, solutions] = await Promise.all([getSiteContent("product"), getSiteContent("solutions")]);

  let features = parseJsonArray<Feature>(product.fields.features);
  // A DB doc saved before feature/product `group` tagging existed still has
  // its `features` key (so the fields-merge fallback above never kicks in)
  // but every item is missing `group`, which would leave Act empty forever
  // until someone re-saves the Features editor in Admin. Self-heal the same
  // way a brand-new install would: fall back to the seed's tagged list.
  if (!features.some((f) => f.group === "act")) {
    features = parseJsonArray<Feature>(SEED_PRODUCT.fields.features);
  }
  const toLink = (f: Feature): NavLink => ({ label: f.tag, href: `/product#${featureSlug(f.tag)}` });
  const understand = features.filter((f) => f.group !== "act").map(toLink);
  const act = features.filter((f) => f.group === "act").map(toLink);

  let industries = parseJsonArray<string>(solutions.fields.industries);
  if (industries.length === 0) industries = parseJsonArray<string>(SEED_SOLUTIONS.fields.industries);
  const industryLinks: NavLink[] = industries.map((name) => ({ label: name, href: "/solutions#industries" }));
  const structureLinks: NavLink[] = [
    { label: "Single-location businesses", href: "/solutions#standalone" },
    { label: "Multi-branch groups", href: "/solutions#group" },
    { label: "Enterprise", href: "/solutions#enterprise" },
  ];

  return NextResponse.json({
    status: "ok",
    product: {
      columns: [
        { label: "Understand", items: understand },
        { label: "Act", items: act },
      ],
    },
    solutions: {
      columns: [
        { label: "By Industry", items: industryLinks },
        { label: "By Structure", items: structureLinks },
      ],
    },
  });
}
