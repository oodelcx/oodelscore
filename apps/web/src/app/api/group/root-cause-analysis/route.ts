import { NextResponse } from "next/server";
import { connectToDatabase, Business, gatherRootCauseEvidence, analyzeRootCause } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/** Same "why is this happening?" analysis, pooled across every branch in the org. */
export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  if (!categoryId) return NextResponse.json({ status: "error", message: "categoryId is required" }, { status: 400 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const evidence = await gatherRootCauseEvidence(
    businesses.map((b) => b._id),
    categoryId
  );
  const analysis = await analyzeRootCause(evidence);

  return NextResponse.json({ status: "ok", evidence, analysis });
}
