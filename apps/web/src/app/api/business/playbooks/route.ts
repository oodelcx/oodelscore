import { NextResponse } from "next/server";
import { connectToDatabase, Playbook, Category } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

// Mirrors /api/group/playbooks, scoped to businessId instead of
// parentOrgId. Not available to limited-tier team members.
export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const [playbooks, categories] = await Promise.all([
    Playbook.find({ businessId: session.business._id }).sort({ createdAt: -1 }),
    Category.find().sort({ name: 1 }),
  ]);
  return NextResponse.json({ status: "ok", playbooks, categories });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const playbook = await Playbook.create({
    businessId: session.business._id,
    title,
    categoryId: typeof body?.categoryId === "string" ? body.categoryId : null,
    triggerCondition: typeof body?.triggerCondition === "string" ? body.triggerCondition : "",
    steps: Array.isArray(body?.steps) ? body.steps.filter((s: unknown) => typeof s === "string") : [],
    escalationContactId: typeof body?.escalationContactId === "string" ? body.escalationContactId : null,
  });

  return NextResponse.json({ status: "ok", playbook }, { status: 201 });
}
