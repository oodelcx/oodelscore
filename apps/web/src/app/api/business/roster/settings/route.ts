import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, Business, RosterEntry, hasProduct, getTeamMemberProducts, logApiRouteError } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Roster settings. Today just one: whether exit surveys may go to a leaver's
 * personal email. OFF by default. Turning it off deletes every stored
 * personal email for the business, so nothing is kept that is no longer used.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    const allowed =
      !!session &&
      hasProduct(session.business, "colleague_experience") &&
      (!session.isTeamMember || getTeamMemberProducts(session.user).includes("colleague_experience"));
    if (!session || !allowed) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (typeof body?.exitSurveyPersonalEmailEnabled !== "boolean") {
      return NextResponse.json({ status: "error", message: "exitSurveyPersonalEmailEnabled (true/false) is required" }, { status: 400 });
    }

    await connectToDatabase();
    await Business.updateOne({ _id: session.business._id }, { $set: { exitSurveyPersonalEmailEnabled: body.exitSurveyPersonalEmailEnabled } });
    let cleared = 0;
    if (!body.exitSurveyPersonalEmailEnabled) {
      const res = await RosterEntry.updateMany({ businessId: session.business._id, personalEmail: { $exists: true, $nin: ["", null] } }, { $set: { personalEmail: "" } });
      cleared = res.modifiedCount ?? 0;
    }
    return NextResponse.json({ status: "ok", exitSurveyPersonalEmailEnabled: body.exitSurveyPersonalEmailEnabled, cleared });
  } catch (err) {
    await logApiRouteError("business/roster/settings PATCH", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}
