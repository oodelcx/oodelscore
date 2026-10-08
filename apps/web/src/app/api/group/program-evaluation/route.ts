import { NextResponse } from "next/server";
import { connectToDatabase, Business, Event, ProgramEvaluationReport, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Every training Event across every branch of this org whose branch has
 * Program Evaluation enabled, joined with its report. The feature flag
 * lives on each branch Business, not the org — see
 * ../../admin/businesses/[id]/business-detail-client.tsx's note on why
 * this isn't also a ParentOrganization-level toggle.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const org = session.org;
  if (!hasFeature(org.enabledFeatures, "programEvaluation")) {
    return NextResponse.json({ status: "error", message: "Program Evaluation is not enabled for this organization" }, { status: 403 });
  }
  const branches = await Business.find({ parentOrgId: org._id }).select("_id name");
  const enabledBranchIds = branches.map((b) => b._id);
  const branchNameById = new Map(branches.map((b) => [b._id.toString(), b.name]));

  if (enabledBranchIds.length === 0) return NextResponse.json({ status: "ok", items: [] });

  const [events, reports] = await Promise.all([
    Event.find({ businessId: { $in: enabledBranchIds }, category: "training" }).sort({ endsAt: -1, createdAt: -1 }),
    ProgramEvaluationReport.find({ businessId: { $in: enabledBranchIds } }),
  ]);
  const reportByEventId = new Map(reports.map((r) => [r.eventId.toString(), r]));

  const items = events.map((event) => ({
    event,
    branchName: branchNameById.get(event.businessId.toString()) ?? "—",
    report: reportByEventId.get(event._id.toString()) ?? null,
  }));

  return NextResponse.json({ status: "ok", items });
}
