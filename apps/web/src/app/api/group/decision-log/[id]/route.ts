import { NextResponse } from "next/server";
import { connectToDatabase, DecisionLogEntry, DECISION_STATUSES } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const entry = await DecisionLogEntry.findOne({ _id: id, parentOrgId: session.org._id });
  if (!entry) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (DECISION_STATUSES.includes(body?.status)) entry.status = body.status;
  if (typeof body?.implementationDate === "string") entry.implementationDate = new Date(body.implementationDate);
  if (typeof body?.outcomeBefore === "number") entry.outcomeBefore = body.outcomeBefore;
  if (typeof body?.outcomeAfter === "number") {
    entry.outcomeAfter = body.outcomeAfter;
    entry.outcomeMeasuredAt = new Date();
  }
  await entry.save();

  return NextResponse.json({ status: "ok", entry });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const removed = await DecisionLogEntry.findOneAndDelete({ _id: id, parentOrgId: session.org._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
