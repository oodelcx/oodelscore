import { NextResponse } from "next/server";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { structureGet, structurePost } from "@/lib/structureRoute";

/** A standalone business's own escalation people. A branch's chain comes from its group. */
async function guard() {
  const session = await requireBusinessOwner();
  if (!session || session.business.parentOrgId || (session.isTeamMember && session.tier !== "full")) return null;
  return session;
}

export async function GET() {
  const session = await guard();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  return structureGet({ kind: "business", id: session.business._id.toString() });
}

export async function POST(request: Request) {
  const session = await guard();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  return structurePost({ kind: "business", id: session.business._id.toString() }, request, { userId: session.user._id.toString(), email: session.user.email, kind: "group" });
}
