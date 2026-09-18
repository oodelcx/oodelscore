import { NextResponse } from "next/server";
import { connectToDatabase, syncGroupPaysBranchesForOrg } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Manual catch-up for branches already sitting at billingAssignment
 * "group_pays" from before this org had a Stripe subscription to attach
 * them to — e.g. Admin marked a branch group_pays, then started the org's
 * checkout afterward. Every business PATCH already tries this automatically
 * (see syncBranchGroupPaysCoverage), so this is a manual retry, not the
 * only path.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!session.role.permissions.billingOversight.edit) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  try {
    const result = await syncGroupPaysBranchesForOrg(id);
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    return billingErrorResponse(err);
  }
}
