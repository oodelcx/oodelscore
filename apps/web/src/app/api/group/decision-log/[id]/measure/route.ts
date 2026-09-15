import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, DecisionLogEntry, DECISION_OUTCOME_METRICS, computeDecisionOutcome } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Mirrors /api/business/decision-log/[id]/measure. */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const entry = await DecisionLogEntry.findOne({ _id: id, parentOrgId: session.org._id });
  if (!entry) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (DECISION_OUTCOME_METRICS.includes(body?.outcomeMetric)) entry.outcomeMetric = body.outcomeMetric;
  if (typeof body?.outcomeCategoryId === "string") entry.outcomeCategoryId = new Types.ObjectId(body.outcomeCategoryId);

  if (!entry.implementationDate) {
    return NextResponse.json({ status: "error", message: "Set an implementation date before measuring the outcome" }, { status: 400 });
  }
  if (!entry.outcomeMetric) {
    return NextResponse.json({ status: "error", message: "Choose a metric to measure" }, { status: 400 });
  }

  const result = await computeDecisionOutcome({
    businessId: entry.businessId,
    parentOrgId: entry.parentOrgId,
    affectedBusinessIds: entry.affectedBusinessIds,
    implementationDate: entry.implementationDate,
    outcomeMetric: entry.outcomeMetric,
    outcomeCategoryId: entry.outcomeCategoryId,
  });

  entry.outcomeBefore = result.outcomeBefore;
  if (result.outcomeAfter !== null) {
    entry.outcomeAfter = result.outcomeAfter;
    entry.outcomeMeasuredAt = new Date();
  }
  await entry.save();

  return NextResponse.json({ status: "ok", entry, verdict: result.verdict, daysSinceImplementation: result.daysSinceImplementation });
}
