import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  connectToDatabase,
  CxGoal,
  CX_GOAL_METRICS,
  computeCurrentMetricValue,
  computeGoalProgress,
  type CxGoalMetric,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Mirrors /api/business/goals, scoped to the whole org (every branch pooled). */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const goals = await CxGoal.find({ ownerType: "parentOrg", ownerId: session.org._id }).sort({ createdAt: -1 });

  const enriched = await Promise.all(
    goals.map(async (goal) => {
      const currentValue = await computeCurrentMetricValue(goal);
      const progress = computeGoalProgress(goal.metric, goal.startValue, goal.targetValue, goal.targetDate, goal.createdAt, currentValue);
      return { ...goal.toObject(), ...progress };
    })
  );

  return NextResponse.json({ status: "ok", goals: enriched });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const metric: CxGoalMetric | undefined = CX_GOAL_METRICS.includes(body?.metric) ? body.metric : undefined;
  const targetValue = typeof body?.targetValue === "number" ? body.targetValue : NaN;
  const targetDate = typeof body?.targetDate === "string" ? new Date(body.targetDate) : null;
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : null;

  if (!label) return NextResponse.json({ status: "error", message: "label is required" }, { status: 400 });
  if (!metric) return NextResponse.json({ status: "error", message: "A valid metric is required" }, { status: 400 });
  if (metric === "categoryAverage" && !categoryId) {
    return NextResponse.json({ status: "error", message: "categoryId is required for a category goal" }, { status: 400 });
  }
  if (Number.isNaN(targetValue)) return NextResponse.json({ status: "error", message: "targetValue is required" }, { status: 400 });
  if (!targetDate || Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ status: "error", message: "A valid targetDate is required" }, { status: 400 });
  }

  const categoryObjectId = categoryId ? new Types.ObjectId(categoryId) : null;
  const startValue = await computeCurrentMetricValue({
    ownerType: "parentOrg",
    ownerId: session.org._id,
    metric,
    categoryId: categoryObjectId,
  });

  const goal = await CxGoal.create({
    ownerType: "parentOrg",
    ownerId: session.org._id,
    label,
    metric,
    categoryId: categoryObjectId,
    startValue,
    targetValue,
    targetDate,
    createdBy: session.user._id,
  });

  return NextResponse.json({ status: "ok", goal }, { status: 201 });
}
