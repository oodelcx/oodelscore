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
  const businessUsers = await User.find({ accountType: "business", parentId: { $in: businesses.map((b) => b._id) } });
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  const team = [
    { userId: session.user._id.toString(), label: `${session.org.name} (Group)` },
    ...businessUsers.map((u) => ({
      userId: u._id.toString(),
      label: businessNameById.get(u.parentId?.toString() ?? "") ?? u.email,
    })),
  ];

  return NextResponse.json({ status: "ok", team });
}
