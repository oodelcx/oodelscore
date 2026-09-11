import { NextResponse } from "next/server";
import { connectToDatabase, Role, User } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const roles = await Role.find().sort({ isSystemRole: -1, name: 1 });

  // Denormalized headcount per role, mirrors the "N people" badge in the mockup.
  const counts = await User.aggregate<{ _id: string; count: number }>([
    { $match: { accountType: "admin_staff", roleId: { $ne: null } } },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const countsByRoleId = new Map(counts.map((c) => [c._id.toString(), c.count]));

  const rolesWithCounts = roles.map((role) => ({
    ...role.toObject(),
    peopleCount: countsByRoleId.get(role._id.toString()) ?? 0,
  }));

  return NextResponse.json({ status: "ok", roles: rolesWithCounts });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });
  }
  if (!body.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ status: "error", message: "permissions is required" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Role.findOne({ name: body.name.trim() });
  if (existing) {
    return NextResponse.json({ status: "error", message: "A role with this name already exists" }, { status: 409 });
  }

  const role = await Role.create({
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description : "",
    isSystemRole: false,
    permissions: body.permissions,
  });

  return NextResponse.json({ status: "ok", role }, { status: 201 });
}
