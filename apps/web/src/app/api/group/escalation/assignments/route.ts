import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment, User, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Who holds each escalation level 2+ across this org's own network — level 1
 * is always the branch's own owner login (see escalation/engine.ts), never
 * assigned here. Region-scoped by default so one assignment can cover every
 * branch in a region; region "" means org-wide. Assignable people are
 * scoped to this org's own team (its team members, plus its branches' own
 * owner logins) — "the group head adds his own team," not an arbitrary
 * platform email.
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [assignments, teamMembers, branches] = await Promise.all([
    EscalationAssignment.find({ parentOrgId: session.org._id }).populate("userId", "email").sort({ level: 1, region: 1 }),
    User.find({ accountType: "team_member", teamOfType: "parentOrg", parentId: session.org._id }).select("email teamRole"),
    Business.find({ parentOrgId: session.org._id, active: true }).select("name region"),
  ]);
  const branchIds = branches.map((b) => b._id);
  const branchOwners = await User.find({ accountType: "business", parentId: { $in: branchIds } }).select("email parentId");
  const branchNameById = new Map(branches.map((b) => [b._id.toString(), b.name]));

  const candidates = [
    { email: session.user.email, label: `${session.user.email} (you)` },
    ...teamMembers.map((t) => ({ email: t.email, label: t.teamRole ? `${t.email} (${t.teamRole})` : t.email })),
    ...branchOwners.map((o) => ({
      email: o.email,
      label: `${o.email} (${branchNameById.get(o.parentId?.toString() ?? "") ?? "branch owner"})`,
    })),
  ];
  const regions = [...new Set(branches.map((b) => b.region).filter((r): r is string => !!r))].sort();

  return NextResponse.json({ status: "ok", assignments, candidates, regions });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "number" ? body.level : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const region = typeof body?.region === "string" ? body.region.trim() : "";
  if (!level || level <= 1 || !email) {
    return NextResponse.json({ status: "error", message: "level (>1) and email are required" }, { status: 400 });
  }
  if (!session.org.escalationLevels.some((l) => l.level === level)) {
    return NextResponse.json({ status: "error", message: "That level isn't configured yet — add it above first." }, { status: 400 });
  }

  const branches = await Business.find({ parentOrgId: session.org._id }).select("_id");
  const branchIds = branches.map((b) => b._id);
  const user = await User.findOne({
    email,
    $or: [
      { _id: session.user._id },
      { accountType: "team_member", teamOfType: "parentOrg", parentId: session.org._id },
      { accountType: "business", parentId: { $in: branchIds } },
    ],
  });
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "That email isn't part of this organization's own team or branch owners." },
      { status: 404 }
    );
  }

  const assignment = await EscalationAssignment.findOneAndUpdate(
    { parentOrgId: session.org._id, businessId: null, region, level },
    { userId: user._id },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", assignment });
}
