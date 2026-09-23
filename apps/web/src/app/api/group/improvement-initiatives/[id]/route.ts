import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase, ImprovementInitiative, INITIATIVE_STATUSES , hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "improvementInitiatives" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const initiative = await ImprovementInitiative.findOne({ _id: id, parentOrgId: session.org._id });
  if (!initiative) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.title === "string" && body.title.trim()) initiative.title = body.title.trim();
  if (typeof body?.description === "string") initiative.description = body.description;
  if (INITIATIVE_STATUSES.includes(body?.status)) {
    initiative.status = body.status;
    if (body.status === "in_progress" && !initiative.startedAt) initiative.startedAt = new Date();
    if (body.status === "completed" && !initiative.completedAt) initiative.completedAt = new Date();
  }
  if (typeof body?.baselineMetricDescription === "string") initiative.baselineMetricDescription = body.baselineMetricDescription;
  if (typeof body?.baselineValue === "number") initiative.baselineValue = body.baselineValue;
  if (typeof body?.targetValue === "number") initiative.targetValue = body.targetValue;
  if (typeof body?.ownerId === "string") initiative.ownerId = new Types.ObjectId(body.ownerId);
  else if ("ownerId" in (body ?? {}) && body.ownerId === null) initiative.ownerId = null;
  if (Array.isArray(body?.linkedActionIds)) initiative.linkedActionIds = body.linkedActionIds;
  if (Array.isArray(body?.affectedBusinessIds)) initiative.affectedBusinessIds = body.affectedBusinessIds;
  await initiative.save();

  return NextResponse.json({ status: "ok", initiative });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "improvementInitiatives" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const removed = await ImprovementInitiative.findOneAndDelete({ _id: id, parentOrgId: session.org._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
