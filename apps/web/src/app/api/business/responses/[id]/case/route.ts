import { NextResponse } from "next/server";
import { connectToDatabase, ActionBoardItem, Response, autoTriageAndCreateActionItem } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * "Make this a case": a person decides that one response needs follow-up. Responses that are not severe never
 * open a case by themselves, so this is how any other response becomes one. Opening it twice returns the same case.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectToDatabase();
  const response = await Response.findOne({ _id: id, businessId: session.business._id });
  if (!response) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  if (response.product === "colleague_experience") {
    return NextResponse.json({ status: "error", message: "Staff feedback is not turned into cases." }, { status: 409 });
  }

  const existing = await ActionBoardItem.findOne({ businessId: session.business._id, sourceResponseIds: response._id }).select("_id");
  if (existing) return NextResponse.json({ status: "ok", caseId: existing._id.toString(), alreadyOpen: true });

  const openText = response.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
  const comment = typeof openText?.value === "string" ? openText.value : null;
  const item = await autoTriageAndCreateActionItem(session.business, "Raised by hand from a response", comment, response.product, response._id);
  if (!item) return NextResponse.json({ status: "error", message: "The case could not be created. Try again." }, { status: 500 });
  return NextResponse.json({ status: "ok", caseId: item._id.toString(), alreadyOpen: false });
}
