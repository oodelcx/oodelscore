import { NextRequest, NextResponse } from "next/server";
import {
  connectToDatabase,
  FeedbackPoint,
  Business,
  QuestionTemplate,
  Response,
  ScanToken,
  evaluateRealTimeAlertsForBusiness,
  analyzeThemeSentiment,
  classifyDevice,
  dedupCookieName,
  DEDUP_WINDOW_SECONDS,
  checkRateLimit,
  getRequestIp,
  logApiRouteError,
  isFeedbackPointOpen,
  effectiveDemographicConfig,
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
 * (fixed_threshold) after the response is recorded.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { qrToken } = await params;
  try {
    return await handlePost(request, qrToken);
  } catch (err) {
    await logApiRouteError("feedback/[qrToken]/submit POST", err, { qrToken });
    return NextResponse.json(
      { status: "error", message: "Something went wrong submitting your feedback. Please try again." },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest, qrToken: string) {
  await connectToDatabase();

  const feedbackPoint = await FeedbackPoint.findOne({ qrToken });
  if (!feedbackPoint || !isFeedbackPointOpen(feedbackPoint)) {
    return NextResponse.json({ status: "error", message: "This feedback link is no longer active" }, { status: 404 });
  }

  const business = await Business.findById(feedbackPoint.businessId);
  if (!business || !business.active) {
    return NextResponse.json({ status: "error", message: "This feedback link is no longer active" }, { status: 404 });
  }

  // Defense in depth alongside the scan-token single-use lock below: even
  // someone holding several valid scan tokens can't submit unboundedly
  // fast from one IP. A real person submits once per visit; 10 covers a
  // shared device across a small group without being a real ceiling for
  // an actual respondent.
  const submitRateLimit = await checkRateLimit(`feedback-submit:${getRequestIp(request)}:${feedbackPoint._id}`, 10, 600);
  if (!submitRateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests — please try again in a few minutes." }, { status: 429 });
  }

  // Same-device recheck (defense in depth against a client that skipped
  // the GET route's check) — see packages/shared/src/feedback/dedup.ts.
  const cookieName = dedupCookieName(feedbackPoint._id.toString());
  if (request.cookies.get(cookieName)) {
    return NextResponse.json(
      { status: "error", message: "You've already given feedback here in the last 24 hours — thank you!" },
      { status: 409 }
    );
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
  // Colleague Experience never collects an employee's identity — hard-null
  // here regardless of what the client sent, not just left to the
  // demographicConfig mandatory/off check below, so a malformed or
  // malicious request body can't smuggle identity onto an anonymous
  // response even if every other check were somehow bypassed.
  const isColleagueExperience = feedbackPoint.product === "colleague_experience";
  const respondentName =
    !isColleagueExperience && typeof body?.respondentName === "string" ? body.respondentName.trim() || null : null;
  const respondentEmail =
    !isColleagueExperience && typeof body?.respondentEmail === "string"
      ? body.respondentEmail.trim().toLowerCase() || null
      : null;
  const respondentPhone =
    !isColleagueExperience && typeof body?.respondentPhone === "string" ? body.respondentPhone.trim() || null : null;
  const ageGroup = typeof body?.ageGroup === "string" ? body.ageGroup : "";
  const gender = typeof body?.gender === "string" ? body.gender : "";

  const answerByIndex = new Map(answers.map((a) => [a.index, a.value]));

  for (let i = 0; i < template.questions.length; i++) {
    const question = template.questions[i];
    if (question.required && (answerByIndex.get(i) === undefined || answerByIndex.get(i) === "")) {
      return NextResponse.json({ status: "error", message: `"${question.text}" is required` }, { status: 400 });
    }
  }

  const demographicConfig = effectiveDemographicConfig(feedbackPoint, business);
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

  // Device-independent recheck: if this respondent gave contact info,
  // reusing it on a different browser/device within the window still
  // gets caught even though the dedup cookie above wouldn't be present.
  if (respondentEmail || respondentPhone) {
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000);
    const contactMatch = await Response.findOne({
      feedbackPointId: feedbackPoint._id,
      submittedAt: { $gte: windowStart },
      $or: [
        ...(respondentEmail ? [{ respondentEmail }] : []),
        ...(respondentPhone ? [{ respondentPhone }] : []),
      ],
    });
    if (contactMatch) {
      return NextResponse.json(
        { status: "error", message: "You've already given feedback here in the last 24 hours — thank you!" },
        { status: 409 }
      );
    }
  }

  const responseAnswers = template.questions.map((question, index) => {
    const raw = answerByIndex.get(index) ?? null;
    const isNumericType = question.type === "star_1_5" || question.type === "nps_0_10" || question.type === "slider";
    const value = isNumericType && raw !== null && raw !== "" ? Number(raw) : raw;
    return {
      questionId: question._id!,
      type: question.type as QuestionType,
      value,
      categoryId: question.categoryId,
    };
  });

  const createdResponse = await Response.create({
    feedbackPointId: feedbackPoint._id,
    businessId: business._id,
    product: feedbackPoint.product,
    eventId: feedbackPoint.eventId,
    answers: responseAnswers,
    respondentName,
    respondentEmail,
    respondentPhone,
    demographics: { ageGroup, gender },
    submittedAt: new Date(),
    deviceType: classifyDevice(request.headers.get("user-agent")),
  });

  // Feeds AI-assisted Action Board triage (spec Section 16.4) if an alert
  // fires from this response — the first open-text answer, if any.
  const openTextAnswer = responseAnswers.find((a) => a.type === "open_text" && typeof a.value === "string" && a.value.trim());
  const triggeringComment = typeof openTextAnswer?.value === "string" ? openTextAnswer.value : null;

  await evaluateRealTimeAlertsForBusiness(business._id, triggeringComment).catch((err) =>
    console.error("[feedback] real-time alert evaluation failed", err)
  );

  // Theme & Sentiment Intelligence (CX roadmap Phase 2) — deliberately NOT
  // awaited: a respondent filling out a form shouldn't wait on a Claude
  // call before seeing "thank you". Runs after the response is already
  // saved and updates it in place once the analysis finishes.
  if (triggeringComment) {
    analyzeThemeSentiment(triggeringComment)
      .then((result) =>
        Response.findByIdAndUpdate(createdResponse._id, {
          sentiment: result.sentiment,
          themes: result.themes,
          sentimentAnalyzedAt: new Date(),
        })
      )
      .catch((err) => console.error("[feedback] theme/sentiment analysis failed", err));
  }

  const response = NextResponse.json({ status: "ok" }, { status: 201 });
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEDUP_WINDOW_SECONDS,
  });
  return response;
}
