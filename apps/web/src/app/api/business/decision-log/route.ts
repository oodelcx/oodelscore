import { NextResponse } from "next/server";
import { connectToDatabase, DecisionLogEntry } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

// Mirrors /api/group/decision-log, scoped to businessId instead of
// parentOrgId (spec Section 16 correction: a standalone business needs its
// own Decision Log, not just Group-managed businesses). Not available to
// limited-tier team members — same tier gating as Analytics/Billing.
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const entries = await DecisionLogEntry.find({ businessId: session.business._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", entries });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const entry = await DecisionLogEntry.create({
    businessId: session.business._id,
    title,
    trigger: typeof body?.trigger === "string" ? body.trigger : "",
    linkedActionIds: Array.isArray(body?.linkedActionIds) ? body.linkedActionIds : [],
    affectedBusinessIds: [session.business._id],
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    implementationDate: typeof body?.implementationDate === "string" ? new Date(body.implementationDate) : null,
    outcomeMetricDescription: typeof body?.outcomeMetricDescription === "string" ? body.outcomeMetricDescription : "",
  });

  return NextResponse.json({ status: "ok", entry }, { status: 201 });
}
