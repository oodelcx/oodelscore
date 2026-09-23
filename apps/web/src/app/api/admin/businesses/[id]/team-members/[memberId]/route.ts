import { NextResponse } from "next/server";
import { connectToDatabase, Business, User, logAuditEvent, canAccessScopedResource, isValidTeamPageKey } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id, memberId } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const canEdit = canAccessScopedResource(
    session.role,
    "businesses",
    "edit",
    business.accountManagerId?.toString() ?? null,
    session.user._id.toString()
  );
  if (!canEdit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const member = await User.findOne({ _id: memberId, accountType: "team_member", teamOfType: "business", parentId: business._id });
  if (!member) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const previousTier = member.tier;
  if (typeof body?.teamRole === "string") member.teamRole = body.teamRole.trim();
  if (body?.tier === "full" || body?.tier === "limited") member.tier = body.tier;
  if (Array.isArray(body?.restrictedPages)) member.restrictedPages = body.restrictedPages.filter(isValidTeamPageKey);
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

  return NextResponse.json({
    status: "ok",
    member: {
      _id: member._id,
      email: member.email,
      teamRole: member.teamRole,
      tier: member.tier,
      restrictedPages: member.restrictedPages,
      inviteStatus: member.inviteStatus,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id, memberId } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const canEdit = canAccessScopedResource(
    session.role,
    "businesses",
    "edit",
    business.accountManagerId?.toString() ?? null,
    session.user._id.toString()
  );
  if (!canEdit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const removed = await User.findOneAndDelete({ _id: memberId, accountType: "team_member", teamOfType: "business", parentId: business._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
