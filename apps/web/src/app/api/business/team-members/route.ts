import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Read-only from the Business side — adding/removing Team Members is
 * Admin-only (see api/admin/businesses/[id]/team-members). A business that
 * wants a team change raises a support ticket instead of inviting directly.
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [owner, teamMembers] = await Promise.all([
    User.findOne({ accountType: "business", parentId: session.business._id }),
    User.find({ accountType: "team_member", teamOfType: "business", parentId: session.business._id }).sort({ createdAt: 1 }),
  ]);

  // The primary owner login has its own account here too — without it,
  // this list ("Everyone at your business with their own OodelCX login")
  // silently omits the one person other pages (e.g. the Owner badge on
  // Case Management) already show as an assignable owner, which reads as
  // if that account doesn't exist.
  const members = [
    ...(owner ? [{ _id: owner._id, email: owner.email, teamRole: "Owner", tier: "full" as const, inviteStatus: owner.inviteStatus }] : []),
    ...teamMembers,
  ];

  return NextResponse.json({
    status: "ok",
    members,
    seatLimit: session.business.teamMemberSeatLimit,
    activeCount: teamMembers.filter((m) => m.inviteStatus !== "invite_expired").length,
  });
}
