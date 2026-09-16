import { cache } from "react";
import { connectToDatabase, SiteContent, SEED_SITE_CONTENT, type SiteContentPage, type INavItem } from "@oodelscore/shared";

export interface ResolvedSiteContent {
  page: SiteContentPage;
  navItems: INavItem[];
  fields: Record<string, string>;
}

function fromSeed(page: SiteContentPage): ResolvedSiteContent {
  const seed = SEED_SITE_CONTENT.find((s) => s.page === page)!;
  return { page, navItems: seed.navItems, fields: seed.fields };
}

/**
 * A live DB `menu` doc predates a nav entry added later in the seed (e.g.
 * "how-it-works" was just added here but an old doc has no such entry at
 * all) — a missing entry must default to visible, not hidden, or a newly
 * added page silently 404s (each gated page checks
 * `navItems.find(...)?.visible === false`, which already fails open for a
 * missing key) and — the other half of the same bug — never appears in the
 * nav at all, since a plain `.filter(n => n.visible)` only ever shows keys
 * that are actually present. Fix: any seed nav key absent from the DB doc
 * is merged in with the seed's default (visible, in seed order). A key the
 * DB doc DOES have — including an explicit `visible: false` — is left
 * exactly as the admin set it.
 */
function mergeNavItems(dbItems: INavItem[], seedItems: INavItem[]): INavItem[] {
  const present = new Set(dbItems.map((item) => item.key));
  const missing = seedItems.filter((item) => !present.has(item.key));
  return [...dbItems, ...missing];
}

/**
 * Marketing pages must never 500 for a visitor over this — falls back to the
 * seed defaults (same copy `seedPlatformDefaults()` writes on boot) if the
 * DB is unreachable or the page hasn't been seeded yet.
 */
export const getSiteContent = cache(async function getSiteContent(
  page: SiteContentPage,
): Promise<ResolvedSiteContent> {
  try {
    await connectToDatabase();
    const doc = await SiteContent.findOne({ page });
    if (!doc) return fromSeed(page);
    const seed = SEED_SITE_CONTENT.find((s) => s.page === page);
    const navItems = seed ? mergeNavItems(doc.navItems, seed.navItems) : doc.navItems;
    return { page, navItems, fields: Object.fromEntries(doc.fields) };
  } catch {
    return fromSeed(page);
  }
});

export function parseJsonArray<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
