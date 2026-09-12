import { NextResponse } from "next/server";
import { connectToDatabase, User, createInviteUser } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Primary-account-only: inviting/removing Team Members is explicitly
 * excluded from the "full" tier's otherwise-equal access (spec Section 16).
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

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const teamRole = typeof body?.teamRole === "string" ? body.teamRole.trim() : "";
  const tier = body?.tier === "limited" ? "limited" : "full";
  if (!email) return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });

  await connectToDatabase();

  const limit = session.org.teamMemberSeatLimit;
  if (limit !== null) {
    const activeCount = await User.countDocuments({
      accountType: "team_member",
      teamOfType: "parentOrg",
      parentId: session.org._id,
      inviteStatus: { $ne: "invite_expired" },
    });
    if (activeCount >= limit) {
      return NextResponse.json(
        { status: "error", message: `Team seat limit reached (${activeCount} of ${limit} used). Ask Admin for more seats.` },
        { status: 409 }
      );
    }
  }

  try {
    const member = await createInviteUser({
      email,
      accountType: "team_member",
      parentId: session.org._id,
      teamRole,
      tier,
      teamOfType: "parentOrg",
      inviterName: session.user.email,
      businessOrOrgName: session.org.name,
      appUrl: process.env.APP_URL ?? "",
    });
    return NextResponse.json({ status: "ok", member }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : "Failed to invite" }, { status: 400 });
  }
}
