import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * The actual fired-alert feed — distinct from /api/business/alert-rules,
 * which only returns each rule's own 30-day count/lastFiredAt summary for
 * the config page. This is every individual AlertActivity row (what fired,
 * when, at what value, who got emailed) for rules this business owns,
 * newest first. Includes rules cascaded down from a Parent Org, same
 * visibility the Alert Rules page already grants — a business owner should
 * see every alert that actually fired against their own data, not just
 * the ones from rules they personally created.
 */
export async function GET(req: Request) {
  const session = await requireBusinessOwner({ requirePage: "alerts" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 90, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const ruleFilter = session.business.parentOrgId
    ? {
        $or: [
          { scope: "business", ownerId: session.business._id },
          { scope: "parentOrg_all", ownerId: session.business.parentOrgId },
          { scope: "parentOrg_region", ownerId: session.business.parentOrgId, region: session.business.region },
        ],
      }
    : { scope: "business", ownerId: session.business._id };

  const rules = await AlertRule.find(ruleFilter);
  const ruleById = new Map(rules.map((r) => [r._id.toString(), r]));

  const activity = await AlertActivity.find({
    alertRuleId: { $in: rules.map((r) => r._id) },
    businessId: session.business._id,
    triggeredAt: { $gte: since },
  })
    .sort({ triggeredAt: -1 })
    .limit(500);

  const alerts = activity.map((a) => {
    const rule = ruleById.get(a.alertRuleId.toString());
    return {
      _id: a._id,
      triggeredAt: a.triggeredAt,
      snapshotValue: a.snapshotValue,
      ruleType: rule?.ruleType ?? "unknown",
      metric: rule?.metric ?? "",
      threshold: rule?.threshold ?? null,
      product: rule?.product ?? "customer_experience",
      recipients: rule?.recipients ?? [],
      isInherited: rule?.isInherited ?? false,
    };
  });

  return NextResponse.json({ status: "ok", alerts, windowDays: days });
}
