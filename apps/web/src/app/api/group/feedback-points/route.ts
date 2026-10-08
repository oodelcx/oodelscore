import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, Business, buildFeedbackPointFromTemplate } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Centralized survey building for a multi-branch org (PRODUCT-ROADMAP.md
 * Phase 6, revised): a branch never builds its own survey — "don't give
 * survey building to branches, else every branch ends up with its own
 * survey" — so this is the one place a new point gets built for any branch
 * in the org, keeping the org's surveys consistent instead of drifting
 * branch by branch. Same real question-authoring builder as the
 * standalone-business route: any text, any QUESTION_TYPES, optionally
 * seeded from a copy of an Admin template, set a quota.
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
  const ids: string[] = Array.isArray(body?.businessIds)
    ? body.businessIds.filter((x: unknown): x is string => typeof x === "string")
    : typeof body?.businessId === "string"
      ? [body.businessId]
      : [];
  const branches = ids.length ? await Business.find({ _id: { $in: ids }, parentOrgId: session.org._id }) : [];
  if (branches.length === 0 || branches.length !== new Set(ids).size) {
    return NextResponse.json({ status: "error", message: "Pick at least one branch that belongs to your organization" }, { status: 400 });
  }

  let last: Awaited<ReturnType<typeof buildFeedbackPointFromTemplate>> | null = null;
  for (const business of branches) {
    const result = await buildFeedbackPointFromTemplate({
      businessId: business._id,
      enabledProducts: business.enabledProducts,
      maxFeedbackPoints: business.maxFeedbackPoints,
      body,
    });
    if (result.status === "error") {
      return NextResponse.json(
        { ...result, message: `${business.name}: ${result.message}${last ? " (earlier branches were already created)" : ""}` },
        { status: 400 },
      );
    }
    last = result;
  }
  return NextResponse.json({ ...last, created: branches.length }, { status: 201 });
}
