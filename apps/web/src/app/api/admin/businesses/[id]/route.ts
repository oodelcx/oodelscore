import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  User,
  BILLING_ASSIGNMENTS,
  BUSINESS_PLANS,
  PRICING_INTERVALS,
  syncBranchGroupPaysCoverage,
  assertStaffCanEditBusinessAdminFields,
  canAccessScopedResource,
  ForbiddenFieldWriteError,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const BILLING_ASSIGNMENT_SET: readonly string[] = BILLING_ASSIGNMENTS;
const BUSINESS_PLAN_SET: readonly string[] = BUSINESS_PLANS;
const PRICING_INTERVAL_SET: readonly string[] = PRICING_INTERVALS;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canView = canAccessScopedResource(
    role,
    "businesses",
    "view",
    business.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canView) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  return NextResponse.json({ status: "ok", business });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findById(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const { role, user } = session;
  const canEdit = canAccessScopedResource(
    role,
    "businesses",
    "edit",
    business.accountManagerId?.toString() ?? null,
    user._id.toString()
  );
  if (!canEdit) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
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
  if (body.pricingTerms !== undefined) {
    const terms = body.pricingTerms;
    const validAmount = terms?.amount === null || (typeof terms?.amount === "number" && terms.amount > 0);
    const validInterval = terms?.interval === null || PRICING_INTERVAL_SET.includes(terms?.interval);
    if (!terms || typeof terms !== "object" || !validAmount || !validInterval) {
      return NextResponse.json({ status: "error", message: "Invalid pricingTerms" }, { status: 400 });
    }
  }

  // Spec Section 16: never let teamMemberSeatLimit drop below the
  // currently-active team-member count.
  if (body.teamMemberSeatLimit !== undefined && body.teamMemberSeatLimit !== null) {
    const activeMembers = await User.countDocuments({
      accountType: "team_member",
      teamOfType: "business",
      parentId: business._id,
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
    "industry",
    "parentOrgId",
    "region",
    "contactName",
    "contactEmail",
    "contactPhone",
    "address",
    "billingAddressSameAsAddress",
    "billingAssignment",
    "pricingTerms",
    "checkoutEnabled",
    "plan",
    "maxFeedbackPoints",
    "questionTemplateId",
    "demographicConfig",
    "accountManagerId",
    "teamMemberSeatLimit",
    "ragThresholds",
    "active",
  ] as const;

  for (const field of editableFields) {
    if (field in body) {
      (business as unknown as Record<string, unknown>)[field] = body[field];
    }
  }

  await business.save();

  // The billingAssignment/pricingTerms change itself is saved regardless —
  // a Stripe sync failure (org has no subscription yet, org priced as a
  // lump sum, etc.) is reported back but never blocks the save, so Admin
  // isn't stuck unable to set billingAssignment until Stripe cooperates.
  let billingSyncWarning: string | null = null;
  if ("billingAssignment" in body) {
    try {
      await syncBranchGroupPaysCoverage(business._id.toString());
    } catch (err) {
      billingSyncWarning = err instanceof Error ? err.message : "Failed to sync Stripe billing coverage";
    }
  }

  return NextResponse.json({ status: "ok", business, billingSyncWarning });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  if (!session.role.permissions.businesses.delete) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const business = await Business.findByIdAndDelete(id);
  if (!business) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  // Never leave an orphaned login behind — spec Section 13's orphaned-record
  // bug class applies here just as much as it did to billing subscriptions.
  await User.deleteOne({ accountType: "business", parentId: id });

  return NextResponse.json({ status: "ok" });
}
