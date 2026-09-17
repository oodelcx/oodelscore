import { NextResponse } from "next/server";
import { connectToDatabase, User, Role, Business, ParentOrganization, logAuditEvent } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Edits an existing staff member's role and/or assigned accounts, without
 * the delete-and-reinvite workaround (which loses no data but shows up in
 * the audit trail as delete+create instead of a change).
 *
 * "Assigned accounts" isn't a field on the User doc — it's derived from
 * which Business/ParentOrganization docs have this staff member's _id as
 * their `accountManagerId` (see assignedAccountsCell() in the Accounts page
 * and the "assigned" scope check in canAccessScopedResource()). So editing
 * it here means reassigning accountManagerId on those docs: clearing it
 * from ones no longer in the new list, and setting it on ones newly added.
 */
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
  const target = await User.findOne({ _id: id, accountType: "admin_staff" });
  if (!target) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  let newRoleId = target.roleId;
  if (body.roleId !== undefined) {
    if (typeof body.roleId !== "string" || !body.roleId) {
      return NextResponse.json({ status: "error", message: "roleId is required" }, { status: 400 });
    }
    const role = await Role.findById(body.roleId);
    if (!role) return NextResponse.json({ status: "error", message: "Role not found" }, { status: 404 });
    newRoleId = role._id;
  }

  const editingAssignedAccounts =
    Array.isArray(body.assignedBusinessIds) || Array.isArray(body.assignedParentOrgIds);
  const assignedBusinessIds: string[] = Array.isArray(body.assignedBusinessIds)
    ? body.assignedBusinessIds.filter((v: unknown) => typeof v === "string")
    : [];
  const assignedParentOrgIds: string[] = Array.isArray(body.assignedParentOrgIds)
    ? body.assignedParentOrgIds.filter((v: unknown) => typeof v === "string")
    : [];

  const beforeBusinessIds = (await Business.find({ accountManagerId: target._id }).select("_id")).map((b) =>
    b._id.toString()
  );
  const beforeParentOrgIds = (await ParentOrganization.find({ accountManagerId: target._id }).select("_id")).map((o) =>
    o._id.toString()
  );
  const before = {
    roleId: target.roleId?.toString() ?? null,
    assignedBusinessIds: beforeBusinessIds,
    assignedParentOrgIds: beforeParentOrgIds,
  };

  target.roleId = newRoleId;
  await target.save();

  if (editingAssignedAccounts) {
    await Business.updateMany(
      { accountManagerId: target._id, _id: { $nin: assignedBusinessIds } },
      { $set: { accountManagerId: null } }
    );
    await Business.updateMany(
      { _id: { $in: assignedBusinessIds } },
      { $set: { accountManagerId: target._id } }
    );
    await ParentOrganization.updateMany(
      { accountManagerId: target._id, _id: { $nin: assignedParentOrgIds } },
      { $set: { accountManagerId: null } }
    );
    await ParentOrganization.updateMany(
      { _id: { $in: assignedParentOrgIds } },
      { $set: { accountManagerId: target._id } }
    );
  }

  await logAuditEvent({
    actor: session.user,
    action: "staff.access_changed",
    targetType: "User",
    targetId: target._id.toString(),
    targetLabel: target.email,
    before,
    after: {
      roleId: target.roleId?.toString() ?? null,
      assignedBusinessIds: editingAssignedAccounts ? assignedBusinessIds : before.assignedBusinessIds,
      assignedParentOrgIds: editingAssignedAccounts ? assignedParentOrgIds : before.assignedParentOrgIds,
    },
  });

  const updated = await User.findById(target._id).select("-passwordHash -inviteTokenHash").populate("roleId", "name");

  return NextResponse.json({ status: "ok", staff: updated });
}

/** Removes a staff member's access entirely (spec/mockup: "Remove access"). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.staffAndRoles.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Cannot remove your own access" }, { status: 400 });
  }

  await connectToDatabase();
  const removed = await User.findOneAndDelete({ _id: id, accountType: "admin_staff" });
  if (!removed) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  await logAuditEvent({
    actor: session.user,
    action: "staff.access_removed",
    targetType: "User",
    targetId: removed._id.toString(),
    targetLabel: removed.email,
  });

  return NextResponse.json({ status: "ok" });
}
