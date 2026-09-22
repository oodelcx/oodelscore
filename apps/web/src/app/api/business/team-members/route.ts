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
  const members = await User.find({ accountType: "team_member", teamOfType: "business", parentId: session.business._id }).sort({
    createdAt: 1,
  });

  return NextResponse.json({
    status: "ok",
    members,
    seatLimit: session.business.teamMemberSeatLimit,
    activeCount: members.filter((m) => m.inviteStatus !== "invite_expired").length,
  });
}
