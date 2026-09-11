import { NextResponse } from "next/server";
import { connectToDatabase, Category } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const categories = await Category.find().sort({ name: 1 });
  return NextResponse.json({ status: "ok", categories });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Category.findOne({ name: body.name.trim() });
  if (existing) {
    return NextResponse.json({ status: "error", message: "A category with this name already exists" }, { status: 409 });
  }

  const category = await Category.create({ name: body.name.trim() });
  return NextResponse.json({ status: "ok", category }, { status: 201 });
}
