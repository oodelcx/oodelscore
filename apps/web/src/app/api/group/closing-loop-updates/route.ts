import { NextResponse } from "next/server";
import { connectToDatabase, ClosingLoopUpdate, Business, hasFeature, hasProduct } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

export async function GET() {
  const session = await requireParentOrgOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (!hasFeature(session.org.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();
  const updates = await ClosingLoopUpdate.find({ parentOrgId: session.org._id }).sort({ createdAt: -1 });
  return NextResponse.json({ status: "ok", updates });
}

export async function POST(request: Request) {
  const session = await requireParentOrgOwner({ requirePage: "closingLoop" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (!hasProduct(session.org, "colleague_experience")) {
    return NextResponse.json({ status: "error", message: "Colleague Experience is not enabled for this account" }, { status: 403 });
  }
  if (!hasFeature(session.org.enabledFeatures, "closingLoop")) {
    return NextResponse.json({ status: "error", message: "Closing the Loop is not enabled for this account" }, { status: 403 });
  }

  await connectToDatabase();

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ status: "error", message: "title is required" }, { status: 400 });

  const affectedBusinessIds = Array.isArray(body?.affectedBusinessIds) ? body.affectedBusinessIds : [];
  if (affectedBusinessIds.length > 0) {
    const count = await Business.countDocuments({ _id: { $in: affectedBusinessIds }, parentOrgId: session.org._id });
    if (count !== affectedBusinessIds.length) {
      return NextResponse.json({ status: "error", message: "affectedBusinessIds must all belong to this organization" }, { status: 400 });
    }
  } else {
    // No selection = every branch, same "affects everyone" default as an
    // org-wide Decision Log entry with an empty affectedBusinessIds.
    const all = await Business.find({ parentOrgId: session.org._id }).select("_id");
    affectedBusinessIds.push(...all.map((b) => b._id.toString()));
  }

  const update = await ClosingLoopUpdate.create({
    parentOrgId: session.org._id,
    product: "colleague_experience",
    title,
    whatWeHeard: typeof body?.whatWeHeard === "string" ? body.whatWeHeard.trim() : "",
    whatWereDoing: typeof body?.whatWereDoing === "string" ? body.whatWereDoing.trim() : "",
    linkedInitiativeId: typeof body?.linkedInitiativeId === "string" ? body.linkedInitiativeId : null,
    linkedDecisionId: typeof body?.linkedDecisionId === "string" ? body.linkedDecisionId : null,
    affectedBusinessIds,
  });

  return NextResponse.json({ status: "ok", update }, { status: 201 });
}
