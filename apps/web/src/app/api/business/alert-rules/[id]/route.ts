import { NextResponse } from "next/server";
import { connectToDatabase, AlertRule, hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  // Scoping the query to scope:"business" + this business's ownerId means an
  // inherited (parentOrg-owned) rule can never be matched here, even by id.
  const rule = await AlertRule.findOne({ _id: id, scope: "business", ownerId: session.business._id });
  if (!rule) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.threshold === "number") rule.threshold = body.threshold;
  if (Array.isArray(body?.recipients)) rule.recipients = body.recipients.filter((r: unknown) => typeof r === "string");
  if (typeof body?.active === "boolean") rule.active = body.active;
  if (typeof body?.metric === "string") rule.metric = body.metric;
  await rule.save();

  return NextResponse.json({ status: "ok", rule });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "alertRules" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "alertRules")) {
    return NextResponse.json({ status: "error", message: "Alert Rules is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const { id } = await params;
  const removed = await AlertRule.findOneAndDelete({ _id: id, scope: "business", ownerId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
