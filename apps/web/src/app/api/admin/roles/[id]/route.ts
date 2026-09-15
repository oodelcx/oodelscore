import { NextResponse } from "next/server";
import { connectToDatabase, Role, logAuditEvent } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
  }

  await connectToDatabase();
  const role = await Role.findById(id);
  if (!role) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const before = { description: role.description, permissions: role.permissions };

  // name/isSystemRole are immutable — a system role's name is how the rest
  // of the app (seed data, Admin-role checks) identifies it.
  if (typeof body.description === "string") role.description = body.description;
  if (body.permissions && typeof body.permissions === "object") {
    role.permissions = { ...role.permissions, ...body.permissions };
  }

  await role.save();

  await logAuditEvent({
    actor: session.user,
    action: "role.permissions_changed",
    targetType: "Role",
    targetId: role._id.toString(),
    targetLabel: role.name,
    before,
    after: { description: role.description, permissions: role.permissions },
  });

  return NextResponse.json({ status: "ok", role });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const role = await Role.findById(id);
  if (!role) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  if (role.isSystemRole) {
    return NextResponse.json({ status: "error", message: "System roles cannot be deleted" }, { status: 403 });
  }

  await role.deleteOne();
  return NextResponse.json({ status: "ok" });
}
