import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, DecisionLogEntry, DECISION_STATUSES , hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "decisionLog")) {
    return NextResponse.json({ status: "error", message: "Decision Log is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const entry = await DecisionLogEntry.findOne({ _id: id, businessId: session.business._id });
  if (!entry) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.title === "string" && body.title.trim()) entry.title = body.title.trim();
  if (typeof body?.trigger === "string") entry.trigger = body.trigger.trim();
  if (DECISION_STATUSES.includes(body?.status)) {
    entry.status = body.status;
    // Marking something "Implemented" without ever setting when is a real
    // gap the status dropdown otherwise has — this is what makes the
    // 14-day auto-measure clock actually start ticking for someone who
    // just flips the status instead of separately opening Measure Outcome.
    if (body.status === "implemented" && !entry.implementationDate) entry.implementationDate = new Date();
  }
  if (typeof body?.implementationDate === "string") entry.implementationDate = new Date(body.implementationDate);
  if (typeof body?.outcomeMetricDescription === "string") entry.outcomeMetricDescription = body.outcomeMetricDescription;
  if (typeof body?.outcomeBefore === "number") entry.outcomeBefore = body.outcomeBefore;
  if (typeof body?.outcomeAfter === "number") {
    entry.outcomeAfter = body.outcomeAfter;
    entry.outcomeMeasuredAt = new Date();
  }
  if (typeof body?.ownerId === "string") entry.ownerId = new Types.ObjectId(body.ownerId);
  else if ("ownerId" in (body ?? {}) && body.ownerId === null) entry.ownerId = null;
  await entry.save();

  return NextResponse.json({ status: "ok", entry });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "decisionLog")) {
    return NextResponse.json({ status: "error", message: "Decision Log is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const removed = await DecisionLogEntry.findOneAndDelete({ _id: id, businessId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
