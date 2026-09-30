import { NextResponse } from "next/server";
import { connectToDatabase, Business, Response, Category, computeDailyTrend , hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

const TREND_DAYS = 30;
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "was", "were", "is", "are", "it", "to", "of", "in", "for",
  "on", "with", "at", "this", "that", "we", "i", "our", "very", "so", "had", "have", "has", "be",
  "there", "them", "they", "my", "me", "us", "you", "your", "as", "not", "no", "did", "do", "just",
]);

function extractTags(comments: string[]): { word: string; count: number; negative: boolean }[] {
  const counts = new Map<string, { count: number; negativeCount: number }>();
  for (const comment of comments) {
    const isNegative = /\b(bad|slow|wait|long|cold|rude|dirty|poor|late|never|worst|disappoint)\w*\b/i.test(comment);
    const words = comment.toLowerCase().match(/[a-z']+/g) ?? [];
    for (const word of words) {
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      const entry = counts.get(word) ?? { count: 0, negativeCount: 0 };
      entry.count += 1;
      if (isNegative) entry.negativeCount += 1;
      counts.set(word, entry);
    }
  }
  return Array.from(counts.entries())
    .map(([word, { count, negativeCount }]) => ({ word, count, negative: negativeCount > count / 2 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "analytics" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "analytics")) {
    return NextResponse.json({ status: "error", message: "Analytics is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  // A dual-product org's Analytics must respect the active product tab —
  // without this filter, CX and CE responses/categories were pooled
  // together regardless of which tab was open (the entire point of
  // Response.product/Category.product existing).
  const product = await resolveViewProduct(session.org);
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const businessIds = businesses.map((b) => b._id);
  const now = new Date();
  const from = new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000);

  const [trend, responses, categories] = await Promise.all([
    computeDailyTrend(businessIds, TREND_DAYS, now, product),
    Response.find({ businessId: { $in: businessIds }, submittedAt: { $gte: from }, product }),
    Category.find({ product }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const npsAnswers: number[] = [];
  let csatSatisfied = 0;
  let csatTotal = 0;
  let cesSum = 0;
  let cesLowEffort = 0;
  let cesTotal = 0;
  const categoryTotals = new Map<string, { sum: number; count: number }>();
  const comments: string[] = [];

  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "nps_0_10" && typeof answer.value === "number") npsAnswers.push(answer.value);
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        csatTotal += 1;
        if (answer.value >= 4) csatSatisfied += 1;
      }
      if (answer.type === "ces_1_5" && typeof answer.value === "number") {
        cesTotal += 1;
        cesSum += answer.value;
        if (answer.value <= 2) cesLowEffort += 1;
      }
      if (answer.type === "star_1_5" && typeof answer.value === "number" && answer.categoryId) {
        const key = answer.categoryId.toString();
        const entry = categoryTotals.get(key) ?? { sum: 0, count: 0 };
        entry.sum += answer.value;
        entry.count += 1;
        categoryTotals.set(key, entry);
      }
      if (answer.type === "open_text" && typeof answer.value === "string" && answer.value.trim()) {
        comments.push(answer.value);
      }
    }
  }

  const promoters = npsAnswers.filter((v) => v >= 9).length;
  const passives = npsAnswers.filter((v) => v >= 7 && v <= 8).length;
  const detractors = npsAnswers.filter((v) => v <= 6).length;

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([id, { sum, count }]) => ({ name: categoryNameById.get(id) ?? "Uncategorized", average: Math.round((sum / count) * 100) / 100 }))
    .sort((a, b) => b.average - a.average);

  return NextResponse.json({
    status: "ok",
    product,
    trend,
    npsBreakdown: { promoters, passives, detractors, sampleSize: npsAnswers.length },
    csat: {
      percent: csatTotal === 0 ? null : Math.round((csatSatisfied / csatTotal) * 1000) / 10,
      sampleSize: csatTotal,
    },
    ces: {
      average: cesTotal === 0 ? null : Math.round((cesSum / cesTotal) * 100) / 100,
      lowEffortPercent: cesTotal === 0 ? null : Math.round((cesLowEffort / cesTotal) * 1000) / 10,
      sampleSize: cesTotal,
    },
    categoryBreakdown,
    commentTags: extractTags(comments),
  });
}
