import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  User,
  BILLING_ASSIGNMENTS,
  BUSINESS_PLANS,
  createInviteUser,
  expireStaleInvites,
  type BillingAssignment,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { assertStaffCanEditBusinessAdminFields, ForbiddenFieldWriteError } from "@oodelscore/shared";

const BILLING_ASSIGNMENT_SET: readonly string[] = BILLING_ASSIGNMENTS;
const BUSINESS_PLAN_SET: readonly string[] = BUSINESS_PLANS;

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role, user } = session;
  const permission = role.permissions.businesses;
  if (!permission.view) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  await expireStaleInvites();
  const filter = permission.scope === "assigned" ? { accountManagerId: user._id } : {};
  const businesses = await Business.find(filter).sort({ name: 1 });

  const owners = await User.find({ accountType: "business", parentId: { $in: businesses.map((b) => b._id) } }).select(
    "_id parentId inviteStatus"
  );
  const ownerByBusinessId = new Map(owners.map((o) => [o.parentId?.toString(), o]));
  const businessesWithOwner = businesses.map((b) => {
    const owner = ownerByBusinessId.get(b._id.toString());
    return { ...b.toObject(), ownerUserId: owner?._id ?? null, ownerInviteStatus: owner?.inviteStatus ?? null };
  });

  return NextResponse.json({ status: "ok", businesses: businessesWithOwner });
}

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role, user } = session;
  if (!role.permissions.businesses.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required" }, { status: 400 });
  }
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (!contactEmail) {
    return NextResponse.json(
      { status: "error", message: "Contact email is required — it becomes this business's login" },
      { status: 400 }
    );
  }

  try {
    assertStaffCanEditBusinessAdminFields(role, body);
  } catch (err) {
    if (err instanceof ForbiddenFieldWriteError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: 403 });
    }
    throw err;
  }

  if (body.billingAssignment !== undefined && !BILLING_ASSIGNMENT_SET.includes(body.billingAssignment)) {
    return NextResponse.json({ status: "error", message: "Invalid billingAssignment" }, { status: 400 });
  }
  if (body.plan !== undefined && !BUSINESS_PLAN_SET.includes(body.plan)) {
    return NextResponse.json({ status: "error", message: "Invalid plan" }, { status: 400 });
  }

  await connectToDatabase();

  // Account managers scoped to "assigned" can only create businesses
  // assigned to themselves.
  const accountManagerId =
    role.permissions.businesses.scope === "assigned" ? user._id : (body.accountManagerId ?? null);

  const business = await Business.create({
    name: body.name.trim(),
    industry: typeof body.industry === "string" ? body.industry : "",
    parentOrgId: body.parentOrgId || null,
    region: typeof body.region === "string" ? body.region : "",
    contactName: typeof body.contactName === "string" ? body.contactName : "",
    contactEmail,
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
    address: body.address ?? undefined,
    billingAddressSameAsAddress: body.billingAddressSameAsAddress ?? true,
    billingAssignment: (body.billingAssignment as BillingAssignment) ?? "unassigned",
    plan: body.plan ?? "business_monthly",
    maxFeedbackPoints: typeof body.maxFeedbackPoints === "number" ? body.maxFeedbackPoints : 1,
    questionTemplateId: body.questionTemplateId || null,
    demographicConfig: body.demographicConfig ?? undefined,
    accountManagerId,
    active: true,
  });

  // Spec Section 3: creating a business/org account creates its owner
  // login too — never a blank record with nowhere for anyone to log in.
  let ownerInviteError: string | null = null;
  try {
    await createInviteUser({
      email: contactEmail,
      accountType: "business",
      parentId: business._id,
      appUrl: process.env.APP_URL ?? "",
    });
  } catch (err) {
    ownerInviteError = err instanceof Error ? err.message : "Failed to create the business login";
    console.error("[businesses] failed to create/invite owner login", err);
  }

  return NextResponse.json({ status: "ok", business, ownerInviteError }, { status: 201 });
}
