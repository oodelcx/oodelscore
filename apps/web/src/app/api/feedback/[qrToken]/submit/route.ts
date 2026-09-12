import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  connectToDatabase,
  FeedbackPoint,
  Business,
  QuestionTemplate,
  Response,
  evaluateRealTimeAlertsForBusiness,
  type QuestionType,
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
  const answers: SubmittedAnswer[] = Array.isArray(body?.answers) ? body.answers : [];
  const respondentEmail = typeof body?.respondentEmail === "string" ? body.respondentEmail.trim() || null : null;
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
  if (demographicConfig.email === "mandatory" && !respondentEmail) {
    return NextResponse.json({ status: "error", message: "Email is required" }, { status: 400 });
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
    respondentEmail,
    demographics: { ageGroup, gender },
    submittedAt: new Date(),
  });

  await evaluateRealTimeAlertsForBusiness(business._id).catch((err) =>
    console.error("[feedback] real-time alert evaluation failed", err)
  );

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
