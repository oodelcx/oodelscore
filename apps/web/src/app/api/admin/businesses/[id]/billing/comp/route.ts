import { NextResponse } from "next/server";
import { connectToDatabase, markOwnerComp, Business, COMP_PERIODS, type CompPeriod } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const period: CompPeriod = COMP_PERIODS.includes(body?.period) ? body.period : "unlimited";
  const customExpiresAt = period === "custom" && typeof body?.customExpiresAt === "string" ? new Date(body.customExpiresAt) : null;
  if (period === "custom" && (!customExpiresAt || Number.isNaN(customExpiresAt.getTime()))) {
    return NextResponse.json({ status: "error", message: "customExpiresAt is required for a custom period" }, { status: 400 });
  }

  await connectToDatabase();

  try {
    const subscription = await markOwnerComp({ ownerType: "business", ownerId: id, period, customExpiresAt });
    await Business.findByIdAndUpdate(id, { plan: "comp" });
    return NextResponse.json({ status: "ok", subscription });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
