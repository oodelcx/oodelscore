import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  connectToDatabase,
  FeedbackPoint,
  Business,
  ParentOrganization,
  QuestionTemplate,
  ScanToken,
  dedupCookieName,
} from "@oodelscore/shared";

type RouteParams = { params: Promise<{ qrToken: string }> };

/** Public: fetches what the respondent-facing form needs to render. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { qrToken } = await params;
  await connectToDatabase();

  const feedbackPoint = await FeedbackPoint.findOne({ qrToken, active: true });
  if (!feedbackPoint) {
    return NextResponse.json({ status: "error", message: "This feedback link is no longer active" }, { status: 404 });
  }

  const business = await Business.findById(feedbackPoint.businessId);
  if (!business || !business.active) {
    return NextResponse.json({ status: "error", message: "This feedback link is no longer active" }, { status: 404 });
  }

  // One submission per person per feedback point per 24h: a cookie set on
  // successful submit (see the submit route) — its own 24h expiry IS the
  // dedup window, so mere presence means "already submitted recently."
  // This only catches the same browser/device; the submit route adds a
  // second, device-independent check against respondent email/phone.
  const dedupCookie = request.cookies.get(dedupCookieName(feedbackPoint._id.toString()));
  if (dedupCookie) {
    return NextResponse.json({
      status: "ok",
      alreadySubmitted: true,
      businessName: business.name,
    });
  }

  const templateId = feedbackPoint.questionTemplateOverride ?? business.questionTemplateId;
  const template = templateId ? await QuestionTemplate.findById(templateId) : null;
  if (!template) {
    return NextResponse.json({ status: "error", message: "No survey is configured for this link yet" }, { status: 404 });
  }

  // Fire-and-forget: powers the conversion-rate metric (responses / scans).
  // Not awaited on the response — a slow scan counter shouldn't delay the form.
  FeedbackPoint.updateOne({ _id: feedbackPoint._id }, { $inc: { scans: 1 } }).catch((err) =>
    console.error("[feedback] failed to increment scan count", err)
  );

  // One-time scan token: the submit route consumes this exactly once, so a
  // double-tapped submit button or a retried request can't create a second
  // response (and re-fire an alert) from the same page load. A fresh
  // scan/reload gets its own token and can still submit its own response.
  const scanToken = randomBytes(24).toString("hex");
  await ScanToken.create({ token: scanToken, feedbackPointId: feedbackPoint._id });

  const groupTag = business.parentOrgId ? (await ParentOrganization.findById(business.parentOrgId))?.name ?? null : null;
  const demographicConfig = feedbackPoint.demographicOverride ?? business.demographicConfig;
  const formLayout = feedbackPoint.formLayoutOverride ?? "single_page";

  return NextResponse.json({
    status: "ok",
    scanToken,
    businessName: business.name,
    groupTag: groupTag ? `Part of ${groupTag}` : null,
    formLayout,
    demographicConfig,
    questions: template.questions.map((q, index) => ({
      index,
      text: q.text,
      type: q.type,
      required: q.required,
      options: q.options,
    })),
  });
}
