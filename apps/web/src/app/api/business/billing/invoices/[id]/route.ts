import { NextResponse } from "next/server";
import { connectToDatabase, Invoice, getInvoiceHostedUrl } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";
import { billingErrorResponse } from "@/lib/billingErrorResponse";

/** Redirects to the Stripe-hosted invoice/PDF for the "Download" action in Invoice history. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireBusinessOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.isTeamMember) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const invoice = await Invoice.findOne({ _id: id, ownerType: "business", ownerId: session.business._id });
  if (!invoice) return NextResponse.json({ status: "error", message: "Invoice not found" }, { status: 404 });
  if (!invoice.stripeInvoiceId) {
    return NextResponse.json({ status: "error", message: "No downloadable invoice on file for this record" }, { status: 404 });
  }

  try {
    const url = await getInvoiceHostedUrl(invoice.stripeInvoiceId);
    if (!url) return NextResponse.json({ status: "error", message: "Invoice PDF not available" }, { status: 404 });
    return NextResponse.redirect(url);
  } catch (err) {
    return billingErrorResponse(err);
  }
}
