import { Types } from "mongoose";
import { Response, type Sentiment } from "../models/Response";
import type { Product } from "../models/products";

export interface ThemeIntelligenceEntry {
  theme: string;
  frequency: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  trend: "up" | "down" | "flat" | null; // null when there isn't enough history in the prior period to judge
  representativeQuote: string | null;
}

const MIN_SAMPLE_FOR_TREND = 3;
const TREND_THRESHOLD = 0.15; // change in (positive-negative)/total needed to call it a real move, not noise

function sentimentScore(counts: { positive: number; neutral: number; negative: number }): number | null {
  const total = counts.positive + counts.neutral + counts.negative;
  if (total < MIN_SAMPLE_FOR_TREND) return null;
  return (counts.positive - counts.negative) / total;
}

/**
 * Aggregates the per-response theme tags and sentiment labels that
 * analyzeThemeSentiment already wrote onto `responses` into a ranked "what
 * are people actually talking about" view — frequency, sentiment mix,
 * trend vs. the prior period, and one representative quote per theme.
 * Pure aggregation over already-analyzed data, no AI call here.
 */
export async function computeThemeIntelligence(
  businessIds: (Types.ObjectId | string)[],
  from: Date,
  to: Date,
  previousFrom: Date,
  previousTo: Date,
  product: Product = "customer_experience"
): Promise<ThemeIntelligenceEntry[]> {
  if (businessIds.length === 0) return [];

  const [current, previous] = await Promise.all([
    Response.find({
      businessId: { $in: businessIds },
      product,
      submittedAt: { $gte: from, $lte: to },
      "themes.0": { $exists: true },
    })
      .select("themes sentiment answers submittedAt")
      .lean(),
    Response.find({
      businessId: { $in: businessIds },
      product,
      submittedAt: { $gte: previousFrom, $lte: previousTo },
      "themes.0": { $exists: true },
    })
      .select("themes sentiment")
      .lean(),
  ]);

  interface ThemeAgg {
    frequency: number;
    counts: { positive: number; neutral: number; negative: number };
    quotes: { text: string; submittedAt: Date; sentiment: Sentiment | null }[];
  }
  const byTheme = new Map<string, ThemeAgg>();

  function bump(sentiment: Sentiment | null, counts: ThemeAgg["counts"]) {
    if (sentiment === "positive") counts.positive++;
    else if (sentiment === "negative") counts.negative++;
    else counts.neutral++;
  }

  for (const response of current) {
    const openText = response.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
    const quoteText = typeof openText?.value === "string" ? openText.value.trim() : null;
    for (const theme of response.themes) {
      const agg = byTheme.get(theme) ?? { frequency: 0, counts: { positive: 0, neutral: 0, negative: 0 }, quotes: [] };
      agg.frequency++;
      bump(response.sentiment, agg.counts);
      if (quoteText) agg.quotes.push({ text: quoteText, submittedAt: response.submittedAt, sentiment: response.sentiment });
      byTheme.set(theme, agg);
    }
  }

  const previousByTheme = new Map<string, { positive: number; neutral: number; negative: number }>();
  for (const response of previous) {
    for (const theme of response.themes) {
      const counts = previousByTheme.get(theme) ?? { positive: 0, neutral: 0, negative: 0 };
      bump(response.sentiment, counts);
      previousByTheme.set(theme, counts);
    }
  }

  const entries: ThemeIntelligenceEntry[] = Array.from(byTheme.entries()).map(([theme, agg]) => {
    const currentScore = sentimentScore(agg.counts);
    const previousScore = sentimentScore(previousByTheme.get(theme) ?? { positive: 0, neutral: 0, negative: 0 });
    let trend: ThemeIntelligenceEntry["trend"] = null;
    if (currentScore !== null && previousScore !== null) {
      const delta = currentScore - previousScore;
      trend = delta > TREND_THRESHOLD ? "up" : delta < -TREND_THRESHOLD ? "down" : "flat";
    }

    // Prefer a quote whose sentiment matches the theme's dominant sentiment, most recent first.
    const dominant: Sentiment =
      agg.counts.negative >= agg.counts.positive && agg.counts.negative >= agg.counts.neutral
        ? "negative"
        : agg.counts.positive >= agg.counts.neutral
          ? "positive"
          : "neutral";
    const sortedQuotes = [...agg.quotes].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    const representative = sortedQuotes.find((q) => q.sentiment === dominant) ?? sortedQuotes[0] ?? null;

    return {
      theme,
      frequency: agg.frequency,
      sentimentBreakdown: agg.counts,
      trend,
      representativeQuote: representative ? representative.text.slice(0, 240) : null,
    };
  });

  return entries.sort((a, b) => b.frequency - a.frequency);
}
