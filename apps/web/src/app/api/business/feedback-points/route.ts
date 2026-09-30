import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, QuestionTemplate, Event, buildFeedbackPointFromTemplate, type IDemographicConfig } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * Mostly view-only for the Business portal (per the mockup): a business
 * sees its feedback points and can request Admin-side changes it can't
 * make itself (see .../request). The one thing it CAN do itself, as of
 * PRODUCT-ROADMAP.md Phase 6, is create a new point via POST below — but
 * only by composing from an Admin-authored QuestionTemplate's own already-
 * existing questions, never by writing new question text/categories.
 * Everything Admin-only about a feedback point (which template a business
 * defaults to, formLayoutOverride, demographicOverride, event linkage)
 * stays exactly as Admin-only as it's always been — see the admin creation
 * path at /api/admin/businesses/[id]/feedback-points for that route.
 *
 * Self-service building is standalone-business-only. A branch never gets
 * this itself — the product owner's explicit call was "don't give survey
 * building to branches, else every branch ends up with its own survey";
 * for a branch, the Group (parent org) owner builds centrally instead (see
 * /api/group/feedback-points), picking which branch a new point is for.
 * This keeps one place deciding what a multi-branch org's surveys look
 * like, instead of drift accumulating branch by branch.
 *
 * Also surfaces, per feedback point, the effective question/demographic
 * config (own template/demographic override, falling back to the business
 * default) so the UI can render the mockup's "NPS on", "Comments on",
 * "Email optional", "Age mandatory" badges — not just Active/Inactive.
 */
export async function GET() {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const points = await FeedbackPoint.find({ businessId: session.business._id }).sort({ createdAt: 1 });

  const eventIds = Array.from(new Set(points.map((p) => p.eventId?.toString()).filter((id): id is string => Boolean(id))));
  const events = eventIds.length ? await Event.find({ _id: { $in: eventIds } }).select("name") : [];
  const eventNameById = new Map(events.map((e) => [e._id.toString(), e.name]));

  const templateIds = Array.from(
    new Set(
      points
        .map((p) => (p.questionTemplateOverride ?? session.business.questionTemplateId)?.toString())
        .filter((id): id is string => Boolean(id))
    )
  );
  const templates = templateIds.length ? await QuestionTemplate.find({ _id: { $in: templateIds } }) : [];
  const templatesById = new Map(templates.map((t) => [t._id.toString(), t]));

  const feedbackPoints = points.map((p) => {
    const templateId = (p.questionTemplateOverride ?? session.business.questionTemplateId)?.toString() ?? null;
    const template = templateId ? templatesById.get(templateId) : null;
    const types = new Set(template?.questions.map((q) => q.type) ?? []);
    const demographics: IDemographicConfig = p.demographicOverride ?? session.business.demographicConfig;

    return {
      ...p.toObject(),
      eventName: p.eventId ? eventNameById.get(p.eventId.toString()) ?? null : null,
      hasNps: types.has("nps_0_10"),
      hasComments: types.has("open_text"),
      demographics,
      // These settings are Admin-managed and can differ per feedback point
      // (a business-wide "Survey Settings" summary would be misleading —
      // each point can override the template/layout independently), so
      // the Feedback Points page shows the effective value per point
      // instead of a separate settings screen.
      templateName: template?.name ?? "No template configured",
      isTemplateOverridden: !!p.questionTemplateOverride,
      effectiveFormLayout: p.formLayoutOverride ?? "single_page",
      isLayoutOverridden: !!p.formLayoutOverride,
    };
  });

  return NextResponse.json({ status: "ok", feedbackPoints, isBranch: !!session.business.parentOrgId });
}

/**
 * The business-side survey builder's create path — standalone businesses
 * only (see this file's top comment). Deliberately narrow even for those:
 * name/description are the business's own to set, but the survey itself is
 * always composed FROM an Admin-authored template already available to
 * this business's product(s) — a chosen subset of that template's own
 * question ids, in whatever order the business picked. There is no field
 * here for question text, type, or category: those stay Admin-only,
 * enforced by construction (this route never accepts them) rather than by
 * a rejected-field check.
 */
export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  if (session.business.parentOrgId) {
    return NextResponse.json(
      { status: "error", message: "Feedback points for a branch are built centrally by your parent organization." },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const body = await request.json().catch(() => null);
  const result = await buildFeedbackPointFromTemplate({
    businessId: session.business._id,
    enabledProducts: session.business.enabledProducts,
    maxFeedbackPoints: session.business.maxFeedbackPoints,
    body,
  });
  if (result.status === "error") return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
