import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/adminAuth";
import { structureGet, structurePost } from "@/lib/structureRoute";

type RouteParams = { params: Promise<{ id: string }> };

/** Admin view of a business's structure and escalation chain. Only the Admin role may change it. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  return structureGet({ kind: "business", id });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session || !(session.role.isSystemRole && session.role.name === "Admin")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  return structurePost({ kind: "business", id }, request, { userId: session.user._id.toString(), email: session.user.email, kind: "admin" });
}
