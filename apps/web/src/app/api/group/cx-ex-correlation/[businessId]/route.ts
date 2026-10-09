import { NextResponse } from "next/server";
import { connectToDatabase, Business, hasProduct, computeBranchStoryDetail } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ businessId: string }> };

/** One branch's customer-and-staff story. Same access as the network page; the branch must belong to this group. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "cxExCorrelation" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(hasProduct(session.org, "customer_experience") && hasProduct(session.org, "colleague_experience"))) {
    return NextResponse.json({ status: "error", message: "Requires both Customer Experience and Colleague Experience" }, { status: 403 });
  }
  const { businessId } = await params;
  await connectToDatabase();
  const branches = await Business.find({ parentOrgId: session.org._id, active: true }).select("_id");
  if (!branches.some((b) => b._id.toString() === businessId)) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const detail = await computeBranchStoryDetail(businessId, branches.map((b) => b._id), from, now);
  if (!detail) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  return NextResponse.json({ status: "ok", detail });
}
