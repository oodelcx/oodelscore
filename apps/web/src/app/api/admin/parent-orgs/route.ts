import { NextResponse } from "next/server";
import { connectToDatabase, ParentOrganization, User, BILLING_MODES, createInviteUser, expireStaleInvites } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const BILLING_MODE_SET: readonly string[] = BILLING_MODES;

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role, user } = session;
  const permission = role.permissions.parentOrgs;
  if (!permission.view) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  await expireStaleInvites();
  const filter = permission.scope === "assigned" ? { accountManagerId: user._id } : {};
  const parentOrgs = await ParentOrganization.find(filter).sort({ name: 1 });

  const owners = await User.find({ accountType: "parent_org", parentId: { $in: parentOrgs.map((o) => o._id) } }).select(
    "_id parentId inviteStatus"
  );
  const ownerByOrgId = new Map(owners.map((o) => [o.parentId?.toString(), o]));
  const orgsWithOwner = parentOrgs.map((o) => {
    const owner = ownerByOrgId.get(o._id.toString());
    return { ...o.toObject(), ownerUserId: owner?._id ?? null, ownerInviteStatus: owner?.inviteStatus ?? null };
  });

  return NextResponse.json({ status: "ok", parentOrgs: orgsWithOwner });
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
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (!contactEmail) {
    return NextResponse.json(
      { status: "error", message: "Contact email is required — it becomes this organization's login" },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const accountManagerId = role.permissions.parentOrgs.scope === "assigned" ? user._id : (body.accountManagerId ?? null);

  const parentOrg = await ParentOrganization.create({
    name: body.name.trim(),
    contactName: typeof body.contactName === "string" ? body.contactName : "",
    contactEmail,
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
    address: body.address ?? undefined,
    billingAddressSameAsAddress: body.billingAddressSameAsAddress ?? true,
    defaultBillingMode: body.defaultBillingMode ?? "branch_pays",
    accountManagerId,
  });

  let ownerInviteError: string | null = null;
  try {
    await createInviteUser({
      email: contactEmail,
      accountType: "parent_org",
      parentId: parentOrg._id,
      appUrl: process.env.APP_URL ?? "",
    });
  } catch (err) {
    ownerInviteError = err instanceof Error ? err.message : "Failed to create the organization login";
    console.error("[parent-orgs] failed to create/invite owner login", err);
  }

  return NextResponse.json({ status: "ok", parentOrg, ownerInviteError }, { status: 201 });
}
