import { NextResponse } from "next/server";
import { connectToDatabase, Industry, Business } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });

  await connectToDatabase();
  const existing = await Industry.findOne({ name, _id: { $ne: id } });
  if (existing) {
    return NextResponse.json({ status: "error", message: "An industry with this name already exists" }, { status: 409 });
  }

  const industry = await Industry.findById(id);
  if (!industry) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  // Businesses store the industry as a plain name string (not a reference),
  // so a rename has to be propagated or every business using it silently
  // shows the old name forever.
  const oldName = industry.name;
  industry.name = name;
  await industry.save();
  if (oldName !== name) {
    await Business.updateMany({ industry: oldName }, { $set: { industry: name } });
  }

  return NextResponse.json({ status: "ok", industry });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.questionTemplates.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const industry = await Industry.findByIdAndDelete(id);
  if (!industry) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  // Matches the mockup's own wording: businesses using it keep their data,
  // the option just disappears from the dropdown going forward.
  return NextResponse.json({ status: "ok" });
}
