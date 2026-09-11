import { NextResponse } from "next/server";
import { connectToDatabase, Industry } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.questionTemplates.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const industries = await Industry.find().sort({ name: 1 });
  return NextResponse.json({ status: "ok", industries });
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
  const existing = await Industry.findOne({ name: body.name.trim() });
  if (existing) {
    return NextResponse.json({ status: "error", message: "An industry with this name already exists" }, { status: 409 });
  }

  const industry = await Industry.create({ name: body.name.trim() });
  return NextResponse.json({ status: "ok", industry }, { status: 201 });
}
