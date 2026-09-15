import { NextResponse } from "next/server";
import { connectToDatabase, Business, backfillThemeSentiment } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Manually triggered backfill across every branch in the org, capped per call. */
export async function POST() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const result = await backfillThemeSentiment(businesses.map((b) => b._id));

  return NextResponse.json({ status: "ok", ...result });
}
