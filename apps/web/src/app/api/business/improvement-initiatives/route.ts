import { NextResponse } from "next/server";
import { connectToDatabase, ImprovementInitiative , hasFeature } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

// Mirrors /api/group/improvement-initiatives, scoped to a standalone
// business — same authorship split as Decision Log/Playbooks: a branch
// doesn't get its own independent initiatives, it sees its org's (filtered
// to ones that affect it) via the org's own route, read-only.
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasFeature(session.business.enabledFeatures, "improvementInitiatives")) {
    return NextResponse.json({ status: "error", message: "Improvement Initiatives is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const isBranch = !!session.business.parentOrgId;
  const initiatives = await ImprovementInitiative.find(
    isBranch
      ? { parentOrgId: session.business.parentOrgId, affectedBusinessIds: session.business._id }
      : { businessId: session.business._id }
  ).sort({ createdAt: -1 });

  return NextResponse.json({ status: "ok", initiatives, readOnly: isBranch });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Improvement Initiatives for a branch are managed by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const initiative = await ImprovementInitiative.create({
    businessId: session.business._id,
    title,
    description: typeof body?.description === "string" ? body.description : "",
    affectedBusinessIds: [session.business._id],
    linkedActionIds: Array.isArray(body?.linkedActionIds) ? body.linkedActionIds : [],
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    baselineMetricDescription: typeof body?.baselineMetricDescription === "string" ? body.baselineMetricDescription : "",
    baselineValue: typeof body?.baselineValue === "number" ? body.baselineValue : null,
    targetValue: typeof body?.targetValue === "number" ? body.targetValue : null,
    startedAt: typeof body?.startedAt === "string" ? new Date(body.startedAt) : null,
  });

  return NextResponse.json({ status: "ok", initiative }, { status: 201 });
}
