import { NextResponse } from "next/server";
import { connectToDatabase, ClosingLoopUpdate, sendClosingLoopUpdate, hasFeature, hasProduct } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.business, "colleague_experience") || !hasFeature(session.business.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const update = await ClosingLoopUpdate.findOne({ _id: id, businessId: session.business._id });
  if (!update) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (update.status === "sent") {
    return NextResponse.json({ status: "error", message: "Already sent." }, { status: 400 });
  }
  if (!update.whatWeHeard.trim() || !update.whatWereDoing.trim()) {
    return NextResponse.json(
      { status: "error", message: "Fill in both \"What we heard\" and \"What we're doing\" before sending." },
      { status: 400 }
    );
  }

  const result = await sendClosingLoopUpdate(update);
  return NextResponse.json({ status: "ok", update, result });
}
