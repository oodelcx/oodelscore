import { NextRequest, NextResponse } from "next/server";
import {
  connectToDatabase,
  FeedbackPoint,
  RosterSurveyToken,
  hasProduct,
  getTeamMemberProducts,
  sendRosterSurveyLinks,
  logApiRouteError,
} from "@oodelscore/shared";
import { requireBusinessOwner, type BusinessOwnerSession } from "@/lib/ownerAuth";

function canUseColleagueExperience(session: BusinessOwnerSession): boolean {
  if (!hasProduct(session.business, "colleague_experience")) return false;
  if (session.isTeamMember) return getTeamMemberProducts(session.user).includes("colleague_experience");
  return true;
}

/**
 * Lists the business's roster_personalized Colleague Experience feedback
 * points, each with its participation rate (live/used tokens) — the
 * "how's this pulse survey going" view that pairs with the send action
 * below. Kept separate from GET /api/business/roster since that route's
 * stats are roster-wide, not per-survey.
 */
export async function GET() {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();
    const points = await FeedbackPoint.find({
      businessId: session.business._id,
      product: "colleague_experience",
      distributionMode: "roster_personalized",
    }).select("name active pulseCadence lastSentAt");

    const tokenCounts = await RosterSurveyToken.aggregate([
      { $match: { feedbackPointId: { $in: points.map((p) => p._id) } } },
      { $group: { _id: { feedbackPointId: "$feedbackPointId", used: { $ne: ["$usedAt", null] } }, count: { $sum: 1 } } },
    ]);

    const countsByPoint = new Map<string, { used: number; total: number }>();
    for (const row of tokenCounts) {
      const key = row._id.feedbackPointId.toString();
      const existing = countsByPoint.get(key) ?? { used: 0, total: 0 };
      existing.total += row.count;
      if (row._id.used) existing.used += row.count;
      countsByPoint.set(key, existing);
    }

    const feedbackPoints = points.map((p) => {
      const counts = countsByPoint.get(p._id.toString()) ?? { used: 0, total: 0 };
      return {
        _id: p._id.toString(),
        name: p.name,
        active: p.active,
        pulseCadence: p.pulseCadence,
        lastSentAt: p.lastSentAt,
        tokensIssued: counts.total,
        tokensUsed: counts.used,
        participationRate: counts.total > 0 ? Math.round((counts.used / counts.total) * 100) : null,
      };
    });

    return NextResponse.json({ status: "ok", feedbackPoints });
  } catch (err) {
    await logApiRouteError("business/roster/send-links GET", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}

/** Mints any missing tokens for currently-active roster entries and emails everyone with a live link. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireBusinessOwner({ requirePage: "colleagueRoster" });
    if (!session || !canUseColleagueExperience(session)) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const feedbackPointId = typeof body?.feedbackPointId === "string" ? body.feedbackPointId : "";
    if (!feedbackPointId) {
      return NextResponse.json({ status: "error", message: "feedbackPointId is required" }, { status: 400 });
    }

    await connectToDatabase();
    const feedbackPoint = await FeedbackPoint.findOne({
      _id: feedbackPointId,
      businessId: session.business._id,
      product: "colleague_experience",
      distributionMode: "roster_personalized",
    });
    if (!feedbackPoint) {
      return NextResponse.json({ status: "error", message: "Feedback point not found" }, { status: 404 });
    }

    const result = await sendRosterSurveyLinks(feedbackPoint._id);
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    await logApiRouteError("business/roster/send-links POST", err);
    return NextResponse.json({ status: "error", message: "Something went wrong" }, { status: 500 });
  }
}
