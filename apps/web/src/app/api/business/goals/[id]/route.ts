import { NextResponse } from "next/server";
import { connectToDatabase, CxGoal, CX_GOAL_STATUSES } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const goal = await CxGoal.findOne({ _id: id, ownerType: "business", ownerId: session.business._id });
  if (!goal) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.label === "string" && body.label.trim()) goal.label = body.label.trim();
  if (typeof body?.targetValue === "number") goal.targetValue = body.targetValue;
  if (typeof body?.targetDate === "string") goal.targetDate = new Date(body.targetDate);
  if (CX_GOAL_STATUSES.includes(body?.status)) goal.status = body.status;
  await goal.save();

  return NextResponse.json({ status: "ok", goal });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const removed = await CxGoal.findOneAndDelete({ _id: id, ownerType: "business", ownerId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
