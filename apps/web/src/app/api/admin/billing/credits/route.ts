import { NextResponse } from "next/server";
import { connectToDatabase, BillingCredit, BILLING_OWNER_TYPES, BILLING_CREDIT_TYPES } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const OWNER_TYPE_SET: readonly string[] = BILLING_OWNER_TYPES;
const CREDIT_TYPE_SET: readonly string[] = BILLING_CREDIT_TYPES;

/**
 * Written whenever Finance/Admin issues a credit or refund from Billing
 * Oversight — a permanent audit trail (spec Section 2), never edited or
 * deleted after creation, so there's deliberately no PATCH/DELETE here.
 */
export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.ownerId !== "string" ||
    !OWNER_TYPE_SET.includes(body.ownerType) ||
    !CREDIT_TYPE_SET.includes(body.type) ||
    typeof body.amount !== "number" ||
    body.amount <= 0
  ) {
    return NextResponse.json({ status: "error", message: "ownerType, ownerId, type, and a positive amount are required" }, { status: 400 });
  }

  await connectToDatabase();
  const credit = await BillingCredit.create({
    ownerType: body.ownerType,
    ownerId: body.ownerId,
    type: body.type,
    amount: body.amount,
    reason: typeof body.reason === "string" ? body.reason : "",
    issuedBy: session.user._id,
  });

  return NextResponse.json({ status: "ok", credit }, { status: 201 });
}

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.view) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const credits = await BillingCredit.find().sort({ issuedAt: -1 }).limit(200);
  return NextResponse.json({ status: "ok", credits });
}
