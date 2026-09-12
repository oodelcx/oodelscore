import { NextResponse } from "next/server";
import { connectToDatabase, markOwnerComp } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  try {
    const subscription = await markOwnerComp({ ownerType: "parentOrg", ownerId: id });
    return NextResponse.json({ status: "ok", subscription });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
