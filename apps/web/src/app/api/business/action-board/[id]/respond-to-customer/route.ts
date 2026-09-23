import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Response, sendTemplatedEmail } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Closes the loop on the customer's own end, not just internally: sends a
 * personal reply to whoever left the feedback this case came from. Tier 1
 * of the "closing the loop" design — sends from OodelCX's own verified
 * domain wearing this business's name, with Reply-To set to the business's
 * real contact address, so a reply lands straight in their normal inbox.
 * Requires a captured respondent email — nothing to send to otherwise.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (session.tier === "limited" && item.ownerId?.toString() !== session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const messageBody = typeof body?.message === "string" ? body.message.trim() : "";
  if (!messageBody) return NextResponse.json({ status: "error", message: "A message is required" }, { status: 400 });

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
  if (!session.business.contactEmail) {
    return NextResponse.json(
      { status: "error", message: "Set a contact email for this business first — replies need somewhere to land." },
      { status: 400 }
    );
  }

  try {
    await sendTemplatedEmail(
      "customer_response",
      responseWithEmail.respondentEmail,
      {
        respondent_name: responseWithEmail.respondentName ?? "there",
        business_name: session.business.name,
        message_body: messageBody,
      },
      { replyTo: session.business.contactEmail, fromName: session.business.name }
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
