import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, Business, buildFeedbackPointFromTemplate } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Centralized survey building for a multi-branch org (PRODUCT-ROADMAP.md
 * Phase 6, revised): a branch never builds its own survey — "don't give
 * survey building to branches, else every branch ends up with its own
 * survey" — so this is the one place a new point gets built for any branch
 * in the org, keeping the org's surveys consistent instead of drifting
 * branch by branch. Same composition rule as the standalone-business
 * route: pick an Admin-authored template, choose which of its existing
 * questions to include, set a quota — never write new question content.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const branches = await Business.find({ parentOrgId: session.org._id }).select("name maxFeedbackPoints").sort({ name: 1 });
  const branchIds = branches.map((b) => b._id);
  const points = await FeedbackPoint.find({ businessId: { $in: branchIds } }).sort({ createdAt: 1 });
  const branchNameById = new Map(branches.map((b) => [b._id.toString(), b.name]));

  return NextResponse.json({
    status: "ok",
    branches: branches.map((b) => ({ _id: b._id, name: b.name })),
    feedbackPoints: points.map((p) => ({ ...p.toObject(), businessName: branchNameById.get(p.businessId.toString()) ?? "Unknown branch" })),
  });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const businessId = typeof body?.businessId === "string" ? body.businessId : "";
  const business = businessId ? await Business.findOne({ _id: businessId, parentOrgId: session.org._id }) : null;
  if (!business) {
    return NextResponse.json({ status: "error", message: "Pick a branch that belongs to your organization" }, { status: 400 });
  }

  const result = await buildFeedbackPointFromTemplate({
    businessId: business._id,
    enabledProducts: business.enabledProducts,
    maxFeedbackPoints: business.maxFeedbackPoints,
    body,
  });
  if (result.status === "error") return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
