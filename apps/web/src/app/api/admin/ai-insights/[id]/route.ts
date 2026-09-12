import { NextResponse } from "next/server";
import { connectToDatabase, AiInsightReport, Business, ParentOrganization, AI_REPORT_STATUSES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };
const STATUS_SET: readonly string[] = AI_REPORT_STATUSES;

async function assertInScope(
  report: { ownerType: "business" | "parentOrg"; ownerId: unknown },
  scope: "all" | "assigned",
  userId: unknown
): Promise<boolean> {
  if (scope === "all") return true;
  if (report.ownerType === "business") {
    const business = await Business.findById(report.ownerId);
    return Boolean(business && business.accountManagerId?.toString() === String(userId));
  }
  const org = await ParentOrganization.findById(report.ownerId);
  return Boolean(org && org.accountManagerId?.toString() === String(userId));
}

/**
 * Approve / reject / edit-before-publish. Rule (spec Section 10, see
 * AiInsightReport.ts): a report is invisible on any Group/Business
 * dashboard while status is "pending" — approving here is what flips that
 * visibility. No Resend email is sent yet (Resend integration isn't built
 * in this codebase — see build order); wiring the "Report Ready" trigger
 * is a follow-up once Resend lands.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.aiInsightsQueue;
  if (!permission.edit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const report = await AiInsightReport.findById(id);
  if (!report) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (!(await assertInScope(report, permission.scope, session.user._id))) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ status: "error", message: "Invalid body" }, { status: 400 });

  if (body.status !== undefined) {
    if (!STATUS_SET.includes(body.status)) {
      return NextResponse.json({ status: "error", message: "Invalid status" }, { status: 400 });
    }
    report.status = body.status;
    report.reviewedAt = new Date();
    report.reviewedBy = session.user._id;
  }
  if (typeof body.bodyMarkdown === "string") report.bodyMarkdown = body.bodyMarkdown;
  if (typeof body.showChartOnDashboard === "boolean") report.showChartOnDashboard = body.showChartOnDashboard;

  await report.save();
  return NextResponse.json({ status: "ok", report });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.aiInsightsQueue;
  if (!permission.delete) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const report = await AiInsightReport.findById(id);
  if (!report) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (!(await assertInScope(report, permission.scope, session.user._id))) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await report.deleteOne();
  return NextResponse.json({ status: "ok" });
}
