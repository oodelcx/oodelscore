import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  connectToDatabase,
  FeedbackPoint,
  Business,
  QuestionTemplate,
  Response,
  ScanToken,
  evaluateRealTimeAlertsForBusiness,
  classifyDevice,
  type QuestionType,
  type DemographicMode,
} from "@oodelscore/shared";

type RouteParams = { params: Promise<{ qrToken: string }> };

interface SubmittedAnswer {
  index: number;
  value: unknown;
}

/**
 * Public: the actual write path for respondent feedback. Never emails the
 * respondent (spec Section 11 — feedback forms never trigger account-side
 * email triggers), and always triggers the real-time Alert Rules check
 * (fixed_threshold/nps_floor) after the response is recorded.
 */
export async function POST(request: Request, { params }: RouteParams) {
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

  const templateId = feedbackPoint.questionTemplateOverride ?? business.questionTemplateId;
  const template = templateId ? await QuestionTemplate.findById(templateId) : null;
  if (!template) {
    return NextResponse.json({ status: "error", message: "No survey is configured for this link yet" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  const scanToken = typeof body?.scanToken === "string" ? body.scanToken : "";
  const consumedToken = scanToken
    ? await ScanToken.findOneAndUpdate(
        { token: scanToken, feedbackPointId: feedbackPoint._id, usedAt: null },
        { $set: { usedAt: new Date() } }
      )
    : null;
  if (!consumedToken) {
    return NextResponse.json(
      { status: "error", message: "This feedback session has already been submitted or expired — please rescan the QR code." },
      { status: 409 }
    );
  }

  const answers: SubmittedAnswer[] = Array.isArray(body?.answers) ? body.answers : [];
  const respondentName = typeof body?.respondentName === "string" ? body.respondentName.trim() || null : null;
  const respondentEmail = typeof body?.respondentEmail === "string" ? body.respondentEmail.trim() || null : null;
  const respondentPhone = typeof body?.respondentPhone === "string" ? body.respondentPhone.trim() || null : null;
  const ageGroup = typeof body?.ageGroup === "string" ? body.ageGroup : "";
  const gender = typeof body?.gender === "string" ? body.gender : "";

  const answerByIndex = new Map(answers.map((a) => [a.index, a.value]));

  for (let i = 0; i < template.questions.length; i++) {
    const question = template.questions[i];
    if (question.required && (answerByIndex.get(i) === undefined || answerByIndex.get(i) === "")) {
      return NextResponse.json({ status: "error", message: `"${question.text}" is required` }, { status: 400 });
    }
  }

  const demographicConfig = feedbackPoint.demographicOverride ?? business.demographicConfig;
  const demographicChecks: [string, DemographicMode, unknown][] = [
    ["Name", demographicConfig.name, respondentName],
    ["Email", demographicConfig.email, respondentEmail],
    ["Phone number", demographicConfig.phone, respondentPhone],
    ["Age group", demographicConfig.ageGroup, ageGroup || null],
    ["Gender", demographicConfig.gender, gender || null],
  ];
  for (const [label, mode, value] of demographicChecks) {
    if (mode === "mandatory" && !value) {
      return NextResponse.json({ status: "error", message: `${label} is required` }, { status: 400 });
    }
  }

  const responseAnswers = template.questions.map((question, index) => {
    const raw = answerByIndex.get(index) ?? null;
    const isNumericType = question.type === "star_1_5" || question.type === "nps_0_10" || question.type === "slider";
    const value = isNumericType && raw !== null && raw !== "" ? Number(raw) : raw;
    return {
      questionId: new Types.ObjectId(),
      type: question.type as QuestionType,
      value,
      categoryId: question.categoryId,
    };
  });

  await Response.create({
    feedbackPointId: feedbackPoint._id,
    businessId: business._id,
    answers: responseAnswers,
    respondentName,
    respondentEmail,
    respondentPhone,
    demographics: { ageGroup, gender },
    submittedAt: new Date(),
    deviceType: classifyDevice(request.headers.get("user-agent")),
  });

  await evaluateRealTimeAlertsForBusiness(business._id).catch((err) =>
    console.error("[feedback] real-time alert evaluation failed", err)
  );

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
