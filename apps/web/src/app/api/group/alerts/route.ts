import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, Business, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * See business/alerts/route.ts for the same "real fired-alert feed,
 * distinct from the rule-config page's own 30-day summary" rationale.
 * Group scope: every alert that fired against any branch under this org,
 * from org-level rules (all/region) and each branch's own business-scope
 * rules alike — so an org owner sees the same thing a branch owner would,
 * just rolled up across every branch instead of filtered to one.
 */
export async function GET(req: Request) {
  const session = await requireParentOrgOwner({ requirePage: "alerts" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 90, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const branches = await Business.find({ parentOrgId: session.org._id }).select("_id name region");
  const branchIds = branches.map((b) => b._id);
  const branchById = new Map(branches.map((b) => [b._id.toString(), b]));

  const rules = await AlertRule.find({
    $or: [
      { scope: "business", ownerId: { $in: branchIds } },
      { scope: "parentOrg_all", ownerId: session.org._id },
      { scope: "parentOrg_region", ownerId: session.org._id },
    ],
  });
  const ruleById = new Map(rules.map((r) => [r._id.toString(), r]));

  const activity = await AlertActivity.find({
    alertRuleId: { $in: rules.map((r) => r._id) },
    businessId: { $in: branchIds },
    triggeredAt: { $gte: since },
  })
    .sort({ triggeredAt: -1 })
    .limit(1000);

  const alerts = activity.map((a) => {
    const rule = ruleById.get(a.alertRuleId.toString());
    const branch = branchById.get(a.businessId.toString());
    return {
      _id: a._id,
      triggeredAt: a.triggeredAt,
      snapshotValue: a.snapshotValue,
      businessId: a.businessId,
      businessName: branch?.name ?? "Unknown branch",
      region: branch?.region ?? "",
      ruleType: rule?.ruleType ?? "unknown",
      metric: rule?.metric ?? "",
      threshold: rule?.threshold ?? null,
      product: rule?.product ?? "customer_experience",
      recipients: rule?.recipients ?? [],
    };
  });

  return NextResponse.json({ status: "ok", alerts, windowDays: days });
}
