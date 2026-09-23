import { NextResponse } from "next/server";
import { connectToDatabase, Response, Category, FeedbackPoint, Event, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import type { FilterQuery } from "mongoose";
import type { IResponse } from "@oodelscore/shared";

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

/** Buckets a set of already-filtered responses into one average-star-rating point per day. */
function trendFromResponses(responses: IResponse[], from: Date, to: Date) {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const response of responses) {
    for (const answer of response.answers) {
      if (answer.type === "star_1_5" && typeof answer.value === "number") {
        const day = response.submittedAt.toISOString().slice(0, 10);
        const entry = byDay.get(day) ?? { sum: 0, count: 0 };
        entry.sum += answer.value;
        entry.count += 1;
        byDay.set(day, entry);
      }
    }
  }
  const points: { date: string; starAverage: number | null }[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
    const day = new Date(t).toISOString().slice(0, 10);
    const entry = byDay.get(day);
    points.push({ date: day, starAverage: entry ? Math.round((entry.sum / entry.count) * 100) / 100 : null });
  }
  return points;
}

export async function GET(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "analytics" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "analytics")) {
    return NextResponse.json({ status: "error", message: "Analytics is not enabled for this account" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const feedbackPointId = searchParams.get("feedbackPointId");
  const eventId = searchParams.get("eventId");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  await connectToDatabase();
  const businessId = session.business._id;
  const now = new Date();
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now;
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000);

  const filter: FilterQuery<IResponse> = { businessId, submittedAt: { $gte: from, $lte: to } };
  if (feedbackPointId) filter.feedbackPointId = feedbackPointId;
  if (eventId) filter.eventId = eventId;

  const [responses, categories, feedbackPoints, events] = await Promise.all([
    Response.find(filter),
    Category.find(),
    FeedbackPoint.find({ businessId }).select("name eventId").sort({ createdAt: 1 }),
    Event.find({ businessId }).sort({ createdAt: -1 }),
  ]);
  const trend = trendFromResponses(responses, from, to);
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

  // "Compare by event": always computed across ALL of the business's
  // events in range, independent of the feedbackPointId/eventId filters
  // above — those filters narrow the detail charts, this table is the
  // side-by-side comparison the filters would otherwise hide one row of.
  let eventBreakdown: {
    _id: string;
    name: string;
    seriesKey: string;
    facilitator: string;
    location: string;
    responseCount: number;
    starAverage: number | null;
    responseRate: number | null;
  }[] = [];
  if (events.length > 0) {
    const eventResponses = await Response.find({
      businessId,
      submittedAt: { $gte: from, $lte: to },
      eventId: { $ne: null },
    }).select("eventId answers");

    const statsByEvent = new Map<string, { count: number; starSum: number; starCount: number }>();
    for (const response of eventResponses) {
      const key = response.eventId!.toString();
      const entry = statsByEvent.get(key) ?? { count: 0, starSum: 0, starCount: 0 };
      entry.count += 1;
      for (const answer of response.answers) {
        if (answer.type === "star_1_5" && typeof answer.value === "number") {
          entry.starSum += answer.value;
          entry.starCount += 1;
        }
      }
      statsByEvent.set(key, entry);
    }

    eventBreakdown = events.map((e) => {
      const stats = statsByEvent.get(e._id.toString());
      const responseCount = stats?.count ?? 0;
      return {
        _id: e._id.toString(),
        name: e.name,
        seriesKey: e.seriesKey,
        facilitator: e.facilitator,
        location: e.location,
        responseCount,
        starAverage: stats && stats.starCount > 0 ? Math.round((stats.starSum / stats.starCount) * 100) / 100 : null,
        responseRate: e.expectedAttendees ? Math.round((responseCount / e.expectedAttendees) * 1000) / 10 : null,
      };
    });
  }

  return NextResponse.json({
    status: "ok",
    feedbackPoints: feedbackPoints.map((p) => ({ _id: p._id.toString(), name: p.name, eventId: p.eventId ? p.eventId.toString() : null })),
    events: events.map((e) => ({ _id: e._id.toString(), name: e.name, seriesKey: e.seriesKey })),
    eventBreakdown,
    filters: {
      feedbackPointId: feedbackPointId ?? null,
      eventId: eventId ?? null,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
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
