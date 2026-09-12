import { NextResponse } from "next/server";
import { connectToDatabase, Role, ACCOUNT_TYPES, type AccountType, createInviteUser, hasStaffPermission } from "@oodelscore/shared";
import { getCurrentUser } from "@/lib/session";

const ACCOUNT_TYPE_SET: readonly string[] = ACCOUNT_TYPES;

/**
 * Admin-only: creates a `users` doc and emails a set-password link via the
 * `welcome` template (spec Section 3/11). No password is ever set here —
 * matches "No password is ever set by Admin."
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.accountType !== "admin_staff") {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const currentRole = currentUser.roleId ? await Role.findById(currentUser.roleId) : null;
  if (!currentRole || !hasStaffPermission(currentRole, "staffAndRoles", "edit")) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const accountType = typeof body?.accountType === "string" ? body.accountType : null;
  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  const roleId = typeof body?.roleId === "string" ? body.roleId : null;

  if (!email || !accountType || !ACCOUNT_TYPE_SET.includes(accountType)) {
    return NextResponse.json(
      { status: "error", message: "email and a valid accountType are required" },
      { status: 400 }
    );
  }

  try {
    const user = await createInviteUser({
      email,
      accountType: accountType as AccountType,
      parentId,
      roleId,
      appUrl: process.env.APP_URL ?? "",
    });
    return NextResponse.json({ status: "ok", userId: user._id.toString() }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invite";
    return NextResponse.json({ status: "error", message }, { status: 409 });
  }
}
