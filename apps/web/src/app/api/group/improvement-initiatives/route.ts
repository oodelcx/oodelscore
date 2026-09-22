import { NextResponse } from "next/server";
import { connectToDatabase, ImprovementInitiative, Business } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const initiatives = await ImprovementInitiative.find({ parentOrgId: session.org._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", initiatives });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const affectedBusinessIds = Array.isArray(body?.affectedBusinessIds) ? body.affectedBusinessIds : [];
  if (affectedBusinessIds.length > 0) {
    const count = await Business.countDocuments({ _id: { $in: affectedBusinessIds }, parentOrgId: session.org._id });
    if (count !== affectedBusinessIds.length) {
      return NextResponse.json({ status: "error", message: "affectedBusinessIds must all belong to this organization" }, { status: 400 });
    }
  }

  const initiative = await ImprovementInitiative.create({
    parentOrgId: session.org._id,
    title,
    description: typeof body?.description === "string" ? body.description : "",
    affectedBusinessIds,
    linkedActionIds: Array.isArray(body?.linkedActionIds) ? body.linkedActionIds : [],
    ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    baselineMetricDescription: typeof body?.baselineMetricDescription === "string" ? body.baselineMetricDescription : "",
    baselineValue: typeof body?.baselineValue === "number" ? body.baselineValue : null,
    targetValue: typeof body?.targetValue === "number" ? body.targetValue : null,
    startedAt: typeof body?.startedAt === "string" ? new Date(body.startedAt) : null,
  });

  return NextResponse.json({ status: "ok", initiative }, { status: 201 });
}
