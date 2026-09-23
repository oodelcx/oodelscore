import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, PlaybookRun, ActionBoardItem, User } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Recent-runs history for the Playbook Library detail view: the last ~20
 * PlaybookRuns for this playbook (any owner — see the usage-scope note in
 * @/lib/playbookUsage, same reasoning applies here), each enriched with the
 * linked case's title when the run is tied to one.
 *
 * There is no per-run "completed by" user captured on PlaybookRun until this
 * change (see `completedByUserId`); older runs finished before this field
 * existed will show `completedByUserId: null`, which the frontend should
 * treat as "unknown," not attribute to anyone.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const playbook = await Playbook.findOne({ _id: id, businessId: session.business._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const runs = await PlaybookRun.find({ playbookId: playbook._id }).sort({ startedAt: -1 }).limit(20);

  const caseIds = runs.map((r) => r.actionBoardItemId).filter((v): v is NonNullable<typeof v> => v !== null);
  const cases = caseIds.length > 0 ? await ActionBoardItem.find({ _id: { $in: caseIds } }).select("title businessId") : [];
  const caseById = new Map(cases.map((c) => [c._id.toString(), c]));

  const completedByIds = runs.map((r) => r.completedByUserId).filter((v): v is NonNullable<typeof v> => v !== null);
  const completedByUsers = completedByIds.length > 0 ? await User.find({ _id: { $in: completedByIds } }).select("email") : [];
  const completedByEmailById = new Map(completedByUsers.map((u) => [u._id.toString(), u.email]));

  const enriched = runs.map((run) => ({
    ...run.toObject(),
    caseTitle: run.actionBoardItemId ? (caseById.get(run.actionBoardItemId.toString())?.title ?? null) : null,
    completedBy: run.completedByUserId ? (completedByEmailById.get(run.completedByUserId.toString()) ?? null) : null,
  }));

  return NextResponse.json({ status: "ok", runs: enriched });
}
