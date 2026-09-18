import { NextResponse } from "next/server";
import { connectToDatabase, PlaybookRun, Playbook, ActionBoardItem } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { computePlaybookUsageOne, countOwnerRunsLast30d } from "@/lib/playbookUsage";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Mirrors /api/business/playbook-runs/[id]'s GET.
 *
 * Authorization isn't just {ownerType:"parentOrg", ownerId: org._id}: a
 * case-linked run (actionBoardItemId set) can be ownerType:"business" when
 * the case's own branch had a business-specific Playbook, or
 * ownerType:"parentOrg" when it fell back to the org-wide one
 * (autoAttachPlaybook picks whichever Playbook actually matched) — either
 * way, the case belongs to this org and the run must stay visible here.
 * Only an ad-hoc run with no linked case (started from the Playbook
 * Library, not attached to a specific Case) falls back to the strict
 * ownerType/ownerId check.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const run = await PlaybookRun.findById(id);
  if (!run) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const authorized = run.actionBoardItemId
    ? (await ActionBoardItem.exists({ _id: run.actionBoardItemId, parentOrgId: session.org._id })) !== null
    : run.ownerType === "parentOrg" && run.ownerId.toString() === session.org._id.toString();
  if (!authorized) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const playbook = await Playbook.findById(run.playbookId);
  const [usage, usedThisOwnerLast30d] = await Promise.all([
    computePlaybookUsageOne(run.playbookId),
    countOwnerRunsLast30d(run.playbookId, session.org._id),
  ]);

  return NextResponse.json({
    status: "ok",
    run,
    playbook: playbook
      ? { title: playbook.title, triggerCondition: playbook.triggerCondition, categoryId: playbook.categoryId }
      : null,
    usage: {
      usageCount90d: usage.usageCount90d,
      completionRate: usage.completionRate,
      avgResolutionHours: usage.avgResolutionHours,
      usedThisOwnerLast30d,
    },
    patternNudge: usedThisOwnerLast30d >= 3,
  });
}

/** Mirrors /api/business/playbook-runs/[id]. Same case-linked-vs-ad-hoc
 * authorization as the GET above. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const run = await PlaybookRun.findById(id);
  if (!run) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  const authorized = run.actionBoardItemId
    ? (await ActionBoardItem.exists({ _id: run.actionBoardItemId, parentOrgId: session.org._id })) !== null
    : run.ownerType === "parentOrg" && run.ownerId.toString() === session.org._id.toString();
  if (!authorized) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (run.status !== "active") return NextResponse.json({ status: "error", message: "This run is no longer active" }, { status: 400 });

  const body = await request.json().catch(() => null);

  if (typeof body?.stepIndex === "number") {
    const set = new Set(run.completedStepIndexes);
    if (body.completed === false) set.delete(body.stepIndex);
    else set.add(body.stepIndex);
    run.completedStepIndexes = Array.from(set).sort((a, b) => a - b);

    if (run.completedStepIndexes.length >= run.steps.length && run.steps.length > 0) {
      run.status = "completed";
      run.completedAt = new Date();
    }
  }

  if (body?.status === "completed" || body?.status === "abandoned") {
    run.status = body.status;
    run.completedAt = body.status === "completed" ? new Date() : null;
    run.completedByUserId = session.user._id;
  }

  if (run.status === "completed" && !run.completedByUserId) {
    // Completed by checking off every step rather than an explicit
    // status:"completed" body — still attribute it to whoever did it.
    run.completedByUserId = session.user._id;
  }

  await run.save();

  if (run.status === "completed") {
    await Playbook.updateOne({ _id: run.playbookId }, { $inc: { usageCount: 1 } });
  }

  return NextResponse.json({ status: "ok", run });
}
