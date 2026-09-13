import { NextResponse } from "next/server";
import { connectToDatabase, Business, FeedbackPointRequest } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.businesses.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const item = await FeedbackPointRequest.findById(id);
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (session.role.permissions.businesses.scope === "assigned") {
    const business = await Business.findById(item.businessId);
    if (!business || business.accountManagerId?.toString() !== session.user._id.toString()) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);
  if (body?.status !== "resolved") {
    return NextResponse.json({ status: "error", message: "Only marking as resolved is supported" }, { status: 400 });
  }

  item.status = "resolved";
  item.resolvedAt = new Date();
  item.resolvedByUserId = session.user._id;
  await item.save();

  return NextResponse.json({ status: "ok" });
}
