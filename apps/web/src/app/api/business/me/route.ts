import { NextResponse } from "next/server";
import { connectToDatabase, hasProduct } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { resolveViewProduct } from "@/lib/viewProduct";

export async function GET() {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const bothProductsEnabled = hasProduct(session.business, "customer_experience") && hasProduct(session.business, "colleague_experience");
  const viewProduct = bothProductsEnabled ? await resolveViewProduct(session.business) : null;

  return NextResponse.json({ status: "ok", business: session.business, viewProduct });
}
