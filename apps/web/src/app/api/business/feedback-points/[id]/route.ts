import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const feedbackPoint = await FeedbackPoint.findOne({ _id: id, businessId: session.business._id });
  if (!feedbackPoint) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.name === "string") feedbackPoint.name = body.name;
  if (typeof body?.description === "string") feedbackPoint.description = body.description;
  if (typeof body?.active === "boolean") feedbackPoint.active = body.active;
  await feedbackPoint.save();

  return NextResponse.json({ status: "ok", feedbackPoint });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const removed = await FeedbackPoint.findOneAndDelete({ _id: id, businessId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
