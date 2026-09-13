import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  ParentOrganization,
  User,
  BillingSubscription,
  AiInsightReport,
  AlertRule,
  Response,
  FeedbackPointRequest,
  expireStaleInvites,
  findBillingIntegrityIssues,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Platform Overview (mockup: page-overview). Every number here is a real
 * query against the same collections the rest of Admin already reads —
 * nothing is hardcoded, and each "needs attention" row links to the page
 * that actually resolves it, mirroring the mockup's "click any row to go
 * straight to it."
 */
export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const { role, user } = session;

  await connectToDatabase();
  await expireStaleInvites();

  const businessFilter = role.permissions.businesses.scope === "assigned" ? { accountManagerId: user._id } : {};
  const orgFilter = role.permissions.parentOrgs.scope === "assigned" ? { accountManagerId: user._id } : {};

  const [businessCount, orgCount] = await Promise.all([
    role.permissions.businesses.view ? Business.countDocuments(businessFilter) : Promise.resolve(0),
    role.permissions.parentOrgs.view ? ParentOrganization.countDocuments(orgFilter) : Promise.resolve(0),
  ]);

  let platformMrr: number | null = null;
  let overdueCount = 0;
  let integrityIssueCount = 0;
  if (role.permissions.billingOversight.view) {
    const subscriptions = await BillingSubscription.find();
    platformMrr = subscriptions.filter((s) => !s.isComp).reduce((sum, s) => sum + s.mrrValue, 0);
    overdueCount = subscriptions.filter((s) => s.status === "overdue").length;
    const issues = await findBillingIntegrityIssues();
    integrityIssueCount = issues.orphanedSubscriptionIds.length + issues.groupPaysWithOwnSubscriptionIds.length;
  }

  let pendingAiCount: number | null = null;
  if (role.permissions.aiInsightsQueue.view) {
    const aiFilter: Record<string, unknown> = { status: "pending" };
    if (role.permissions.aiInsightsQueue.scope === "assigned") {
      const [assignedBusinessIds, assignedOrgIds] = await Promise.all([
        Business.find({ accountManagerId: user._id }).distinct("_id"),
        ParentOrganization.find({ accountManagerId: user._id }).distinct("_id"),
      ]);
      aiFilter.$or = [
        { ownerType: "business", ownerId: { $in: assignedBusinessIds } },
        { ownerType: "parentOrg", ownerId: { $in: assignedOrgIds } },
      ];
    }
    pendingAiCount = await AiInsightReport.countDocuments(aiFilter);
  }

  // Needs attention: invite-expired accounts
  const expiredUsers = await User.find({
    inviteStatus: "invite_expired",
    accountType: { $in: ["business", "parent_org"] },
  }).select("accountType parentId");

  // Needs attention: responses affected by the NPS/star legacy bug (mixed
  // answer types on one submission — see feedback-responses route).
  const mixedTypeCount = await Response.countDocuments({
    $and: [{ "answers.type": "star_1_5" }, { "answers.type": "nps_0_10" }],
  });

  // Needs attention: businesses asking for a new/changed feedback point —
  // they can't create these themselves, so this is the only signal Admin
  // gets short of checking email.
  let pendingFeedbackRequestIds: unknown[] = [];
  if (role.permissions.businesses.view) {
    const requestBusinessFilter =
      role.permissions.businesses.scope === "assigned" ? { accountManagerId: user._id } : {};
    const scopedBusinessIds = await Business.find(requestBusinessFilter).distinct("_id");
    pendingFeedbackRequestIds = await FeedbackPointRequest.find({
      status: "pending",
      businessId: { $in: scopedBusinessIds },
    }).distinct("_id");
  }

  // Needs attention: alert-rule recipients shared across more than one owner.
  const alertRules = await AlertRule.find().select("ownerId recipients");
  const ownerIdsByRecipient = new Map<string, Set<string>>();
  for (const rule of alertRules) {
    for (const recipient of rule.recipients) {
      const key = recipient.trim().toLowerCase();
      if (!key) continue;
      const owners = ownerIdsByRecipient.get(key) ?? new Set<string>();
      owners.add(rule.ownerId.toString());
      ownerIdsByRecipient.set(key, owners);
    }
  }
  const suspiciousRecipientCount = [...ownerIdsByRecipient.values()].filter((owners) => owners.size > 1).length;

  const needsAttention: { label: string; issue: string; severity: "red" | "amber"; href: string }[] = [];
  if (expiredUsers.length > 0) {
    needsAttention.push({
      label: `${expiredUsers.length} account(s)`,
      issue: "Invite expired",
      severity: "red",
      href: "/admin/accounts",
    });
  }
  if (integrityIssueCount > 0) {
    needsAttention.push({
      label: `${integrityIssueCount} billing record(s)`,
      issue: "Unlinked / orphaned billing data",
      severity: "amber",
      href: "/admin/billing",
    });
  }
  if (pendingFeedbackRequestIds.length > 0) {
    needsAttention.push({
      label: `${pendingFeedbackRequestIds.length} request(s)`,
      issue: "Business asking for a new or changed feedback point",
      severity: "amber",
      href: "/admin/feedback-requests",
    });
  }
  if (mixedTypeCount > 0) {
    needsAttention.push({
      label: "Feedback Responses",
      issue: `${mixedTypeCount} response(s) mix NPS with star ratings — legacy scoring-bug audit`,
      severity: "red",
      href: "/admin/feedback-responses",
    });
  }
  if (suspiciousRecipientCount > 0) {
    needsAttention.push({
      label: "Alert rules",
      issue: `${suspiciousRecipientCount} recipient(s) shared across unrelated accounts`,
      severity: "amber",
      href: "/admin/alert-rules",
    });
  }
  if (overdueCount > 0) {
    needsAttention.push({
      label: `${overdueCount} subscription(s)`,
      issue: "Payment overdue",
      severity: "amber",
      href: "/admin/billing",
    });
  }

  return NextResponse.json({
    status: "ok",
    metrics: {
      totalAccounts: businessCount + orgCount,
      businessCount,
      orgCount,
      platformMrr,
      pendingAiCount,
    },
    needsAttention,
  });
}
