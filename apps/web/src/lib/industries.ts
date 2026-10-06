import { SOLUTION_INDUSTRIES } from "@oodelscore/shared";

export interface IndustryUse {
  icon: string;
  title: string;
  body: string;
}

export interface IndustryDetail {
  slug: string;
  name: string;
  /** "no" hides the sector everywhere on the public site; anything else shows it. */
  visible?: string;
  tileBody?: string;
  cxHeadline?: string;
  cxSub?: string;
  cxChallenge?: string;
  cxMeasures?: string[];
  cxUses?: IndustryUse[];
  cxScene?: string;
  cxSteps?: string[];
  exHeadline?: string;
  exSub?: string;
  exChallenge?: string;
  exMeasures?: string[];
  exUses?: IndustryUse[];
  exScene?: string;
  exSteps?: string[];
}

/**
 * A stored industry that predates the per-product content (it only has the
 * old tagline/benefits fields) borrows the defaults for its slug, field by
 * field — an admin's own edits to a field always win.
 */
export function mergeIndustries(stored: string | undefined): IndustryDetail[] {
  let db: IndustryDetail[] = [];
  try {
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) db = parsed as IndustryDetail[];
  } catch {
    db = [];
  }
  const defaults = SOLUTION_INDUSTRIES as unknown as IndustryDetail[];
  if (db.length === 0) return defaults;
  return db.map((ind) => {
    const seed = defaults.find((d) => d.slug === ind.slug);
    if (!seed) return ind;
    const merged: Record<string, unknown> = { ...seed };
    for (const [k, v] of Object.entries(ind)) if (v !== undefined && v !== null && v !== "" ) merged[k] = v;
    return merged as unknown as IndustryDetail;
  });
}

export function isIndustryVisible(i: { visible?: string }): boolean {
  return i.visible !== "no";
}

/** The sectors a visitor should see: everything the admin has not hidden. */
export function visibleIndustries(stored: string | undefined): IndustryDetail[] {
  return mergeIndustries(stored).filter(isIndustryVisible);
}
