import { NextResponse } from "next/server";
import { connectToDatabase, findPortfolioSignals } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const signals = await findPortfolioSignals();
  return NextResponse.json({ status: "ok", signals });
}
