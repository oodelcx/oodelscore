import { NextResponse } from "next/server";
import { connectToDatabase, hasProduct } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const bothProductsEnabled = hasProduct(session.org, "customer_experience") && hasProduct(session.org, "colleague_experience");
  const viewProduct = bothProductsEnabled ? await resolveViewProduct(session.org) : null;

  return NextResponse.json({ status: "ok", org: session.org, viewProduct });
}
