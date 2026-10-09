import { Types } from "mongoose";
import { Response } from "../models/Response";
import { Business } from "../models/Business";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { meetsAnonymityFloor } from "../anonymity";
import { computeCxExCorrelationRows, type CxExCorrelationRow } from "./cxExCorrelation";
import { computeThemeIntelligence } from "./themeIntelligence";
import type { Product } from "../models/products";
import {
  summariseCorrelation, regress, residualSigma, quadrantOf, laggedCorrelation, staffConceptOf, customerConceptOf, linkPainPoints, nextStepFor,
  QUADRANT_COPY, type Quadrant, type CorrelationSummary, type LagResult, type LinkedPainPoint, type StaffConcept, type CustomerConcept, type ConceptSignal,
} from "./storyStats";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CE_WEEK_FLOOR = 5; // a weekly staff number is a slice too: never shown under the anonymity floor
const CX_WEEK_FLOOR = 3;

export interface StoryRow extends CxExCorrelationRow {
  quadrant: Quadrant | null;
  /** Customer score against what this branch's staff score predicts, in standard deviations (negative = customers worse than expected). */
  residualSigma: number | null;
  topLink: Pick<LinkedPainPoint, "staffLabel" | "customerLabel"> | null;
  linkCount: number;
}

export interface WeeklyPoint {
  weekStart: string;
  customer: number | null; // average star rating
  staff: number | null; // eNPS
}

export interface NetworkStory {
  rows: StoryRow[];
  network: {
    correlation: CorrelationSummary;
    regression: { slope: number; intercept: number } | null;
    quadrants: Record<Quadrant, number>;
    lag: LagResult | null;
    weekly: WeeklyPoint[];
    staffSuppressedBranches: number;
  };
}

type ThemeAggRow = { _id: { b: Types.ObjectId; t: string; s: string | null }; n: number };

async function themeSignals(ids: Types.ObjectId[], product: Product, from: Date, to: Date) {
  const rows = await Response.aggregate<ThemeAggRow>([
    { $match: { businessId: { $in: ids }, product, submittedAt: { $gte: from, $lte: to }, "themes.0": { $exists: true } } },
    { $unwind: "$themes" },
    { $group: { _id: { b: "$businessId", t: "$themes", s: "$sentiment" }, n: { $sum: 1 } } },
  ]);
  return rows;
}

function signals<C extends string>(rows: ThemeAggRow[], conceptOf: (t: string) => C | null): Map<string, Map<C, ConceptSignal>> {
  const out = new Map<string, Map<C, ConceptSignal>>();
  for (const r of rows) {
    const c = conceptOf(r._id.t);
    if (!c) continue;
    const key = r._id.b.toString();
    const m = out.get(key) ?? new Map<C, ConceptSignal>();
    const s = m.get(c) ?? { negative: 0, total: 0 };
    s.total += r.n;
    if (r._id.s === "negative") s.negative += r.n;
    m.set(c, s);
    out.set(key, m);
  }
  return out;
}

interface WeekAgg { _id: { w: Date; p: Product }; n: number; sum: number; promoters: number; detractors: number }

