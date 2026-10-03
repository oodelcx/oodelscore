import { NextResponse } from "next/server";
import { connectToDatabase, Business, User, createInviteUser, canAccessScopedResource, isValidTeamPageKey } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Team Member provisioning for a standalone/branch business moved here from
 * self-service (spec Section 16 previously let the primary owner invite
 * directly) — Admin now owns adding/removing team logins; a business that
 * wants a change raises a support ticket. Same createInviteUser mechanism,
 * same seat-limit enforcement, just Admin-gated instead of owner-gated.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const canView = canAccessScopedResource(
    session.role,
    "businesses",
    "view",
    business.accountManagerId?.toString() ?? null,
    session.user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const members = await User.find({ accountType: "team_member", teamOfType: "business", parentId: business._id }).sort({ createdAt: 1 });
  return NextResponse.json({
    status: "ok",
    members,
    seatLimit: business.teamMemberSeatLimit,
    activeCount: members.filter((m) => m.inviteStatus !== "invite_expired").length,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
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

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const teamRole = typeof body?.teamRole === "string" ? body.teamRole.trim() : "";
  const tier = body?.tier === "limited" ? "limited" : "full";
  const restrictedPages = Array.isArray(body?.restrictedPages) ? body.restrictedPages.filter(isValidTeamPageKey) : [];
  if (!email) return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });

  const limit = business.teamMemberSeatLimit;
  if (limit !== null) {
    const activeCount = await User.countDocuments({
      accountType: "team_member",
      teamOfType: "business",
      parentId: business._id,
      inviteStatus: { $ne: "invite_expired" },
    });
    if (activeCount >= limit) {
      return NextResponse.json(
        { status: "error", message: `Team seat limit reached (${activeCount} of ${limit} used). Raise the seat limit first.` },
        { status: 409 }
      );
    }
  }

  try {
    const member = await createInviteUser({
      email,
      accountType: "team_member",
      parentId: business._id,
      teamRole,
      tier,
      teamOfType: "business",
      inviterName: session.user.email,
      businessOrOrgName: business.name,
      appUrl: process.env.APP_URL ?? "",
    });
    if (tier === "full" && restrictedPages.length > 0) {
      member.restrictedPages = restrictedPages;
      await member.save();
    }
    return NextResponse.json({ status: "ok", member }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : "Failed to invite" }, { status: 400 });
  }
}
