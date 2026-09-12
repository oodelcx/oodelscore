import { NextResponse } from "next/server";
import { connectToDatabase, createCheckoutSessionForOwner, CHECKOUT_PLANS } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

const CHECKOUT_PLAN_SET: readonly string[] = CHECKOUT_PLANS;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.plan !== "string" || !CHECKOUT_PLAN_SET.includes(body.plan)) {
    return NextResponse.json({ status: "error", message: "A valid plan is required" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "";

  await connectToDatabase();
  try {
    const url = await createCheckoutSessionForOwner({
      ownerType: "parentOrg",
      ownerId: id,
      plan: body.plan,
      successUrl: `${appUrl}/admin/parent-orgs/${id}?checkout=success`,
      cancelUrl: `${appUrl}/admin/parent-orgs/${id}?checkout=canceled`,
    });
    return NextResponse.json({ status: "ok", url });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
