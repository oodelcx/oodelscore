import { NextResponse } from "next/server";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { structureGet, structurePost } from "@/lib/structureRoute";

/** The group's own structure and escalation chain: owner only, same rule as the old escalation screen. */
async function guard() {
  const session = await requireParentOrgOwner();
  if (!session || session.isTeamMember) return null;
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
  return structurePost({ kind: "parentOrg", id: session.org._id.toString() }, request);
}
