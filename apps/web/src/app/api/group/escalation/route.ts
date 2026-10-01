import { NextResponse } from "next/server";
import { connectToDatabase, ParentOrganization } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Self-service escalation-ladder config for a Group's own network — the
 * parent org owner defines what the levels above "the branch's own owner"
 * (always level 1, never configured) are called and how long a case may sit
 * at a level before auto-escalating. Who actually HOLDS each level is a
 * separate concern, set via /api/group/escalation/assignments. Previously
 * this ladder was Admin-only (Accounts -> Escalation Workflow); the product
 * owner wants the Group head able to set their own chain rather than always
 * asking Admin.
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    status: "ok",
    escalationLevels: session.org.escalationLevels,
    escalationSlaHours: session.org.escalationSlaHours,
  });
}

export async function PATCH(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (body?.escalationLevels !== undefined) {
    const levels = body.escalationLevels;
    const valid =
      Array.isArray(levels) &&
      levels.length > 0 &&
      levels.every(
        (l: unknown) => l && typeof (l as { level?: unknown }).level === "number" && typeof (l as { label?: unknown }).label === "string"
      ) &&
      // Level 1 is always the branch/business owner by convention (see
      // escalation/engine.ts's resolveEscalationAssignee) — the ladder must
      // start there so the UI's "level 1 = you" framing stays true.
      (levels as { level: number }[]).some((l) => l.level === 1);
    if (!valid) {
      return NextResponse.json({ status: "error", message: "Invalid escalationLevels — must include level 1" }, { status: 400 });
    }
    update.escalationLevels = levels;
  }
  if (body?.escalationSlaHours !== undefined) {
    if (body.escalationSlaHours !== null && typeof body.escalationSlaHours !== "number") {
      return NextResponse.json({ status: "error", message: "Invalid escalationSlaHours" }, { status: 400 });
    }
    update.escalationSlaHours = body.escalationSlaHours;
  }

  await connectToDatabase();
  const org = await ParentOrganization.findByIdAndUpdate(session.org._id, { $set: update }, { new: true });

  return NextResponse.json({ status: "ok", escalationLevels: org!.escalationLevels, escalationSlaHours: org!.escalationSlaHours });
}
