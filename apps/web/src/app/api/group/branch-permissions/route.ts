import { NextResponse } from "next/server";
import { connectToDatabase, BRANCH_DELEGATABLE_PERMISSIONS, type BranchDelegatablePermission } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

/**
 * Whether this org delegates Feedback Points/Category Owners/CX Goals/Alert
 * Rules down to its branches, or keeps each centralized at group level —
 * the org owner's call, not a fixed platform rule. See
 * ParentOrganization.branchPermissions and branchPermissionAllowed().
 */
export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  return NextResponse.json({ status: "ok", branchPermissions: session.org.branchPermissions });
}

export async function PATCH(request: Request) {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) {
    return NextResponse.json({ status: "error", message: "Only the account owner can change branch permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "A branchPermissions object is required" }, { status: 400 });
  }

  await connectToDatabase();
  for (const key of BRANCH_DELEGATABLE_PERMISSIONS as readonly BranchDelegatablePermission[]) {
    if (typeof body[key] === "boolean") {
      session.org.branchPermissions[key] = body[key];
    }
  }
  await session.org.save();

  return NextResponse.json({ status: "ok", branchPermissions: session.org.branchPermissions });
}
