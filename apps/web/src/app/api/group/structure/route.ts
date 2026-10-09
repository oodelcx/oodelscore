import { NextResponse } from "next/server";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { structureGet, structurePost } from "@/lib/structureRoute";

/** The group's own escalation people: the group owner, or a full-access team member (never a limited one). */
async function guard() {
  const session = await requireParentOrgOwner();
  if (!session || (session.isTeamMember && session.tier !== "full")) return null;
  return session;
}

export async function GET() {
  const session = await guard();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  return structureGet({ kind: "parentOrg", id: session.org._id.toString() });
}

export async function POST(request: Request) {
  const session = await guard();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  return structurePost({ kind: "parentOrg", id: session.org._id.toString() }, request, { userId: session.user._id.toString(), email: session.user.email, kind: "group" });
}
