import { NextResponse } from "next/server";
import { connectToDatabase, DecisionLogEntry , hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

// Mirrors /api/group/decision-log, scoped to businessId instead of
// parentOrgId (spec Section 16 correction: a standalone business needs its
// own Decision Log, not just Group-managed businesses). Not available to
// limited-tier team members — same tier gating as Analytics/Billing.
//
// Same authorship split as /api/business/playbooks: a BRANCH doesn't get
// its own independent Decision Log (matches the spec's original "Business:
// none, Parent Org: full" intent) — its resolved cases are already logged
// under the org's Decision Log automatically (see logDecisionForResolution
// in action-board/[id]/route.ts, which sets parentOrgId/businessId:null for
// a branch's resolution). This GET surfaces those same org-scoped entries,
// filtered to ones that actually affect this branch, read-only. Querying by
// businessId here (as the old, branch-unaware version of this route did)
// would silently miss every one of them, since the auto-logged entries are
// never given a businessId when the resolving business is a branch.
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "decisionLog")) {
    return NextResponse.json({ status: "error", message: "Decision Log is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const isBranch = !!session.business.parentOrgId;
  const entries = await DecisionLogEntry.find(
    isBranch
      ? { parentOrgId: session.business.parentOrgId, affectedBusinessIds: session.business._id }
      : { businessId: session.business._id }
  ).sort({ createdAt: -1 });

  return NextResponse.json({ status: "ok", entries, readOnly: isBranch });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "decisionLog")) {
    return NextResponse.json({ status: "error", message: "Decision Log is not enabled for this account" }, { status: 403 });
  }
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "The Decision Log for a branch is managed by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const entry = await DecisionLogEntry.create({
    businessId: session.business._id,
    title,
    trigger: typeof body?.trigger === "string" ? body.trigger : "",
    linkedActionIds: Array.isArray(body?.linkedActionIds) ? body.linkedActionIds : [],
    affectedBusinessIds: [session.business._id],
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    implementationDate: typeof body?.implementationDate === "string" ? new Date(body.implementationDate) : null,
    outcomeMetricDescription: typeof body?.outcomeMetricDescription === "string" ? body.outcomeMetricDescription : "",
  });

  return NextResponse.json({ status: "ok", entry }, { status: 201 });
}
