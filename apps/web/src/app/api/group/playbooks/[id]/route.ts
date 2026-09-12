import { NextResponse } from "next/server";
import { connectToDatabase, Playbook } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const playbook = await Playbook.findOne({ _id: id, parentOrgId: session.org._id });
  if (!playbook) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.title === "string") playbook.title = body.title;
  if (typeof body?.triggerCondition === "string") playbook.triggerCondition = body.triggerCondition;
  if (Array.isArray(body?.steps)) playbook.steps = body.steps.filter((s: unknown) => typeof s === "string");
  await playbook.save();

  return NextResponse.json({ status: "ok", playbook });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const removed = await Playbook.findOneAndDelete({ _id: id, parentOrgId: session.org._id });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
