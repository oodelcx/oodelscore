import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, PLAYBOOK_TRIGGER_METRICS, PLAYBOOK_TRIGGER_COMPARATORS } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Playbooks for a branch are managed by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const { id } = await params;
  const playbook = await Playbook.findOne({ _id: id, businessId: session.business._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.title === "string") playbook.title = body.title;
  if ("categoryId" in (body ?? {})) playbook.categoryId = typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null;
  if (typeof body?.triggerCondition === "string") playbook.triggerCondition = body.triggerCondition;
  if (Array.isArray(body?.steps)) playbook.steps = body.steps.filter((s: unknown) => typeof s === "string");
  if ("triggerMetric" in (body ?? {})) playbook.triggerMetric = PLAYBOOK_TRIGGER_METRICS.includes(body.triggerMetric) ? body.triggerMetric : null;
  if ("triggerComparator" in (body ?? {}))
    playbook.triggerComparator = PLAYBOOK_TRIGGER_COMPARATORS.includes(body.triggerComparator) ? body.triggerComparator : null;
  if ("triggerThreshold" in (body ?? {})) playbook.triggerThreshold = typeof body.triggerThreshold === "number" ? body.triggerThreshold : null;
  if ("triggerWindowDays" in (body ?? {})) playbook.triggerWindowDays = typeof body.triggerWindowDays === "number" ? body.triggerWindowDays : null;
  await playbook.save();

  return NextResponse.json({ status: "ok", playbook });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Playbooks for a branch are managed by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const { id } = await params;
  const removed = await Playbook.findOneAndDelete({ _id: id, businessId: session.business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
