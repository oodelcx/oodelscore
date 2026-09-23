import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Business, Response, sendTemplatedEmail } from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/** Org-scoped twin of the business respond-to-customer route — sends from the branch's own name/contact, not the org's. */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (session.tier === "limited" && item.ownerId?.toString() !== session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const messageBody = typeof body?.message === "string" ? body.message.trim() : "";
  if (!messageBody) return NextResponse.json({ status: "error", message: "A message is required" }, { status: 400 });

  const business = await Business.findById(item.businessId);
  if (!business) return NextResponse.json({ status: "error", message: "Branch not found" }, { status: 404 });

  const responseWithEmail = await Response.findOne({
    _id: { $in: item.sourceResponseIds },
    respondentEmail: { $ne: null },
  });
  if (!responseWithEmail?.respondentEmail) {
    return NextResponse.json(
      { status: "error", message: "No respondent email was captured for this case — nothing to send to." },
      { status: 400 }
    );
  }
  if (!business.contactEmail) {
    return NextResponse.json(
      { status: "error", message: "Set a contact email for this branch first — replies need somewhere to land." },
      { status: 400 }
    );
  }

  try {
    await sendTemplatedEmail(
      "customer_response",
      responseWithEmail.respondentEmail,
      {
        respondent_name: responseWithEmail.respondentName ?? "there",
        business_name: business.name,
        message_body: messageBody,
      },
      { replyTo: business.contactEmail, fromName: business.name }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }

  item.customerNotifiedAt = new Date();
  await item.save();

  return NextResponse.json({ status: "ok", item });
}
