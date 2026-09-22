import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, ALERT_RULE_TYPES , hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Spec Section 4: a Business owner can edit their own business-scope rules,
 * and views (but never edits) rules cascaded down from their Parent Org.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const own = await AlertRule.find({ scope: "business", ownerId: session.business._id }).sort({ createdAt: 1 });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activityByRuleId = new Map<string, { count: number; lastFiredAt: Date }>();
  for (const rule of own) {
    const activity = await AlertActivity.find({ alertRuleId: rule._id, triggeredAt: { $gte: thirtyDaysAgo } }).sort({ triggeredAt: -1 });
    if (activity.length > 0) activityByRuleId.set(rule._id.toString(), { count: activity.length, lastFiredAt: activity[0].triggeredAt });
  }
  const ownWithActivity = own.map((rule) => ({ ...rule.toObject(), activity: activityByRuleId.get(rule._id.toString()) ?? null }));

  let inherited: unknown[] = [];
  if (session.business.parentOrgId) {
    inherited = await AlertRule.find({
      $or: [
        { scope: "parentOrg_all", ownerId: session.business.parentOrgId },
        { scope: "parentOrg_region", ownerId: session.business.parentOrgId, region: session.business.region },
      ],
    });
  }

  return NextResponse.json({ status: "ok", ownRules: ownWithActivity, inheritedRules: inherited });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const ruleType = typeof body?.ruleType === "string" ? body.ruleType : null;
  if (!ruleType || !(ALERT_RULE_TYPES as readonly string[]).includes(ruleType)) {
    return NextResponse.json({ status: "error", message: "A valid ruleType is required" }, { status: 400 });
  }
  if (ruleType === "regional_outlier" || ruleType === "sudden_drop") {
    return NextResponse.json(
      { status: "error", message: "This rule type requires comparing across businesses — set it up from the Group portal instead" },
      { status: 400 }
    );
  }

  const recipients = Array.isArray(body?.recipients) ? body.recipients.filter((r: unknown) => typeof r === "string") : [];

  const rule = await AlertRule.create({
    scope: "business",
    ownerId: session.business._id,
    ruleType,
    metric: typeof body?.metric === "string" ? body.metric : "",
    threshold: typeof body?.threshold === "number" ? body.threshold : null,
    recipients,
    active: true,
    isInherited: false,
  });

  return NextResponse.json({ status: "ok", rule }, { status: 201 });
}
