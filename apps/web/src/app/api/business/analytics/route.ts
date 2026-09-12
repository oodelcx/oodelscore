import { NextResponse } from "next/server";
import { connectToDatabase, Response, Category, computeDailyTrend } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

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
    .slice(0, 10);
}

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businessId = session.business._id;
  const now = new Date();
  const from = new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000);

  const [trend, responses, categories] = await Promise.all([
    computeDailyTrend([businessId], TREND_DAYS, now),
    Response.find({ businessId, submittedAt: { $gte: from } }),
    Category.find(),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const npsAnswers: number[] = [];
  const categoryTotals = new Map<string, { sum: number; count: number }>();
  const comments: string[] = [];
  const ageGroups = new Map<string, number>();
  const genders = new Map<string, number>();
  const devices = new Map<string, number>();
  // [dayOfWeek 0-6][hourOfDay 0-23] — server-local time, good enough for
  // "when do people scan" at the granularity a business actually acts on.
  const dayHourCounts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const response of responses) {
    if (response.demographics.ageGroup) ageGroups.set(response.demographics.ageGroup, (ageGroups.get(response.demographics.ageGroup) ?? 0) + 1);
    if (response.demographics.gender) genders.set(response.demographics.gender, (genders.get(response.demographics.gender) ?? 0) + 1);
    devices.set(response.deviceType, (devices.get(response.deviceType) ?? 0) + 1);
    dayHourCounts[response.submittedAt.getDay()][response.submittedAt.getHours()] += 1;

    for (const answer of response.answers) {
      if (answer.type === "nps_0_10" && typeof answer.value === "number") npsAnswers.push(answer.value);
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
    trend,
    npsBreakdown: { promoters, passives, detractors },
    categoryBreakdown,
    commentTags: extractTags(comments),
    demographics: {
      ageGroups: Array.from(ageGroups.entries()).map(([label, count]) => ({ label, count })),
      genders: Array.from(genders.entries()).map(([label, count]) => ({ label, count })),
    },
    scanPatterns: {
      deviceBreakdown: Array.from(devices.entries()).map(([label, count]) => ({ label, count })),
      dayHourCounts,
    },
  });
}
