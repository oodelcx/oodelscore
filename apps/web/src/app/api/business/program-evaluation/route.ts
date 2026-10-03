import { NextResponse } from "next/server";
import { connectToDatabase, Event, ProgramEvaluationReport, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Every training Event this business has, joined with its evaluation
 * report when one exists — "not_run" for a training Event still waiting
 * on its grace period or a response count, same as "insufficient_data" /
 * "completed" read directly off the report once one exists.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "programEvaluation")) {
    return NextResponse.json({ status: "error", message: "Program Evaluation is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const [events, reports] = await Promise.all([
    Event.find({ businessId: session.business._id, category: "training" }).sort({ endsAt: -1, createdAt: -1 }),
    ProgramEvaluationReport.find({ businessId: session.business._id }),
  ]);
  const reportByEventId = new Map(reports.map((r) => [r.eventId.toString(), r]));

  const items = events.map((event) => ({
    event,
    report: reportByEventId.get(event._id.toString()) ?? null,
  }));

  return NextResponse.json({ status: "ok", items });
}
