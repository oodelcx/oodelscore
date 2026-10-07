import { meetsAnonymityFloor } from "../anonymity";
import { Types } from "mongoose";
import { Response, type Sentiment } from "../models/Response";
import { Business } from "../models/Business";
import type { Product } from "../models/products";

/**
 * Highlights: the other tail of the distribution from Attention Centre.
 * Attention Centre surfaces what's going wrong, built entirely from
 * existing operational data (cases, alerts, playbooks); this surfaces
 * what's going right, built entirely from existing feedback data (star/NPS
 * scores already submitted, sentiment/themes already computed by
 * analyzeThemeSentiment on every response with open text) — no new AI
 * call, no new data collection, just reading the positive side of data
 * this app already has. Computed live on every request, same as Attention
 * Centre and Theme Intelligence — no separate stored "highlights" queue to
 * keep in sync.
 */

const STAR_HIGH_THRESHOLD = 4; // out of star_1_5's 1-5 scale
const NPS_PROMOTER_THRESHOLD = 9; // out of nps_0_10's 0-10 scale
const MAX_QUOTES = 30;
const MIN_THEME_SAMPLE = 3;

export interface HighlightQuote {
  id: string;
  businessId: string;
  businessName: string;
  quote: string;
  sentiment: Sentiment | null;
  starValue: number | null;
  npsValue: number | null;
  themes: string[];
  product: Product;
  submittedAt: string;
}

export interface PositiveThemeEntry {
  theme: string;
  frequency: number;
  positiveShare: number; // 0-1, the fraction of this theme's mentions that were positive
  representativeQuote: string | null;
}

export interface HighlightsResult {
  quotes: HighlightQuote[];
  topThemes: PositiveThemeEntry[];
  positiveResponseCount: number;
  totalResponseCount: number;
}

function hasHighScore(answers: { type: string; value: unknown }[]): { starValue: number | null; npsValue: number | null; qualifies: boolean } {
  let starValue: number | null = null;
  let npsValue: number | null = null;
  for (const answer of answers) {
    if (answer.type === "star_1_5" && typeof answer.value === "number") starValue = answer.value;
    else if (answer.type === "nps_0_10" && typeof answer.value === "number") npsValue = answer.value;
  }
  const qualifies = (starValue !== null && starValue >= STAR_HIGH_THRESHOLD) || (npsValue !== null && npsValue >= NPS_PROMOTER_THRESHOLD);
  return { starValue, npsValue, qualifies };
}

/**
 * businessIds: every business this owner can see Highlights for (one
 * business for a standalone account or a single branch, every branch's id
 * for a Group) — same convention Attention Centre's businessIds param uses.
 */
export async function computeHighlights(
  businessIds: (Types.ObjectId | string)[],
  from: Date,
  to: Date,
  product: Product = "customer_experience"
): Promise<HighlightsResult> {
  if (businessIds.length === 0) {
    return { quotes: [], topThemes: [], positiveResponseCount: 0, totalResponseCount: 0 };
  }

  const [allResponses, businesses] = await Promise.all([
    Response.find({
      businessId: { $in: businessIds },
      product,
      submittedAt: { $gte: from, $lte: to },
      // Comments routed to the sensitive contact never appear in a listing.
      ...(product === "colleague_experience" ? { sensitiveRouted: { $ne: true } } : {}),
    })
      .select("businessId answers sentiment themes submittedAt")
      .lean(),
    Business.find({ _id: { $in: businessIds } }).select("name").lean(),
  ]);
  // Colleague Experience: a branch with fewer than the anonymity floor of
  // responses contributes nothing, so a small team's comment can't be singled out.
  let responses = allResponses;
  if (product === "colleague_experience") {
    const countByBusiness = new Map<string, number>();
    for (const r of allResponses) countByBusiness.set(r.businessId.toString(), (countByBusiness.get(r.businessId.toString()) ?? 0) + 1);
    responses = allResponses.filter((r) => meetsAnonymityFloor(countByBusiness.get(r.businessId.toString()) ?? 0));
  }
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  interface ThemeAgg {
    frequency: number;
    positiveCount: number;
    quotes: { text: string; submittedAt: Date }[];
  }
  const byTheme = new Map<string, ThemeAgg>();
  const quotes: HighlightQuote[] = [];
  let positiveResponseCount = 0;

  for (const response of responses) {
    const { starValue, npsValue, qualifies } = hasHighScore(response.answers);
    const isPositive = response.sentiment === "positive" || qualifies;
    if (isPositive) positiveResponseCount++;

    for (const theme of response.themes) {
      const agg = byTheme.get(theme) ?? { frequency: 0, positiveCount: 0, quotes: [] };
      agg.frequency++;
      if (response.sentiment === "positive") agg.positiveCount++;
      const openText = response.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
      if (typeof openText?.value === "string" && response.sentiment === "positive") {
        agg.quotes.push({ text: openText.value.trim(), submittedAt: response.submittedAt });
      }
      byTheme.set(theme, agg);
    }

    const openText = response.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
    const quoteText = typeof openText?.value === "string" ? openText.value.trim() : null;
    // A quote needs actual text to be worth surfacing — a 5-star rating with
    // no comment is positive signal for the aggregate count above, but
    // nothing to read on the feed itself.
    if (isPositive && quoteText) {
      quotes.push({
        id: response._id.toString(),
        businessId: response.businessId.toString(),
        businessName: businessNameById.get(response.businessId.toString()) ?? "—",
        quote: quoteText,
        sentiment: response.sentiment,
        starValue,
        npsValue,
        themes: response.themes,
        product,
        submittedAt: response.submittedAt.toISOString(),
      });
    }
  }

  quotes.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const topThemes: PositiveThemeEntry[] = [...byTheme.entries()]
    .filter(([, agg]) => agg.frequency >= MIN_THEME_SAMPLE && agg.positiveCount / agg.frequency >= 0.5)
    .map(([theme, agg]) => ({
      theme,
      frequency: agg.frequency,
      positiveShare: agg.positiveCount / agg.frequency,
      representativeQuote: agg.quotes.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0]?.text ?? null,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  return {
    quotes: quotes.slice(0, MAX_QUOTES),
    topThemes,
    positiveResponseCount,
    totalResponseCount: responses.length,
  };
}
