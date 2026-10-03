import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, hasFeature } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const rule = await AlertRule.findOne({ _id: id, ownerId: session.org._id, scope: { $in: ["parentOrg_all", "parentOrg_region"] } });
  if (!rule) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.threshold === "number") rule.threshold = body.threshold;
  if (typeof body?.sensitivity === "number") rule.sensitivity = body.sensitivity;
  if (typeof body?.baselineWindowDays === "number") rule.baselineWindowDays = body.baselineWindowDays;
  if (typeof body?.dropPercent === "number") rule.dropPercent = body.dropPercent;
  if (Array.isArray(body?.recipients)) rule.recipients = body.recipients.filter((r: unknown) => typeof r === "string");
  if (typeof body?.active === "boolean") rule.active = body.active;
  await rule.save();

  return NextResponse.json({ status: "ok", rule });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.org.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const removed = await AlertRule.findOneAndDelete({
    _id: id,
    ownerId: session.org._id,
    scope: { $in: ["parentOrg_all", "parentOrg_region"] },
  });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
