import { NextResponse } from "next/server";
import { connectToDatabase, User } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const removed = await User.findOneAndDelete({
    _id: id,
    accountType: "team_member",
    teamOfType: "parentOrg",
    parentId: session.org._id,
  });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