async function weeklySeries(ids: Types.ObjectId[], weeks: number, now: Date, floors = true): Promise<WeeklyPoint[]> {
  const from = new Date(now.getTime() - weeks * WEEK_MS);
  const rows = await Response.aggregate<WeekAgg>([
    { $match: { businessId: { $in: ids }, submittedAt: { $gte: from, $lte: now } } },
    { $unwind: "$answers" },
    { $match: { $or: [{ product: "customer_experience", "answers.type": "star_1_5" }, { product: "colleague_experience", "answers.type": "nps_0_10" }], "answers.value": { $type: "number" } } },
    {
      $group: {
        _id: { w: { $dateTrunc: { date: "$submittedAt", unit: "week" } }, p: "$product" },
        n: { $sum: 1 },
        sum: { $sum: "$answers.value" },
        promoters: { $sum: { $cond: [{ $gte: ["$answers.value", 9] }, 1, 0] } },
        detractors: { $sum: { $cond: [{ $lte: ["$answers.value", 6] }, 1, 0] } },
      },
    },
  ]);
  const byWeek = new Map<number, WeeklyPoint>();
  for (const r of rows) {
    const t = new Date(r._id.w).getTime();
    const pt = byWeek.get(t) ?? { weekStart: new Date(t).toISOString(), customer: null, staff: null };
    if (r._id.p === "customer_experience") {
      if (!floors || r.n >= CX_WEEK_FLOOR) pt.customer = Math.round((r.sum / r.n) * 100) / 100;
    } else if (!floors || (meetsAnonymityFloor(r.n) && r.n >= CE_WEEK_FLOOR)) {
      pt.staff = Math.round(((r.promoters - r.detractors) / r.n) * 100);
    }
    byWeek.set(t, pt);
  }
  return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

function severity(r: CxExCorrelationRow): number {
  // Higher = worse; used only to order within a quadrant.
  const cx = r.cxStarAverage === null ? 0 : Math.max(0, 5 - r.cxStarAverage);
  const ce = r.ceEnps === null ? 0 : Math.max(0, (50 - r.ceEnps) / 25);
  return cx + ce;
}

const QUADRANT_ORDER: Record<string, number> = { both_low: 0, staff_low: 1, customer_low: 2, both_ok: 3, none: 4 };

export async function computeNetworkStory(businessIds: (Types.ObjectId | string)[], from: Date, to: Date): Promise<NetworkStory> {
  const ids = businessIds.map((b) => new Types.ObjectId(String(b)));
  const base = await computeCxExCorrelationRows(ids, from, to);
  const points = base.filter((r) => r.cxStarAverage !== null && r.ceEnps !== null).map((r) => ({ x: r.ceEnps as number, y: r.cxStarAverage as number }));
  const reg = regress(points);

  const [cxThemes, ceThemes, weekly] = await Promise.all([
    themeSignals(ids, "customer_experience", from, to),
    themeSignals(ids, "colleague_experience", from, to),
    weeklySeries(ids, 16, to),
  ]);
  const cxByBranch = signals<CustomerConcept>(cxThemes, customerConceptOf);
  const ceByBranch = signals<StaffConcept>(ceThemes, staffConceptOf);

  const rows: StoryRow[] = base.map((r) => {
    const quadrant = quadrantOf(r.cxStarAverage, r.ceEnps);
    const sigma = r.cxStarAverage !== null && r.ceEnps !== null ? residualSigma({ x: r.ceEnps, y: r.cxStarAverage }, reg) : null;
    // Staff themes only count for a branch that meets the anonymity floor.
    const staffSignals = r.ceBelowAnonymityFloor ? new Map<StaffConcept, ConceptSignal>() : ceByBranch.get(r.businessId) ?? new Map<StaffConcept, ConceptSignal>();
    const links = linkPainPoints(staffSignals, cxByBranch.get(r.businessId) ?? new Map<CustomerConcept, ConceptSignal>());
    return { ...r, quadrant, residualSigma: sigma, topLink: links[0] ? { staffLabel: links[0].staffLabel, customerLabel: links[0].customerLabel } : null, linkCount: links.length };
  });
  rows.sort((a, b) => {
    const q = QUADRANT_ORDER[a.quadrant ?? "none"] - QUADRANT_ORDER[b.quadrant ?? "none"];
    return q !== 0 ? q : severity(b) - severity(a);
  });

  const quadrants: Record<Quadrant, number> = { both_low: 0, staff_low: 0, customer_low: 0, both_ok: 0 };
  for (const r of rows) if (r.quadrant) quadrants[r.quadrant]++;

  return {
    rows,
    network: {
      correlation: summariseCorrelation(points),
      regression: reg ? { slope: reg.slope, intercept: reg.intercept } : null,
      quadrants,
      lag: laggedCorrelation(weekly.map((w) => w.staff), weekly.map((w) => w.customer)),
      weekly,
      staffSuppressedBranches: rows.filter((r) => r.ceBelowAnonymityFloor).length,
    },
  };
}

export interface BranchStoryDetail {
  row: StoryRow;
  quadrantCopy: { label: string; meaning: string };
  headline: string;
  rank: { customer: { position: number; of: number } | null; staff: { position: number; of: number } | null };
  weekly: WeeklyPoint[];
  customerThemes: { theme: string; frequency: number; negative: number; quote: string | null }[];
  /** Aggregate only, and only when the branch meets the anonymity floor; no staff comment is ever shown. */
  staffThemes: { theme: string; frequency: number; negative: number }[] | null;
  staffSuppressedReason: string | null;
  links: (LinkedPainPoint & { nextStep: string })[];
  openCases: number;
}

export async function computeBranchStoryDetail(businessId: string, peerIds: (Types.ObjectId | string)[], from: Date, to: Date): Promise<BranchStoryDetail | null> {
  const network = await computeNetworkStory(peerIds, from, to);
  const row = network.rows.find((r) => r.businessId === businessId);
  if (!row) return null;
  const id = new Types.ObjectId(businessId);
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));

  const [weekly, cxEntries, ceEntries, openCases, biz] = await Promise.all([
    weeklySeries([id], 12, to),
    computeThemeIntelligence([id], from, to, prevFrom, prevTo, "customer_experience"),
    row.ceBelowAnonymityFloor ? Promise.resolve([]) : computeThemeIntelligence([id], from, to, prevFrom, prevTo, "colleague_experience"),
    ActionBoardItem.countDocuments({ businessId: id, status: { $ne: "resolved" } }),
    Business.findById(id).select("name"),
  ]);
  void biz;

  const cxSignals = new Map<CustomerConcept, ConceptSignal>();
  const customerThemes = cxEntries.map((e) => {
    const c = customerConceptOf(e.theme);
    if (c) {
      const s = cxSignals.get(c) ?? { negative: 0, total: 0 };
      s.negative += e.sentimentBreakdown.negative;
      s.total += e.frequency;
      cxSignals.set(c, s);
    }
    return { theme: e.theme, frequency: e.frequency, negative: e.sentimentBreakdown.negative, quote: e.representativeQuote };
  });

  const ceSignals = new Map<StaffConcept, ConceptSignal>();
  const staffThemesAll = ceEntries
    .map((e) => {
      const c = staffConceptOf(e.theme);
      if (c) {
        const s = ceSignals.get(c) ?? { negative: 0, total: 0 };
        s.negative += e.sentimentBreakdown.negative;
        s.total += e.frequency;
        ceSignals.set(c, s);
      }
      return { theme: e.theme, frequency: e.frequency, negative: e.sentimentBreakdown.negative };
    })
    .filter((t) => t.frequency >= 3); // a theme only a couple of people raised could point at them
  const links = linkPainPoints(ceSignals, cxSignals).map((l) => ({ ...l, nextStep: nextStepFor(l) }));

  const withCx = network.rows.filter((r) => r.cxStarAverage !== null).sort((a, b) => (b.cxStarAverage as number) - (a.cxStarAverage as number));
  const withCe = network.rows.filter((r) => r.ceEnps !== null).sort((a, b) => (b.ceEnps as number) - (a.ceEnps as number));
  const pos = (list: StoryRow[]) => { const i = list.findIndex((r) => r.businessId === businessId); return i < 0 ? null : { position: i + 1, of: list.length }; };

  const q = row.quadrant ? QUADRANT_COPY[row.quadrant] : { label: "Not enough data", meaning: row.ceBelowAnonymityFloor ? "Fewer than five staff responses, so staff numbers are held back to protect anonymity." : "No customer responses in this period." };
  let headline = q.meaning;
  if (row.residualSigma !== null && row.residualSigma <= -1.5) headline += ` Customers rate this branch ${Math.abs(row.residualSigma)} standard deviations below what its staff score would predict, so something beyond people is likely involved.`;
  else if (row.residualSigma !== null && row.residualSigma >= 1.5) headline += ` Customers rate this branch well above what its staff score predicts: worth learning what it does right.`;

  return {
    row,
    quadrantCopy: q,
    headline,
    rank: { customer: pos(withCx), staff: pos(withCe) },
    weekly,
    customerThemes: customerThemes.slice(0, 8),
    staffThemes: row.ceBelowAnonymityFloor ? null : staffThemesAll.slice(0, 8),
    staffSuppressedReason: row.ceBelowAnonymityFloor ? "Fewer than five staff responses in this period. Staff numbers and themes are held back to protect anonymity." : null,
    links,
    openCases,
  };
}
