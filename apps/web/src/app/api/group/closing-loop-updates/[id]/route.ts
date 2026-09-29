import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, ClosingLoopUpdate, hasFeature, hasProduct } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience") || !hasFeature(session.org.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const update = await ClosingLoopUpdate.findOne({ _id: id, parentOrgId: session.org._id });
  if (!update) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (update.status === "sent") {
    return NextResponse.json({ status: "error", message: "This update was already sent and can't be edited." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body?.whatWeHeard === "string") update.whatWeHeard = body.whatWeHeard.trim();
  if (typeof body?.whatWereDoing === "string") update.whatWereDoing = body.whatWereDoing.trim();
  if (typeof body?.linkedInitiativeId === "string") update.linkedInitiativeId = new Types.ObjectId(body.linkedInitiativeId);
  else if ("linkedInitiativeId" in (body ?? {}) && body.linkedInitiativeId === null) update.linkedInitiativeId = null;
  if (typeof body?.linkedDecisionId === "string") update.linkedDecisionId = new Types.ObjectId(body.linkedDecisionId);
  else if ("linkedDecisionId" in (body ?? {}) && body.linkedDecisionId === null) update.linkedDecisionId = null;
  if (Array.isArray(body?.affectedBusinessIds)) update.affectedBusinessIds = body.affectedBusinessIds;
  await update.save();

  return NextResponse.json({ status: "ok", update });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience") || !hasFeature(session.org.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const removed = await ClosingLoopUpdate.findOneAndDelete({ _id: id, parentOrgId: session.org._id, status: "draft" });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found, or already sent" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
