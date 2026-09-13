import { NextResponse } from "next/server";
import { connectToDatabase, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const businesses = await Business.find({ parentOrgId: session.org._id }).select("name region billingAssignment active").sort({ name: 1 });
  return NextResponse.json({ status: "ok", businesses });
}
