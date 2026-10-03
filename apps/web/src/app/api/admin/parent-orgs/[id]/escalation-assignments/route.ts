import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment, ParentOrganization, User } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Who holds each escalation level 2+ for this org — level 1 is always the
 * branch's own owner and is never assigned here (see escalation/engine.ts).
 * Region-scoped by default (one row can cover every branch in a region);
 * region "" means org-wide.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const assignments = await EscalationAssignment.find({ parentOrgId: id }).populate("userId", "email").sort({ level: 1, region: 1 });
  return NextResponse.json({ status: "ok", assignments });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!(session.role.isSystemRole && session.role.name === "Admin")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const org = await ParentOrganization.findById(id);
  if (!org) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "number" ? body.level : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const region = typeof body?.region === "string" ? body.region.trim() : "";
  if (!level || level <= 1 || !email) {
    return NextResponse.json({ status: "error", message: "level (>1) and email are required" }, { status: 400 });
  }
  if (!org.escalationLevels.some((l) => l.level === level)) {
    return NextResponse.json({ status: "error", message: "That level isn't configured for this org yet" }, { status: 400 });
  }
  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ status: "error", message: "No login found for that email" }, { status: 404 });

  const assignment = await EscalationAssignment.findOneAndUpdate(
    { parentOrgId: org._id, businessId: null, region, level },
    { userId: user._id },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", assignment });
}
