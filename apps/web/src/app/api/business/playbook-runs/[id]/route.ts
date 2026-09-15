import { NextResponse } from "next/server";
import { connectToDatabase, PlaybookRun, Playbook } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Toggle one checklist step, or mark the run completed/abandoned.
 * Completing (whether by checking every step or an explicit
 * status:"completed") increments the playbook's usageCount — the field
 * already fed into CX Pulse's Culture dimension, previously always zero
 * because nothing ever incremented it.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const run = await PlaybookRun.findOne({ _id: id, ownerType: "business", ownerId: session.business._id });
  if (!run) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
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
  }

  await run.save();

  if (run.status === "completed") {
    await Playbook.updateOne({ _id: run.playbookId }, { $inc: { usageCount: 1 } });
  }

  return NextResponse.json({ status: "ok", run });
}
