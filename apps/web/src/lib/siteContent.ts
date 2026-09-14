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
    return { page, navItems: doc.navItems, fields: Object.fromEntries(doc.fields) };
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
