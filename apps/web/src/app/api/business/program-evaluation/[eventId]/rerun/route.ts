import { NextResponse } from "next/server";
import { connectToDatabase, Event, generateProgramEvaluationForEvent, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * Manual re-run — the one way a report updates after its first run (see
 * generateDueProgramEvaluations's own comment on why a late straggler
 * response doesn't auto-trigger one). No grace-period or endsAt check
 * here: a business asking for this on purpose already knows what it's
 * doing, unlike the cron's auto-trigger which needs to wait for the
 * window to close.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "programEvaluation")) {
    return NextResponse.json({ status: "error", message: "Program Evaluation is not enabled for this account" }, { status: 403 });
  }

  const { eventId } = await params;
  await connectToDatabase();
  const event = await Event.findOne({ _id: eventId, businessId: session.business._id });
  if (!event) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (event.category !== "training") {
    return NextResponse.json({ status: "error", message: "Only a training-category event can be evaluated" }, { status: 400 });
  }

  const report = await generateProgramEvaluationForEvent(event._id);
  return NextResponse.json({ status: "ok", report });
}
