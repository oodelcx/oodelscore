import { NextResponse } from "next/server";
import { connectToDatabase, Response, Business } from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

/**
 * Platform-wide Feedback Responses oversight (mockup: page-feedback-responses).
 *
 * Scoring rule (spec Section 2 / bug #1, see Response.ts): the ONLY correct
 * average score is the mean of `star_1_5` answers. NPS (`nps_0_10`) is
 * always its own separate figure. That correct math is what this route
 * reports as `avgScore` — it is never blended with NPS here or anywhere
 * else in the codebase (see business/analytics and business/dashboard).
 *
 * To make the historical bug auditable rather than just declaring it fixed,
 * this route also reports what the OLD buggy calculation (averaging every
 * numeric answer regardless of type) would have produced, purely so admins
 * can see which legacy responses were affected — `wouldHaveBeenAnomalous`
 * is true only when that legacy number would have exceeded 5 on a 1-5
 * scale, which can only happen when an NPS (0-10) answer got mixed in.
 */
export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  const permission = session.role.permissions.businesses;
  if (!permission.view) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const skip = (page - 1) * limit;

  await connectToDatabase();
  const businessFilter = permission.scope === "assigned" ? { accountManagerId: session.user._id } : {};
  const businesses = await Business.find(businessFilter).select("_id name");
  const businessIds = businesses.map((b) => b._id);
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  const filter: Record<string, unknown> = { businessId: { $in: businessIds } };
  if (from || to) {
    const submittedAt: Record<string, Date> = {};
    if (from) submittedAt.$gte = new Date(from);
    if (to) submittedAt.$lte = new Date(to);
    filter.submittedAt = submittedAt;
  }
  if (q) {
    // Search respondent fields directly on Response, plus business name via
    // the id subset of businesses whose name matches (Response has no
    // denormalized business name to query against directly).
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingBusinessIds = businesses.filter((b) => re.test(b.name)).map((b) => b._id);
    filter.$or = [{ respondentEmail: re }, { respondentName: re }, { businessId: { $in: matchingBusinessIds } }];
  }

  const [total, responses] = await Promise.all([
    Response.countDocuments(filter),
    Response.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const enriched = responses.map((r) => {
    const starValues = r.answers.filter((a) => a.type === "star_1_5" && typeof a.value === "number").map((a) => a.value as number);
    const npsValues = r.answers.filter((a) => a.type === "nps_0_10" && typeof a.value === "number").map((a) => a.value as number);
    const comment = r.answers.find((a) => a.type === "open_text" && typeof a.value === "string" && (a.value as string).trim());

    const avgScore = starValues.length ? starValues.reduce((s, v) => s + v, 0) / starValues.length : null;
    const npsScore = npsValues.length ? npsValues.reduce((s, v) => s + v, 0) / npsValues.length : null;
    const legacyBuggyValues = [...starValues, ...npsValues];
    const legacyBuggyAvg = legacyBuggyValues.length ? legacyBuggyValues.reduce((s, v) => s + v, 0) / legacyBuggyValues.length : null;
    const wouldHaveBeenAnomalous = legacyBuggyAvg !== null && legacyBuggyAvg > 5;

    return {
      _id: r._id.toString(),
      submittedAt: r.submittedAt,
      businessId: r.businessId.toString(),
      businessName: businessNameById.get(r.businessId.toString()) ?? "Unknown",
      respondentEmail: r.respondentEmail,
      respondentName: r.respondentName,
      avgScore,
      npsScore,
      hasComment: Boolean(comment),
      comment: comment ? (comment.value as string) : null,
      wouldHaveBeenAnomalous,
      flagged: r.flagged,
    };
  });

  return NextResponse.json({
    status: "ok",
    responses: enriched,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
