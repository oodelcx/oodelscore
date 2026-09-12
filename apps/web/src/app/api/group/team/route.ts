import { NextResponse } from "next/server";
import { connectToDatabase, Business, User } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * "Assignable people" for Action Board ownerId: the org's own login plus
 * every child business's owner login. There's no separate staff-directory
 * concept at the Group/Business level yet (each account is one login).
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const businesses = await Business.find({ parentOrgId: session.org._id }).select("_id name");
  const businessIds = businesses.map((b) => b._id);
  const businessUsers = await User.find({ accountType: "business", parentId: { $in: businessIds } });
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  // Full-tier Team Members (spec Section 16) are assignable owners too;
  // limited-tier ones only ever see items already assigned to them, so
  // they're excluded from this "who can this be assigned to" list.
  const orgTeamMembers = await User.find({ accountType: "team_member", teamOfType: "parentOrg", parentId: session.org._id, tier: "full" });
  const businessTeamMembers = await User.find({
    accountType: "team_member",
    teamOfType: "business",
    parentId: { $in: businessIds },
    tier: "full",
  });

  const team = [
    { userId: session.user._id.toString(), label: `${session.org.name} (Group)` },
    ...orgTeamMembers.map((u) => ({ userId: u._id.toString(), label: `${u.email} (${session.org.name}${u.teamRole ? `, ${u.teamRole}` : ""})` })),
    ...businessUsers.map((u) => ({
      userId: u._id.toString(),
      label: businessNameById.get(u.parentId?.toString() ?? "") ?? u.email,
    })),
    ...businessTeamMembers.map((u) => {
      const businessName = businessNameById.get(u.parentId?.toString() ?? "") ?? "";
      return { userId: u._id.toString(), label: `${u.email} (${businessName}${u.teamRole ? `, ${u.teamRole}` : ""})` };
    }),
  ];

  return NextResponse.json({ status: "ok", team });
}
