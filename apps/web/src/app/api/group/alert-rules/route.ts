import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, AlertActivity, Business, ALERT_RULE_TYPES, ALERT_SCOPES , hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Spec Section 4: a Parent Org owner edits their own org-scope rules
 * (cascading to child businesses) and can see each child business's own
 * business-scope rules for oversight, without editing them directly.
 */
export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const orgRules = await AlertRule.find({
    ownerId: session.org._id,
    scope: { $in: ["parentOrg_all", "parentOrg_region"] },
  }).sort({ createdAt: 1 });

  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name region");
  const businessRules = await AlertRule.find({ scope: "business", ownerId: { $in: businesses.map((b) => b._id) } });

  // "Fired this week" per rule (spec: "this is what produces the Flagged
  // counts you see on Overview" — never hardcode, compute from alertActivity).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const allRuleIds = [...orgRules, ...businessRules].map((r) => r._id);
  const recentActivity = await AlertActivity.find({ alertRuleId: { $in: allRuleIds }, triggeredAt: { $gte: sevenDaysAgo } }).select(
    "alertRuleId businessId"
  );
  const firedCounts = new Map<string, Set<string>>();
  for (const a of recentActivity) {
    const key = a.alertRuleId.toString();
    const set = firedCounts.get(key) ?? new Set<string>();
    set.add(a.businessId.toString());
    firedCounts.set(key, set);
  }

  // Regional outlier needs at least 2 businesses in scope to ever compute a
  // group average to compare against — with only 1, evaluateBaselineAlerts
  // silently skips it forever. Surface that instead of leaving a rule that
  // can never fire look identical to one that's just quiet.
  function regionalOutlierWarning(rule: (typeof orgRules)[number]): string | null {
    if (rule.ruleType !== "regional_outlier") return null;
    const inScope =
      rule.scope === "parentOrg_region" ? businesses.filter((b) => b.region === rule.region) : businesses;
    return inScope.length < 2
      ? "Needs at least 2 businesses with data in scope to ever fire — only " + inScope.length + " right now."
      : null;
  }

  const withFired = (rules: typeof orgRules) =>
    rules.map((r) => ({ ...r.toObject(), firedCount: firedCounts.get(r._id.toString())?.size ?? 0, warning: regionalOutlierWarning(r) }));

  return NextResponse.json({ status: "ok", orgRules: withFired(orgRules), businessRules: withFired(businessRules), businesses });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const ruleType = typeof body?.ruleType === "string" ? body.ruleType : null;
  const scope = typeof body?.scope === "string" ? body.scope : null;
  if (!ruleType || !(ALERT_RULE_TYPES as readonly string[]).includes(ruleType)) {
    return NextResponse.json({ status: "error", message: "A valid ruleType is required" }, { status: 400 });
  }
  if (scope !== "parentOrg_all" && scope !== "parentOrg_region") {
    return NextResponse.json(
      { status: "error", message: `scope must be one of: parentOrg_all, parentOrg_region` },
      { status: 400 }
    );
  }
  if (scope === "parentOrg_region" && !ALERT_SCOPES.includes(scope)) {
    return NextResponse.json({ status: "error", message: "Invalid scope" }, { status: 400 });
  }

  const recipients = Array.isArray(body?.recipients) ? body.recipients.filter((r: unknown) => typeof r === "string") : [];

  const rule = await AlertRule.create({
    scope,
    ownerId: session.org._id,
    region: scope === "parentOrg_region" && typeof body?.region === "string" ? body.region : "",
    ruleType,
    metric: typeof body?.metric === "string" ? body.metric : "",
    threshold: typeof body?.threshold === "number" ? body.threshold : null,
    sensitivity: typeof body?.sensitivity === "number" ? body.sensitivity : null,
    baselineWindowDays: typeof body?.baselineWindowDays === "number" ? body.baselineWindowDays : null,
    dropPercent: typeof body?.dropPercent === "number" ? body.dropPercent : null,
    recipients,
    active: true,
    isInherited: true,
  });

  return NextResponse.json({ status: "ok", rule }, { status: 201 });
}
