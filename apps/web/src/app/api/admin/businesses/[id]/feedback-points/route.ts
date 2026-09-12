import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectToDatabase, FeedbackPoint, Business } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Feedback Points are Admin/account-manager managed (per the mockup:
 * businesses view them read-only and "request" changes, they don't
 * self-serve create) — this is the real creation path.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const points = await FeedbackPoint.find({ businessId: id }).sort({ createdAt: 1 });
  return NextResponse.json({ status: "ok", feedbackPoints: points });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Business not found" }, { status: 404 });

  const existingCount = await FeedbackPoint.countDocuments({ businessId: id });
  if (existingCount >= business.maxFeedbackPoints) {
    return NextResponse.json(
      { status: "error", message: `This business's plan allows up to ${business.maxFeedbackPoints} feedback point(s)` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });

  const feedbackPoint = await FeedbackPoint.create({
    businessId: id,
    name,
    description: typeof body?.description === "string" ? body.description : "",
    qrToken: randomBytes(16).toString("hex"),
    questionTemplateOverride: typeof body?.questionTemplateOverride === "string" ? body.questionTemplateOverride : null,
  });

  return NextResponse.json({ status: "ok", feedbackPoint }, { status: 201 });
}
