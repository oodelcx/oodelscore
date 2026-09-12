import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectToDatabase, FeedbackPoint } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const points = await FeedbackPoint.find({ businessId: session.business._id }).sort({ createdAt: 1 });
  return NextResponse.json({ status: "ok", feedbackPoints: points });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const existingCount = await FeedbackPoint.countDocuments({ businessId: session.business._id });
  if (existingCount >= session.business.maxFeedbackPoints) {
    return NextResponse.json(
      { status: "error", message: `Your plan allows up to ${session.business.maxFeedbackPoints} feedback point(s)` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });
  }

  const feedbackPoint = await FeedbackPoint.create({
    businessId: session.business._id,
    name,
    description: typeof body?.description === "string" ? body.description : "",
    qrToken: randomBytes(16).toString("hex"),
  });

  return NextResponse.json({ status: "ok", feedbackPoint }, { status: 201 });
}
