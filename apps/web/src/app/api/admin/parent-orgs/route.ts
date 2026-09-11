import { NextResponse } from "next/server";
import { connectToDatabase, ParentOrganization, BILLING_MODES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const BILLING_MODE_SET: readonly string[] = BILLING_MODES;

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role, user } = session;
  const permission = role.permissions.parentOrgs;
  if (!permission.view) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const filter = permission.scope === "assigned" ? { accountManagerId: user._id } : {};
  const parentOrgs = await ParentOrganization.find(filter).sort({ name: 1 });

  return NextResponse.json({ status: "ok", parentOrgs });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role, user } = session;
  if (!role.permissions.parentOrgs.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });
  }
  if (body.defaultBillingMode !== undefined && !BILLING_MODE_SET.includes(body.defaultBillingMode)) {
    return NextResponse.json({ status: "error", message: "Invalid defaultBillingMode" }, { status: 400 });
  }

  await connectToDatabase();

  const accountManagerId = role.permissions.parentOrgs.scope === "assigned" ? user._id : (body.accountManagerId ?? null);

  const parentOrg = await ParentOrganization.create({
    name: body.name.trim(),
    contactName: typeof body.contactName === "string" ? body.contactName : "",
    contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : "",
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
    address: body.address ?? undefined,
    billingAddressSameAsAddress: body.billingAddressSameAsAddress ?? true,
    defaultBillingMode: body.defaultBillingMode ?? "branch_pays",
    accountManagerId,
  });

  return NextResponse.json({ status: "ok", parentOrg }, { status: 201 });
}
