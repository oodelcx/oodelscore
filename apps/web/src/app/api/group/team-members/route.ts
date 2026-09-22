import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Read-only from the Group side — adding/removing Team Members is
 * Admin-only (see api/admin/parent-orgs/[id]/team-members). A group that
 * wants a team change raises a support ticket instead of inviting directly.
 * This is the Group's own staff pool — independent of any branch's.
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const members = await User.find({ accountType: "team_member", teamOfType: "parentOrg", parentId: session.org._id }).sort({
    createdAt: 1,
  });

  return NextResponse.json({
    status: "ok",
    members,
    seatLimit: session.org.teamMemberSeatLimit,
    activeCount: members.filter((m) => m.inviteStatus !== "invite_expired").length,
  });
}
