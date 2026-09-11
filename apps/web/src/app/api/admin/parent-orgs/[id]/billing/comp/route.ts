import { NextResponse } from "next/server";
import { connectToDatabase, markOwnerComp, BillingError } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

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
    if (err instanceof BillingError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
