import { NextResponse } from "next/server";
import { connectToDatabase, FeedbackPoint, QuestionTemplate, type IDemographicConfig } from "@oodelscore/shared";
import { requireBusinessOwner } from "@/lib/ownerAuth";

/**
 * View-only for the Business portal (per the mockup): a business sees its
 * feedback points and can request new ones or changes, but creation is an
 * Admin/account-manager action (see /api/admin/businesses/[id]/feedback-points)
 * so every survey stays correctly configured.
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
