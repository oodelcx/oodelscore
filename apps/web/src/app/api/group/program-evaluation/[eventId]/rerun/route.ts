import { NextResponse } from "next/server";
import { connectToDatabase, Business, Event, generateProgramEvaluationForEvent, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { eventId } = await params;
  await connectToDatabase();
  const event = await Event.findById(eventId);
  if (!event) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const business = await Business.findOne({ _id: event.businessId, parentOrgId: session.org._id });
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (!hasFeature(session.org.enabledFeatures, "programEvaluation")) {
    return NextResponse.json({ status: "error", message: "Program Evaluation is not enabled for this organization" }, { status: 403 });
  }
  if (event.category !== "training") {
    return NextResponse.json({ status: "error", message: "Only a training-category event can be evaluated" }, { status: 400 });
  }

  const report = await generateProgramEvaluationForEvent(event._id);
  return NextResponse.json({ status: "ok", report });
}
