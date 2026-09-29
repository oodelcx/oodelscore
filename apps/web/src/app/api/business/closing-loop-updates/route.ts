import { NextResponse } from "next/server";
import { connectToDatabase, ClosingLoopUpdate, hasFeature, hasProduct } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * A standalone business's own "you said, we did" updates. Colleague
 * Experience only — this is the anonymity-safe broadcast counterpart to
 * the CX half's per-response respond-to-customer (see ClosingLoopUpdate's
 * own model comment for why a broadcast is the only option here).
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (!hasFeature(session.business.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const updates = await ClosingLoopUpdate.find({ businessId: session.business._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", updates });
}

export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (!hasFeature(session.business.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const update = await ClosingLoopUpdate.create({
    businessId: session.business._id,
    product: "colleague_experience",
    title,
    whatWeHeard: typeof body?.whatWeHeard === "string" ? body.whatWeHeard.trim() : "",
    whatWereDoing: typeof body?.whatWereDoing === "string" ? body.whatWereDoing.trim() : "",
    linkedInitiativeId: typeof body?.linkedInitiativeId === "string" ? body.linkedInitiativeId : null,
    linkedDecisionId: typeof body?.linkedDecisionId === "string" ? body.linkedDecisionId : null,
    affectedBusinessIds: [session.business._id],
  });

  return NextResponse.json({ status: "ok", update });
}
