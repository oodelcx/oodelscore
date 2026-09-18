import { cache } from "react";
import { connectToDatabase, TooltipScreen, SEED_TOOLTIPS } from "@oodelscore/shared";

function fromSeed(screenKey: string): Record<string, string> {
  const seed = SEED_TOOLTIPS.find((s) => s.screenKey === screenKey);
  return Object.fromEntries((seed?.tooltips ?? []).map((t) => [t.key, t.text]));
}

/**
 * Dashboards must never 500 or render blank info icons over this — falls
 * back to the seed defaults (same copy `SEED_TOOLTIPS` ships) if the DB is
 * unreachable or this screen hasn't been saved through the admin editor yet.
 * Same resilience convention as `getSiteContent` in ./siteContent.ts.
 *
 * Returns a flat `{ [tooltipKey]: text }` map — NOT the raw ordered array —
 * so consuming pages can index straight into it (`tooltips["nps"]`) instead
 * of searching an array by key.
 */
export const getTooltips = cache(async function getTooltips(screenKey: string): Promise<Record<string, string>> {
  try {
    await connectToDatabase();
    const doc = await TooltipScreen.findOne({ screenKey });
    if (!doc) return fromSeed(screenKey);
    return Object.fromEntries(doc.tooltips.map((t) => [t.key, t.text]));
  } catch {
    return fromSeed(screenKey);
  }
});
