import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/** "Assignable people" for this business's Action Board ownerId: the
 * primary login plus every full-tier Team Member (spec Section 16). */
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const [owner, teamMembers] = await Promise.all([
    User.findOne({ accountType: "business", parentId: session.business._id }),
    User.find({ accountType: "team_member", teamOfType: "business", parentId: session.business._id, tier: "full" }),
  ]);

  const team = [
    ...(owner ? [{ userId: owner._id.toString(), label: `${session.business.name} (Owner)` }] : []),
    ...teamMembers.map((u) => ({ userId: u._id.toString(), label: `${u.email}${u.teamRole ? ` (${u.teamRole})` : ""}` })),
  ];

  return NextResponse.json({ status: "ok", team });
}
