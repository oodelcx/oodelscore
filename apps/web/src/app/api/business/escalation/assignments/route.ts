import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment, User } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Who holds each escalation level 2+ for a standalone business — level 1 is
 * always the owner's own login. Assignable people are scoped to this
 * business's own team ("a business owner who adds his own team").
 */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages escalation centrally." }, { status: 403 });
  }

  await connectToDatabase();
  const [assignments, teamMembers] = await Promise.all([
    EscalationAssignment.find({ businessId: session.business._id }).populate("userId", "email").sort({ level: 1 }),
    User.find({ accountType: "team_member", teamOfType: "business", parentId: session.business._id }).select("email teamRole"),
  ]);

  const candidates = [
    { email: session.user.email, label: `${session.user.email} (you)` },
    ...teamMembers.map((t) => ({ email: t.email, label: t.teamRole ? `${t.email} (${t.teamRole})` : t.email })),
  ];

  return NextResponse.json({ status: "ok", assignments, candidates });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json({ status: "error", message: "Your parent organization manages escalation centrally." }, { status: 403 });
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "number" ? body.level : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!level || level <= 1 || !email) {
    return NextResponse.json({ status: "error", message: "level (>1) and email are required" }, { status: 400 });
  }
  if (!session.business.escalationLevels.some((l) => l.level === level)) {
    return NextResponse.json({ status: "error", message: "That level isn't configured yet — add it above first." }, { status: 400 });
  }

  const user = await User.findOne({
    email,
    $or: [{ _id: session.user._id }, { accountType: "team_member", teamOfType: "business", parentId: session.business._id }],
  });
  if (!user) {
    return NextResponse.json({ status: "error", message: "That email isn't part of your own team." }, { status: 404 });
  }

  const assignment = await EscalationAssignment.findOneAndUpdate(
    { businessId: session.business._id, region: "", level },
    { userId: user._id },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", assignment });
}
