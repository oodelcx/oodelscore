import { NextResponse } from "next/server";
import { connectToDatabase, User, logAuditEvent } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const member = await User.findOne({
    _id: id,
    accountType: "team_member",
    teamOfType: "parentOrg",
    parentId: session.org._id,
  });
  if (!member) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const previousTier = member.tier;
  if (typeof body?.teamRole === "string") member.teamRole = body.teamRole.trim();
  if (body?.tier === "full" || body?.tier === "limited") member.tier = body.tier;
  await member.save();

  if (member.tier !== previousTier) {
    await logAuditEvent({
      actor: session.user,
      action: "team_member.access_tier_changed",
      targetType: "User",
      targetId: member._id.toString(),
      targetLabel: member.email,
      before: { tier: previousTier },
      after: { tier: member.tier },
    });
  }

  return NextResponse.json({ status: "ok", member: { _id: member._id, email: member.email, teamRole: member.teamRole, tier: member.tier, inviteStatus: member.inviteStatus } });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const removed = await User.findOneAndDelete({
    _id: id,
    accountType: "team_member",
    teamOfType: "parentOrg",
    parentId: session.org._id,
  });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
