import { Types } from "mongoose";
import { Business } from "../models/Business";
import { computeBusinessMetrics } from "./aggregate";

// Below this many responses, a score is noise, not a signal — never assert
// a branch is "materially below average" or rank it against peers on this
// few data points. Mirrors the same discipline AI Insights reports already
// apply to small-sample periods (spec Section 10).
const RELIABLE_SAMPLE_SIZE = 20;
const DIRECTIONAL_SAMPLE_SIZE = 5;

export type BenchmarkConfidence = "strong" | "directional" | "insufficient";

export function confidenceForSampleSize(responseCount: number): BenchmarkConfidence {
  if (responseCount >= RELIABLE_SAMPLE_SIZE) return "strong";
  if (responseCount >= DIRECTIONAL_SAMPLE_SIZE) return "directional";
  return "insufficient";
}

export interface BusinessSummary {
  businessId: string;
  name: string;
  region: string;
  billingAssignment: string;
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  confidence: BenchmarkConfidence;
}

/**
 * Per-business metrics for every business in a parent org, over one window.
 * Loops computeBusinessMetrics per business — fine at the scale this app
 * runs at; would want a single aggregation pipeline if a network grows into
 * the thousands of businesses.
 */
export async function computeNetworkSummaries(parentOrgId: Types.ObjectId | string, from: Date, to: Date): Promise<BusinessSummary[]> {
  const businesses = await Business.find({ parentOrgId, active: true });
  return Promise.all(
    businesses.map(async (b) => {
      const metrics = await computeBusinessMetrics(b._id, from, to);
      return {
        businessId: b._id.toString(),
        name: b.name,
        region: b.region,
        billingAssignment: b.billingAssignment,
        starAverage: metrics.starAverage,
        npsScore: metrics.npsScore,
        responseCount: metrics.responseCount,
        confidence: confidenceForSampleSize(metrics.responseCount),
      };
    })
  );
}

export interface RegionSummary {
  region: string;
  businessCount: number;
  starAverage: number | null;
  npsScore: number | null;
  flaggedCount: number;
  confidence: BenchmarkConfidence;
}

/** Groups business summaries by region, per the Overview page's region rollup table. */
export function groupByRegion(summaries: BusinessSummary[], flaggedBusinessIds: Set<string>): RegionSummary[] {
  const byRegion = new Map<string, BusinessSummary[]>();
  for (const summary of summaries) {
    const key = summary.region || "Unassigned";
    const list = byRegion.get(key) ?? [];
    list.push(summary);
    byRegion.set(key, list);
  }

  return Array.from(byRegion.entries()).map(([region, list]) => {
    const withScores = list.filter((s) => s.starAverage !== null);
    const npsWithScores = list.filter((s) => s.npsScore !== null);
    const totalResponses = list.reduce((sum, s) => sum + s.responseCount, 0);
    return {
      region,
      businessCount: list.length,
      starAverage:
        withScores.length === 0 ? null : Math.round((withScores.reduce((sum, s) => sum + (s.starAverage as number), 0) / withScores.length) * 100) / 100,
      npsScore:
        npsWithScores.length === 0 ? null : Math.round(npsWithScores.reduce((sum, s) => sum + (s.npsScore as number), 0) / npsWithScores.length),
      flaggedCount: list.filter((s) => flaggedBusinessIds.has(s.businessId)).length,
      confidence: confidenceForSampleSize(totalResponses),
    };
  });
}

export interface OutlierResult {
  businessId: string;
  name: string;
  region: string;
  starAverage: number;
  sigmaBelowRegion: number;
}

/**
 * Businesses scoring meaningfully (1+ std dev) below their own region's
 * average — the Overview "Needs attention" list. A branch with too few
 * responses to be "strong" or "directional" confidence is never flagged
 * here, even if its raw average happens to be low — that's false precision
 * from noise, not a real signal (same rule the network-benchmark plan uses).
 */
export function findNeedsAttention(summaries: BusinessSummary[]): OutlierResult[] {
  const byRegion = new Map<string, BusinessSummary[]>();
  for (const s of summaries) {
    const key = s.region || "Unassigned";
    const list = byRegion.get(key) ?? [];
    list.push(s);
    byRegion.set(key, list);
  }

  const results: OutlierResult[] = [];
  for (const list of byRegion.values()) {
    const values = list.map((s) => s.starAverage).filter((v): v is number => v !== null);
    if (values.length < 2) continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;

    for (const business of list) {
      if (business.starAverage === null || business.confidence === "insufficient") continue;
      const sigma = (mean - business.starAverage) / stdDev;
      if (sigma >= 1) {
        results.push({
          businessId: business.businessId,
          name: business.name,
          region: business.region,
          starAverage: business.starAverage,
          sigmaBelowRegion: Math.round(sigma * 10) / 10,
        });
      }
    }
  }
  return results.sort((a, b) => b.sigmaBelowRegion - a.sigmaBelowRegion);
}
