import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ParentOrganization,
  User,
  createInviteUser,
  canAccessScopedResource,
  isValidTeamPageKey,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Team Member provisioning for a Group moved here from self-service —
 * Admin now owns adding/removing team logins; a group that wants a change
 * raises a support ticket. Mirrors api/admin/businesses/[id]/team-members.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const org = await ParentOrganization.findById(id);
  if (!org) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const canView = canAccessScopedResource(
    session.role,
    "parentOrgs",
    "view",
    org.accountManagerId?.toString() ?? null,
    session.user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const members = await User.find({ accountType: "team_member", teamOfType: "parentOrg", parentId: org._id }).sort({ createdAt: 1 });
  return NextResponse.json({
    status: "ok",
    members,
    seatLimit: org.teamMemberSeatLimit,
    activeCount: members.filter((m) => m.inviteStatus !== "invite_expired").length,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const org = await ParentOrganization.findById(id);
  if (!org) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const canEdit = canAccessScopedResource(
    session.role,
    "parentOrgs",
    "edit",
    org.accountManagerId?.toString() ?? null,
    session.user._id.toString()
  );
  if (!canEdit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const teamRole = typeof body?.teamRole === "string" ? body.teamRole.trim() : "";
  const tier = body?.tier === "limited" ? "limited" : "full";
  const restrictedPages = Array.isArray(body?.restrictedPages) ? body.restrictedPages.filter(isValidTeamPageKey) : [];
  if (!email) return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });

  const limit = org.teamMemberSeatLimit;
  if (limit !== null) {
    const activeCount = await User.countDocuments({
      accountType: "team_member",
      teamOfType: "parentOrg",
      parentId: org._id,
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
      parentId: org._id,
      teamRole,
      tier,
      teamOfType: "parentOrg",
      inviterName: session.user.email,
      businessOrOrgName: org.name,
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
