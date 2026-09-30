import { NextResponse } from "next/server";
import { connectToDatabase, Business } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Self-service escalation-ladder config — standalone businesses only. A
 * branch's escalation chain always comes from its parent org (see
 * escalation/engine.ts's getEscalationConfig), so there is nothing for a
 * branch to configure here; it's owner-only for the same reason billing is.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages escalation centrally." }, { status: 403 });
  }

  return NextResponse.json({
    status: "ok",
    escalationLevels: session.business.escalationLevels,
    escalationSlaHours: session.business.escalationSlaHours,
  });
}

export async function PATCH(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages escalation centrally." }, { status: 403 });
  }

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
  const business = await Business.findByIdAndUpdate(session.business._id, { $set: update }, { new: true });

  return NextResponse.json({ status: "ok", escalationLevels: business!.escalationLevels, escalationSlaHours: business!.escalationSlaHours });
}
