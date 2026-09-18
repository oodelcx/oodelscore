import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, PlaybookRun, ActionBoardItem } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Mirrors /api/business/playbooks/[id]/runs, scoped to the org's playbook. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const playbook = await Playbook.findOne({ _id: id, parentOrgId: session.org._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const runs = await PlaybookRun.find({ playbookId: playbook._id }).sort({ startedAt: -1 }).limit(20);

  const caseIds = runs.map((r) => r.actionBoardItemId).filter((v): v is NonNullable<typeof v> => v !== null);
  const cases = caseIds.length > 0 ? await ActionBoardItem.find({ _id: { $in: caseIds } }).select("title businessId") : [];
  const caseById = new Map(cases.map((c) => [c._id.toString(), c]));

  const enriched = runs.map((run) => ({
    ...run.toObject(),
    case: run.actionBoardItemId
      ? (() => {
          const c = caseById.get(run.actionBoardItemId!.toString());
          return c ? { id: c._id.toString(), title: c.title } : null;
        })()
      : null,
  }));

  return NextResponse.json({ status: "ok", runs: enriched });
}
