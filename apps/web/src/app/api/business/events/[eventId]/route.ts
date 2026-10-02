import { NextResponse } from "next/server";
import { connectToDatabase, Event, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * Narrowly scoped to the program-evaluation fields only — same pattern as
 * /api/business/feedback-points/[fpId]'s endsAt-only PATCH. Everything
 * else about an Event (name, dates, location, category) stays Admin-
 * managed, same as the rest of the Events model; this is business content
 * (what their own training is actually for), not survey/question
 * structure, so there's no reason to route it through Admin.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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
    return NextResponse.json({ status: "error", message: "Only a training-category event has program details" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const synopsis = typeof body?.synopsis === "string" ? body.synopsis.trim() : (event.programDetails?.synopsis ?? "");
  const objectives = Array.isArray(body?.objectives)
    ? body.objectives.filter((o: unknown): o is string => typeof o === "string" && o.trim().length > 0).map((o: string) => o.trim())
    : (event.programDetails?.objectives ?? []);
  const expectedOutcomes = Array.isArray(body?.expectedOutcomes)
    ? body.expectedOutcomes.filter((o: unknown): o is string => typeof o === "string" && o.trim().length > 0).map((o: string) => o.trim())
    : (event.programDetails?.expectedOutcomes ?? []);

  event.programDetails = { synopsis, objectives, expectedOutcomes };
  await event.save();

  return NextResponse.json({ status: "ok", event });
}
