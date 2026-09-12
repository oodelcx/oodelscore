import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, Business, ALERT_RULE_TYPES, ALERT_DELIVERY_MODES, ALERT_SCOPES } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Spec Section 4: a Parent Org owner edits their own org-scope rules
 * (cascading to child businesses) and can see each child business's own
 * business-scope rules for oversight, without editing them directly.
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const orgRules = await AlertRule.find({
    ownerId: session.org._id,
    scope: { $in: ["parentOrg_all", "parentOrg_region"] },
  }).sort({ createdAt: 1 });

  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name");
  const businessRules = await AlertRule.find({ scope: "business", ownerId: { $in: businesses.map((b) => b._id) } });

  return NextResponse.json({ status: "ok", orgRules, businessRules, businesses });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

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
  const delivery = ALERT_DELIVERY_MODES.includes(body?.delivery) ? body.delivery : "immediate";

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
    delivery,
    active: true,
    isInherited: true,
  });

  return NextResponse.json({ status: "ok", rule }, { status: 201 });
}
