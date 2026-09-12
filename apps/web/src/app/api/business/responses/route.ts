import { NextResponse } from "next/server";
import { connectToDatabase, Response } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const responses = await Response.find({ businessId: session.business._id }).sort({ submittedAt: -1 }).limit(200);
  return NextResponse.json({ status: "ok", responses });
}
