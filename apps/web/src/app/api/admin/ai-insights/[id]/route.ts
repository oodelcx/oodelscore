import { NextResponse } from "next/server";
import {
  connectToDatabase,
  AiInsightReport,
  Business,
  ParentOrganization,
  AI_REPORT_STATUSES,
  resolveOwnerLoginEmail,
  sendTemplatedEmail,
} from "@oodelscore/shared";
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
 * visibility. Approving (a transition into "approved") also fires the
 * `report_ready` email (spec Section 11's trigger table already names this
 * key, and it was already seeded — it just never got dispatched anywhere)
 * to the report owner's login, same fire-and-forget-with-logging pattern as
 * every other templated send in this codebase — a failed send must never
 * block the approval itself.
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

  const wasApproved = report.status === "approved";

  if (body.status !== undefined) {
    if (!STATUS_SET.includes(body.status)) {
      return NextResponse.json({ status: "error", message: "Invalid status" }, { status: 400 });
    }
    report.status = body.status;
    report.reviewedAt = new Date();
    report.reviewedBy = session.user._id;
  }
  if (typeof body.bodyMarkdown === "string") report.bodyMarkdown = body.bodyMarkdown;

  await report.save();

  if (!wasApproved && report.status === "approved") {
    const recipient = await resolveOwnerLoginEmail(report.ownerType, report.ownerId);
    if (recipient) {
      const insightsPath = report.ownerType === "business" ? "/business/insights" : "/group/insights";
      const ownerLabel =
        report.ownerType === "business"
          ? (await Business.findById(report.ownerId))?.name
          : (await ParentOrganization.findById(report.ownerId))?.name;
      await sendTemplatedEmail("report_ready", recipient, {
        name: recipient,
        report_period: report.period,
        business_name: ownerLabel ?? "your account",
        report_link: `${process.env.APP_URL ?? ""}${insightsPath}`,
      }).catch((err) => console.error("[ai-insights] failed to send report_ready", err));
    }
  }

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
