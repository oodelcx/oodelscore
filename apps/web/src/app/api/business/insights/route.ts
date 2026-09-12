import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/** Only ever "approved" — pending reports are never visible on a dashboard (spec Section 10). */
export async function GET(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  await connectToDatabase();
  const filter: Record<string, unknown> = { ownerType: "business", ownerId: session.business._id, status: "approved" };
  if (period) filter.period = period;

  const reports = await AiInsightReport.find(filter).sort({ periodStart: -1 }).limit(20);
  return NextResponse.json({ status: "ok", reports });
}
