import { NextResponse } from "next/server";
import { connectToDatabase, ParentOrganization, Business, BILLING_MODES, canAccessScopedResource } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const BILLING_MODE_SET: readonly string[] = BILLING_MODES;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const parentOrg = await ParentOrganization.findById(id);
  if (!parentOrg) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canView = canAccessScopedResource(
    role,
    "parentOrgs",
    "view",
    parentOrg.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const businesses = await Business.find({ parentOrgId: parentOrg._id }).sort({ name: 1 });

  return NextResponse.json({ status: "ok", parentOrg, businesses });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const parentOrg = await ParentOrganization.findById(id);
  if (!parentOrg) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canEdit = canAccessScopedResource(
    role,
    "parentOrgs",
    "edit",
    parentOrg.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canEdit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
  }
  if (body.defaultBillingMode !== undefined && !BILLING_MODE_SET.includes(body.defaultBillingMode)) {
    return NextResponse.json({ status: "error", message: "Invalid defaultBillingMode" }, { status: 400 });
  }

  const editableFields = [
    "name",
    "contactName",
    "contactEmail",
    "contactPhone",
    "address",
    "billingAddressSameAsAddress",
    "defaultBillingMode",
    "accountManagerId",
  ] as const;

  for (const field of editableFields) {
    if (field in body) {
      (parentOrg as unknown as Record<string, unknown>)[field] = body[field];
    }
  }

  await parentOrg.save();
  return NextResponse.json({ status: "ok", parentOrg });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.parentOrgs.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();

  const businessCount = await Business.countDocuments({ parentOrgId: id });
  if (businessCount > 0) {
    return NextResponse.json(
      {
        status: "error",
        message: `Cannot delete — ${businessCount} business(es) still belong to this organization. Reassign or delete them first.`,
      },
      { status: 409 }
    );
  }

  const parentOrg = await ParentOrganization.findByIdAndDelete(id);
  if (!parentOrg) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "ok" });
}
