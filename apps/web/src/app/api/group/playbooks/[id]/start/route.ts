import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, PlaybookRun, ActionBoardItem } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Mirrors /api/business/playbooks/[id]/start, scoped to the org — including
 * the optional `{ actionBoardItemId }` body to attach the run to one of the
 * org's own escalated cases instead of starting an ad-hoc, org-wide run.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const playbook = await Playbook.findOne({ _id: id, parentOrgId: session.org._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const actionBoardItemId = typeof body?.actionBoardItemId === "string" ? body.actionBoardItemId : null;

  if (actionBoardItemId) {
    const item = await ActionBoardItem.findOne({ _id: actionBoardItemId, parentOrgId: session.org._id });
    if (!item) return NextResponse.json({ status: "error", message: "Case not found" }, { status: 404 });

    const existing = await PlaybookRun.findOne({ playbookId: playbook._id, actionBoardItemId: item._id, status: "active" });
    if (existing) return NextResponse.json({ status: "ok", run: existing });

    const run = await PlaybookRun.create({
      playbookId: playbook._id,
      ownerType: "parentOrg",
      ownerId: session.org._id,
      actionBoardItemId: item._id,
      steps: playbook.steps,
      completedStepIndexes: [],
      status: "active",
    });

    return NextResponse.json({ status: "ok", run }, { status: 201 });
  }

  const existing = await PlaybookRun.findOne({
    playbookId: playbook._id,
    ownerType: "parentOrg",
    ownerId: session.org._id,
    actionBoardItemId: null,
    status: "active",
  });
  if (existing) return NextResponse.json({ status: "ok", run: existing });

  const run = await PlaybookRun.create({
    playbookId: playbook._id,
    ownerType: "parentOrg",
    ownerId: session.org._id,
    steps: playbook.steps,
    completedStepIndexes: [],
    status: "active",
  });

  return NextResponse.json({ status: "ok", run }, { status: 201 });
}
