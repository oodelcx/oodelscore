import { NextResponse } from "next/server";
import {
  connectToDatabase,
  ParentOrganization,
  Business,
  User,
  BillingSubscription,
  Invoice,
  BillingCredit,
  BILLING_MODES,
  PRICING_INTERVALS,
  canAccessScopedResource,
  isValidFeatureKey,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const BILLING_MODE_SET: readonly string[] = BILLING_MODES;
const PRICING_INTERVAL_SET: readonly string[] = PRICING_INTERVALS;

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
  if (body.pricingTerms !== undefined) {
    const terms = body.pricingTerms;
    const validAmount = terms?.amount === null || (typeof terms?.amount === "number" && terms.amount > 0);
    const validInterval = terms?.interval === null || PRICING_INTERVAL_SET.includes(terms?.interval);
    if (!terms || typeof terms !== "object" || !validAmount || !validInterval) {
      return NextResponse.json({ status: "error", message: "Invalid pricingTerms" }, { status: 400 });
    }
  }

  if (body.escalationLevels !== undefined) {
    const levels = body.escalationLevels;
    const valid =
      Array.isArray(levels) &&
      levels.every((l: unknown) => l && typeof (l as { level?: unknown }).level === "number" && typeof (l as { label?: unknown }).label === "string");
    if (!valid) {
      return NextResponse.json({ status: "error", message: "Invalid escalationLevels" }, { status: 400 });
    }
  }
  if (body.escalationSlaHours !== undefined && body.escalationSlaHours !== null && typeof body.escalationSlaHours !== "number") {
    return NextResponse.json({ status: "error", message: "Invalid escalationSlaHours" }, { status: 400 });
  }
  if (body.enabledFeatures !== undefined && body.enabledFeatures !== null) {
    const keys = body.enabledFeatures;
    if (!Array.isArray(keys) || !keys.every((k: unknown) => typeof k === "string" && isValidFeatureKey(k))) {
      return NextResponse.json({ status: "error", message: "Invalid enabledFeatures" }, { status: 400 });
    }
  }
  if (body.paymentGateEnabled !== undefined && body.paymentGateEnabled !== null && typeof body.paymentGateEnabled !== "boolean") {
    return NextResponse.json({ status: "error", message: "Invalid paymentGateEnabled" }, { status: 400 });
  }

  // Command Center visibility, RAG banding, pricing, the escalation chain,
  // which advanced features are enabled, and the payment gate override are
  // Admin-only decisions — same rule as billingAssignment on a Business
  // (spec Section 4).
  const adminOnlyFields = (
    [
      "ragThresholds",
      "commandCenterEnabled",
      "pricingTerms",
      "checkoutEnabled",
      "escalationLevels",
      "escalationSlaHours",
      "enabledFeatures",
      "paymentGateEnabled",
    ] as const
  ).filter((f) => f in body);
  if (adminOnlyFields.length > 0 && !(role.isSystemRole && role.name === "Admin")) {
    return NextResponse.json(
      { status: "error", message: `Not permitted to write field(s): ${adminOnlyFields.join(", ")}` },
      { status: 403 }
    );
  }

  // Spec Section 16: never let a seat limit drop below the currently-active
  // count — that would strand active seats with no way to have been chosen.
  if (body.branchSeatLimit !== undefined && body.branchSeatLimit !== null) {
    const activeBranches = await Business.countDocuments({ parentOrgId: parentOrg._id, active: true });
    if (body.branchSeatLimit < activeBranches) {
      return NextResponse.json(
        { status: "error", message: `Can't set branch seat limit below the ${activeBranches} currently-active branches.` },
        { status: 400 }
      );
    }
  }
  if (body.teamMemberSeatLimit !== undefined && body.teamMemberSeatLimit !== null) {
    const activeMembers = await User.countDocuments({
      accountType: "team_member",
      teamOfType: "parentOrg",
      parentId: parentOrg._id,
      inviteStatus: { $ne: "invite_expired" },
    });
    if (body.teamMemberSeatLimit < activeMembers) {
      return NextResponse.json(
        { status: "error", message: `Can't set team seat limit below the ${activeMembers} currently-active team members.` },
        { status: 400 }
      );
    }
  }

  const editableFields = [
    "name",
    "contactName",
    "contactEmail",
    "contactPhone",
    "address",
    "billingAddressSameAsAddress",
    "defaultBillingMode",
    "pricingTerms",
    "checkoutEnabled",
    "escalationLevels",
    "escalationSlaHours",
    "accountManagerId",
    "branchSeatLimit",
    "teamMemberSeatLimit",
    "ragThresholds",
    "commandCenterEnabled",
    "enabledFeatures",
    "paymentGateEnabled",
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

  await User.deleteOne({ accountType: "parent_org", parentId: id });

  // Same orphaned-billing-records cleanup as the business delete route —
  // DB-only, no Stripe cancel call. See that route for the full rationale.
  await Promise.all([
    BillingSubscription.deleteMany({ ownerType: "parentOrg", ownerId: id }),
    Invoice.deleteMany({ ownerType: "parentOrg", ownerId: id }),
    BillingCredit.deleteMany({ ownerType: "parentOrg", ownerId: id }),
  ]);

  return NextResponse.json({ status: "ok" });
}
