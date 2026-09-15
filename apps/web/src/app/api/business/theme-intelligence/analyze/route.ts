import { NextResponse } from "next/server";
import { connectToDatabase, backfillThemeSentiment } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/** Manually triggered backfill for responses that predate Theme & Sentiment Intelligence, capped per call. */
export async function POST() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const result = await backfillThemeSentiment([session.business._id]);

  return NextResponse.json({ status: "ok", ...result });
}
