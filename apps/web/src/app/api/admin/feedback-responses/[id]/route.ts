import { NextResponse } from "next/server";
import { connectToDatabase, Response, Business } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.businesses;
  if (!permission.delete) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const response = await Response.findById(id);
  if (!response) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (permission.scope === "assigned") {
    const business = await Business.findById(response.businessId);
    if (!business || business.accountManagerId?.toString() !== session.user._id.toString()) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }
  }

  await response.deleteOne();
  return NextResponse.json({ status: "ok" });
}
