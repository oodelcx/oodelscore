import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  BILLING_ASSIGNMENTS,
  BUSINESS_PLANS,
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
  const filter = permission.scope === "assigned" ? { accountManagerId: user._id } : {};
  const businesses = await Business.find(filter).sort({ name: 1 });

  return NextResponse.json({ status: "ok", businesses });
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
    contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : "",
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

  return NextResponse.json({ status: "ok", business }, { status: 201 });
}
