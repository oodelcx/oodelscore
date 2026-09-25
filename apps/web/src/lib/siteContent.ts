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
export function mergeNavItems(dbItems: INavItem[], seedItems: INavItem[]): INavItem[] {
  const present = new Set(dbItems.map((item) => item.key));
  const missing = seedItems.filter((item) => !present.has(item.key));
  return [...dbItems, ...missing];
}

/**
 * Same idea as mergeNavItems, for the fields Map: a live DB doc predates a
 * field key added to the seed later (e.g. `industries` didn't exist when
 * the "solutions" doc was first created) — that key must fall back to the
 * seed's value instead of silently rendering empty. A key the DB doc DOES
 * have, even an empty string an admin deliberately cleared, is left exactly
 * as set — this only fills in keys that are entirely absent.
 */
export function mergeFields(dbFields: Record<string, string>, seedFields: Record<string, string>): Record<string, string> {
  const merged = { ...dbFields };
  for (const [key, value] of Object.entries(seedFields)) {
    if (!(key in merged)) merged[key] = value;
  }
  return merged;
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
    const dbFields = Object.fromEntries(doc.fields);
    const fields = seed ? mergeFields(dbFields, seed.fields) : dbFields;
    return { page, navItems, fields };
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
