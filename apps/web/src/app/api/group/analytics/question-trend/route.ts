import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  Response,
  hasFeature,
  resolvePeriodRange,
  computeQuestionTrend,
  TREND_PERIODS,
  type TrendPeriod,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "analytics")) {
    return NextResponse.json({ status: "error", message: "Analytics is not enabled for this account" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId");
  const periodParam = searchParams.get("period") ?? "3m";
  if (!questionId) return NextResponse.json({ status: "error", message: "questionId is required" }, { status: 400 });
  const period: TrendPeriod = (TREND_PERIODS as readonly string[]).includes(periodParam) ? (periodParam as TrendPeriod) : "3m";

  await connectToDatabase();
  const now = new Date();
  const { from, granularity } = resolvePeriodRange(period, now);
  const businessIds = await Business.find({ parentOrgId: session.org._id }).distinct("_id");

  const responses = await Response.find({
    businessId: { $in: businessIds },
    submittedAt: { $gte: from, $lte: now },
    "answers.questionId": questionId,
  }).select("answers submittedAt");

  const trend = computeQuestionTrend(responses, questionId, from, now, granularity);
  return NextResponse.json({ status: "ok", period, granularity, trend });
}
