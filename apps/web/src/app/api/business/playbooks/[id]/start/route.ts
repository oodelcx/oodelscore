import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, PlaybookRun, ActionBoardItem } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Starts a checklist run against this playbook, or returns the
 * already-active one — never two active runs at once.
 *
 * Optionally accepts a JSON body `{ actionBoardItemId }` to attach the run
 * to one specific Case instead of starting an ad-hoc, business-wide run —
 * this is what lets a user manually attach a playbook to a case that didn't
 * get one auto-attached at creation time (e.g. the category had no playbook
 * yet, or one was added later). With no body / no actionBoardItemId, this
 * behaves exactly as before.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  // A branch has no playbooks of its own (see ../route.ts GET) — it starts
  // runs against its parent org's playbooks instead, same resolution the
  // read-only listing already uses. The run itself still belongs to this
  // business (ownerId below), not the org, so it shows up against this
  // business's own case exactly like a locally-authored playbook would.
  const playbook = session.business.parentOrgId
    ? await Playbook.findOne({ _id: id, parentOrgId: session.business.parentOrgId })
    : await Playbook.findOne({ _id: id, businessId: session.business._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const actionBoardItemId = typeof body?.actionBoardItemId === "string" ? body.actionBoardItemId : null;

  if (actionBoardItemId) {
    const item = await ActionBoardItem.findOne({ _id: actionBoardItemId, businessId: session.business._id });
    if (!item) return NextResponse.json({ status: "error", message: "Case not found" }, { status: 404 });

    const existing = await PlaybookRun.findOne({ playbookId: playbook._id, actionBoardItemId: item._id, status: "active" });
    if (existing) return NextResponse.json({ status: "ok", run: existing });

    const run = await PlaybookRun.create({
      playbookId: playbook._id,
      ownerType: "business",
      ownerId: session.business._id,
      actionBoardItemId: item._id,
      steps: playbook.steps,
      completedStepIndexes: [],
      status: "active",
    });

    return NextResponse.json({ status: "ok", run }, { status: 201 });
  }

  const existing = await PlaybookRun.findOne({
    playbookId: playbook._id,
    ownerType: "business",
    ownerId: session.business._id,
    actionBoardItemId: null,
    status: "active",
  });
  if (existing) return NextResponse.json({ status: "ok", run: existing });

  const run = await PlaybookRun.create({
    playbookId: playbook._id,
    ownerType: "business",
    ownerId: session.business._id,
    steps: playbook.steps,
    completedStepIndexes: [],
    status: "active",
  });

  return NextResponse.json({ status: "ok", run }, { status: 201 });
}
