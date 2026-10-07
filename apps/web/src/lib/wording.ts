import { SEED_TOOLTIPS } from "@oodelscore/shared";
import { getTooltips } from "@/lib/tooltips";

export const COLLEAGUE_WORDING_SCREEN = "colleague-wording";

/**
 * The words a colleague-product screen uses where the customer product says
 * CSAT / CES / CX Pulse. Admin edits these in Site CMS -> Tooltips ("Colleague
 * Experience wording"); a blank edit falls back to the shipped default so a
 * label can never render empty.
 */
export async function getColleagueWording(): Promise<Record<string, string>> {
  const defaults = Object.fromEntries(
    (SEED_TOOLTIPS.find((s) => s.screenKey === COLLEAGUE_WORDING_SCREEN)?.tooltips ?? []).map((t) => [t.key, t.text])
  );
  const saved = await getTooltips(COLLEAGUE_WORDING_SCREEN);
  const merged: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(saved)) if (typeof v === "string" && v.trim()) merged[k] = v.trim();
  return merged;
}
