import { NextResponse } from "next/server";
import { connectToDatabase, hasProduct, computeCxExCorrelationRows } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Standalone businesses only — a branch's CX↔EX correlation is a
 * cross-branch question by nature (see the PDF: "branches ranked by both
 * scores together"), so it belongs to the parent org's own view, same
 * authorship split already used for Decision Log/Improvement Initiatives:
 * a branch doesn't get its own independent page for something that's
 * inherently a network-level comparison.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "cxExCorrelation" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "A branch's CX↔EX correlation is managed by its parent organization." },
      { status: 403 }
    );
  }
  if (!(hasProduct(session.business, "customer_experience") && hasProduct(session.business, "colleague_experience"))) {
    return NextResponse.json(
      { status: "error", message: "Requires both Customer Experience and Colleague Experience" },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rows = await computeCxExCorrelationRows([session.business._id], from, now);

  return NextResponse.json({ status: "ok", rows });
}
