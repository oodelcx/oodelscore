import { NextResponse } from "next/server";
import { connectToDatabase, EscalationAssignment, Business, User } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Same mechanism as the Parent Org version, but business-wide only — a
 * standalone business has no regions to scope a level to, so every
 * assignment here is effectively org-wide (region always "").
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const assignments = await EscalationAssignment.find({ businessId: id }).populate("userId", "email").sort({ level: 1 });
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
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "This business belongs to a group — configure its escalation chain from the org's own page." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "number" ? body.level : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!level || level <= 1 || !email) {
    return NextResponse.json({ status: "error", message: "level (>1) and email are required" }, { status: 400 });
  }
  if (!business.escalationLevels.some((l) => l.level === level)) {
    return NextResponse.json({ status: "error", message: "That level isn't configured for this business yet" }, { status: 400 });
  }
  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ status: "error", message: "No login found for that email" }, { status: 404 });

  const assignment = await EscalationAssignment.findOneAndUpdate(
    { businessId: business._id, region: "", level },
    { userId: user._id },
    { upsert: true, new: true }
  );

  return NextResponse.json({ status: "ok", assignment });
}
