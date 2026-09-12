import { NextResponse } from "next/server";
import { connectToDatabase, CxPulseScore } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const score = await CxPulseScore.findOne({ ownerType: "business", ownerId: session.business._id }).sort({ period: -1 });
  return NextResponse.json({ status: "ok", score });
}
