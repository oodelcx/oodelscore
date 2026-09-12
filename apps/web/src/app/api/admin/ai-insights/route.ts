import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport, Business, ParentOrganization, AI_REPORT_STATUSES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const STATUS_SET: readonly string[] = AI_REPORT_STATUSES;

/**
 * Admin's review queue for AI-generated insight reports (mockup:
 * page-ai-queue). Nothing here fabricates report content — this reads
 * whatever the generation pipeline (spec Section 10, Claude Batch API) has
 * written to `aiInsightReports`. If that pipeline hasn't run yet, this
 * legitimately returns an empty list rather than sample data.
 */
export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.aiInsightsQueue;
  if (!permission.view) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") {
    if (!STATUS_SET.includes(status)) {
      return NextResponse.json({ status: "error", message: "Invalid status" }, { status: 400 });
    }
    filter.status = status;
  }

  if (permission.scope === "assigned") {
    const [businessIds, orgIds] = await Promise.all([
      Business.find({ accountManagerId: session.user._id }).distinct("_id"),
      ParentOrganization.find({ accountManagerId: session.user._id }).distinct("_id"),
    ]);
    filter.$or = [
      { ownerType: "business", ownerId: { $in: businessIds } },
      { ownerType: "parentOrg", ownerId: { $in: orgIds } },
    ];
  }

  const reports = await AiInsightReport.find(filter).sort({ generatedAt: -1 }).limit(100);

  const businessIds = reports.filter((r) => r.ownerType === "business").map((r) => r.ownerId);
  const orgIds = reports.filter((r) => r.ownerType === "parentOrg").map((r) => r.ownerId);
  const [businesses, orgs] = await Promise.all([
    Business.find({ _id: { $in: businessIds } }).select("name"),
    ParentOrganization.find({ _id: { $in: orgIds } }).select("name"),
  ]);
  const nameById = new Map<string, string>([
    ...businesses.map((b) => [b._id.toString(), b.name] as const),
    ...orgs.map((o) => [o._id.toString(), o.name] as const),
  ]);

  const enriched = reports.map((r) => ({ ...r.toObject(), ownerName: nameById.get(r.ownerId.toString()) ?? "Unknown" }));
  return NextResponse.json({ status: "ok", reports: enriched });
}
