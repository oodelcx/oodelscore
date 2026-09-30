import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectToDatabase, FeedbackPoint, QuestionTemplate, Event, getEnabledProducts, type IDemographicConfig } from "@oodelscore/shared";
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

  return NextResponse.json({ status: "ok", feedbackPoints });
}

/**
 * The business-side survey builder's create path. Deliberately narrow:
 * name/description/active are the business's own to set (same as any
 * other point), but the survey itself is always composed FROM an
 * Admin-authored template already available to this business's product(s)
 * — a chosen subset of that template's own question ids, in whatever order
 * the business picked. There is no field here for question text, type, or
 * category: those stay Admin-only, enforced by construction (this route
 * never accepts them) rather than by a rejected-field check.
 */
export async function POST(request: Request) {
  const session = await requireBusinessOwner({ requirePage: "feedbackPoints" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const existingCount = await FeedbackPoint.countDocuments({ businessId: session.business._id });
  if (existingCount >= session.business.maxFeedbackPoints) {
    return NextResponse.json(
      { status: "error", message: `Your plan allows up to ${session.business.maxFeedbackPoints} feedback point(s). Contact your account manager to add more.` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: "error", message: "Name is required" }, { status: 400 });

  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  if (!templateId) return NextResponse.json({ status: "error", message: "Pick a survey template to build from" }, { status: 400 });

  const template = await QuestionTemplate.findById(templateId);
  if (!template || !getEnabledProducts(session.business).includes(template.product)) {
    return NextResponse.json({ status: "error", message: "That template isn't available on your account" }, { status: 400 });
  }

  const templateQuestionIds = new Set(template.questions.map((q) => q._id?.toString()).filter((x): x is string => !!x));
  const requestedIds: string[] = Array.isArray(body?.selectedQuestionIds)
    ? body.selectedQuestionIds.filter((id: unknown) => typeof id === "string")
    : [];
  const selectedQuestionIds = requestedIds.filter((id) => templateQuestionIds.has(id));
  if (selectedQuestionIds.length === 0) {
    return NextResponse.json({ status: "error", message: "Pick at least one question from the template" }, { status: 400 });
  }

  let responseQuota: number | null = null;
  if (body?.responseQuota !== undefined && body?.responseQuota !== null && body?.responseQuota !== "") {
    const quota = Number(body.responseQuota);
    if (!Number.isFinite(quota) || quota < 1) {
      return NextResponse.json({ status: "error", message: "Response quota must be a positive number" }, { status: 400 });
    }
    responseQuota = Math.floor(quota);
  }

  const feedbackPoint = await FeedbackPoint.create({
    businessId: session.business._id,
    product: template.product,
    name,
    description: typeof body?.description === "string" ? body.description.trim() : "",
    qrToken: randomBytes(16).toString("hex"),
    questionTemplateOverride: template._id,
    selectedQuestionIds,
    responseQuota,
  });

  return NextResponse.json({ status: "ok", feedbackPoint }, { status: 201 });
}
