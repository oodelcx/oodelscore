import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { Category } from "../models/Category";
import { QuestionTemplate } from "../models/QuestionTemplate";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { Response as FeedbackResponse } from "../models/Response";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { RosterEntry, type LifecycleStage } from "../models/RosterEntry";
import { RosterSurveyToken } from "../models/RosterSurveyToken";
import { mintRosterSurveyTokens } from "../ce/rosterTokens";

/**
 * Seeds the three Colleague Experience flows the main showcase data does not
 * show, using the same models and field values the live product writes:
 *
 *  1. A roster-personalised pulse survey: real personal-link tokens for the
 *     active roster, some already used (with the matching anonymous
 *     responses) and some outstanding.
 *  2. Lifecycle surveys: the day-30, day-90 and exit survey for each
 *     location, with roster entries in realistic states (day-30 answered,
 *     leaver sent an exit link and not yet answered, new starter not due yet).
 *  3. Sensitive-comment routing: a colleague category marked Sensitive, the
 *     group's sensitive contact set, and two comments that name a senior
 *     leader, with the response flagged sensitiveRouted and the case
 *     routed to that contact.
 *
 * Idempotent: every row is found-or-created by a stable key, so it can be
 * run on top of existing showcase data without duplicating anything.
 *
 * The sensitive cases are written directly in the shape the live pipeline
 * produces (autoTriageAndCreateActionItem); they are NOT run through the AI
 * screen, so seeding needs no API key. All addresses use the reserved
 * ".test" domain, and no email is sent by this seed.
 */
const SENSITIVE_CATEGORY = "Leadership & Conduct";
const SENSITIVE_COMMENTS = [
  "I raised a problem with the regional director about how rotas are decided and was told to stop complaining. I no longer feel safe speaking up.",
  "The HR business partner dismissed my concern about unpaid overtime and said it would be remembered. I would like this looked at by someone independent.",
];
const PERSONAL_LINK_COMMENTS = [
  "My manager checks in every week and it makes a real difference.",
  "Scheduling is better since the change, thank you for listening.",
];
const DAY30_COMMENT = "The first month has been welcoming. I would like a clearer plan for my first review.";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export interface TemplateQuestion {
  _id?: Types.ObjectId;
  type: string;
  categoryId: Types.ObjectId | null;
  options?: string[];
}

export function answerFor(question: TemplateQuestion, comment: string, positive: boolean) {
  let value: unknown;
  switch (question.type) {
    case "star_1_5":
      value = positive ? 4 : 2;
      break;
    case "nps_0_10":
      value = positive ? 9 : 4;
      break;
    case "ces_1_5":
      value = positive ? 2 : 4;
      break;
    case "yes_no":
      value = positive;
      break;
    case "dropdown":
      value = question.options?.[0] ?? "";
      break;
    case "open_text":
      value = comment;
      break;
    default:
      value = null;
  }
  return { questionId: question._id!, type: question.type as never, value, categoryId: question.categoryId };
}

async function ensurePoint(params: {
  businessId: Types.ObjectId;
  name: string;
  templateId: Types.ObjectId;
  lifecycleTrigger: LifecycleStage | null;
  pulseCadence: "weekly" | "monthly" | null;
  lastSentAt: Date | null;
}) {
  const existing = await FeedbackPoint.findOne({ businessId: params.businessId, product: "colleague_experience", name: params.name });
  if (existing) {
    if (params.lifecycleTrigger && !existing.lifecycleGoLiveAt) {
      existing.lifecycleGoLiveAt = daysAgo(200);
      await existing.save();
    }
    return existing;
  }
  return FeedbackPoint.create({
    businessId: params.businessId,
    product: "colleague_experience",
    questionTemplateOverride: params.templateId,
    name: params.name,
    description: params.lifecycleTrigger ? `Lifecycle survey (${params.lifecycleTrigger})` : "Roster-personalised pulse survey",
    qrToken: randomBytes(16).toString("hex"),
    distributionMode: "roster_personalized",
    lifecycleTrigger: params.lifecycleTrigger,
    // Demo lifecycle surveys went live long ago, so the seeded roster states are not skipped as pre-go-live.
    lifecycleGoLiveAt: params.lifecycleTrigger ? daysAgo(200) : null,
    pulseCadence: params.pulseCadence,
    lastSentAt: params.lastSentAt,
    scans: 0,
    active: true,
  });
}

async function ensureResponse(params: {
  point: InstanceType<typeof FeedbackPoint>;
  businessId: Types.ObjectId;
  questions: TemplateQuestion[];
  comment: string;
  positive: boolean;
  daysAgoSubmitted: number;
  sensitiveRouted?: boolean;
}) {
  // Stable key: same survey + same comment text = same response.
  const probeQuestion = params.questions.find((q) => q.type === "open_text");
  const existing = probeQuestion
    ? await FeedbackResponse.findOne({
        feedbackPointId: params.point._id,
        businessId: params.businessId,
        "answers.value": params.comment,
      })
    : null;
  if (existing) return existing;
  return FeedbackResponse.create({
    feedbackPointId: params.point._id,
    businessId: params.businessId,
    product: "colleague_experience",
    answers: params.questions.map((q) => answerFor(q, params.comment, params.positive)),
    // Colleague responses never carry respondent identity.
    respondentName: null,
    respondentEmail: null,
    respondentPhone: null,
    demographics: { ageGroup: "", gender: "" },
    submittedAt: daysAgo(params.daysAgoSubmitted),
    deviceType: "mobile",
    flagged: false,
    sensitiveRouted: params.sensitiveRouted ?? false,
  });
}

export interface ColleagueFlowsSeedResult {
  locations: number;
  tokensMinted: number;
  tokensUsed: number;
  responses: number;
  sensitiveCases: number;
}

export async function seedColleagueFlowsDemo(): Promise<ColleagueFlowsSeedResult> {
  const result: ColleagueFlowsSeedResult = { locations: 0, tokensMinted: 0, tokensUsed: 0, responses: 0, sensitiveCases: 0 };

  const template = await QuestionTemplate.findOne({ name: "Colleague Pulse Survey", product: "colleague_experience" });
  if (!template) {
    console.warn("[colleague-flows] 'Colleague Pulse Survey' template not found — run the showcase seed first.");
    return result;
  }
  const questions = template.questions as unknown as TemplateQuestion[];

  const sensitiveCategory = await Category.findOneAndUpdate(
    { name: SENSITIVE_CATEGORY, product: "colleague_experience" },
    { $set: { sensitive: true }, $setOnInsert: { name: SENSITIVE_CATEGORY, product: "colleague_experience" } },
    { upsert: true, new: true }
  );

  const businesses = await Business.find({ enabledProducts: "colleague_experience" });
  for (const business of businesses) {
    const roster = await RosterEntry.find({ businessId: business._id }).sort({ email: 1 });
    if (roster.length === 0) continue; // only locations the showcase gave a roster
    result.locations++;

    // ---- Sensitive contact: the group owner (or the business owner when standalone) ----
    let contact: InstanceType<typeof User> | null = null;
    if (business.parentOrgId) {
      const org = await ParentOrganization.findById(business.parentOrgId);
      contact = await User.findOne({ accountType: "parent_org", parentId: business.parentOrgId });
      if (org && contact && !org.sensitiveRoutingContactId) {
        org.sensitiveRoutingContactId = contact._id;
        await org.save();
      }
    } else {
      contact = await User.findOne({ accountType: "business", parentId: business._id });
      if (contact && !business.sensitiveRoutingContactId) {
        business.sensitiveRoutingContactId = contact._id;
        await business.save();
      }
    }

    // ---- 1. Personal-link pulse ----
    const pulse = await ensurePoint({
      businessId: business._id,
      name: "Monthly Pulse (personal links)",
      templateId: template._id,
      lifecycleTrigger: null,
      pulseCadence: "monthly",
      lastSentAt: daysAgo(12),
    });
    const activeBefore = await RosterSurveyToken.countDocuments({ feedbackPointId: pulse._id });
    const minted = await mintRosterSurveyTokens(pulse._id);
    result.tokensMinted += minted.minted;
    if (activeBefore === 0) {
      // Two people answered their link: mark exactly two tokens used and add
      // exactly two anonymous responses (no link between them, as in the product).
      const tokens = await RosterSurveyToken.find({ feedbackPointId: pulse._id, usedAt: null }).sort({ createdAt: 1 }).limit(2);
      for (const [i, token] of tokens.entries()) {
        token.usedAt = daysAgo(10 - i);
        await token.save();
        result.tokensUsed++;
        await ensureResponse({
          point: pulse,
          businessId: business._id,
          questions,
          comment: PERSONAL_LINK_COMMENTS[i % PERSONAL_LINK_COMMENTS.length],
          positive: true,
          daysAgoSubmitted: 10 - i,
        });
        result.responses++;
      }
    }

    // ---- 2. Lifecycle surveys ----
    const day30 = await ensurePoint({ businessId: business._id, name: "Day-30 Check-in", templateId: template._id, lifecycleTrigger: "onboarding_30", pulseCadence: null, lastSentAt: null });
    await ensurePoint({ businessId: business._id, name: "Day-90 Check-in", templateId: template._id, lifecycleTrigger: "onboarding_90", pulseCadence: null, lastSentAt: null });
    const exit = await ensurePoint({ businessId: business._id, name: "Exit Survey", templateId: template._id, lifecycleTrigger: "exit", pulseCadence: null, lastSentAt: null });

    // The showcase roster: .3 started ~60 days ago (day-30 sent), .4 started
    // ~20 days ago (not due yet), .5 left 10 days ago (exit sent, unanswered).
    const byIndex = (n: number) => roster.find((r) => r.email.startsWith(`roster.${n}.`));
    const r3 = byIndex(3);
    if (r3 && !(await RosterSurveyToken.findOne({ feedbackPointId: day30._id, rosterEntryId: r3._id }))) {
      await RosterSurveyToken.create({
        token: randomBytes(24).toString("hex"),
        feedbackPointId: day30._id,
        rosterEntryId: r3._id,
        businessId: business._id,
        usedAt: daysAgo(28),
      });
      result.tokensMinted++;
      result.tokensUsed++;
      await ensureResponse({ point: day30, businessId: business._id, questions, comment: DAY30_COMMENT, positive: true, daysAgoSubmitted: 28 });
      result.responses++;
      if (!r3.triggeredStages.includes("onboarding_30")) {
        r3.triggeredStages.push("onboarding_30");
        await r3.save();
      }
    }
    const r5 = byIndex(5);
    if (r5 && !(await RosterSurveyToken.findOne({ feedbackPointId: exit._id, rosterEntryId: r5._id }))) {
      await RosterSurveyToken.create({
        token: randomBytes(24).toString("hex"),
        feedbackPointId: exit._id,
        rosterEntryId: r5._id,
        businessId: business._id,
        usedAt: null,
      });
      result.tokensMinted++;
      if (!r5.triggeredStages.includes("exit")) {
        r5.triggeredStages.push("exit");
        await r5.save();
      }
    }

    // ---- 3. Sensitive-comment routing (on this location's main shared-link pulse) ----
    // Sensitive-comment routing was retired for launch; no sensitive demo data is seeded.
    const mainPulse = true ? null : await FeedbackPoint.findOne({
      businessId: business._id,
      product: "colleague_experience",
      distributionMode: "qr_open",
      lifecycleTrigger: null,
    });
    if (mainPulse && contact) {
      for (const [i, comment] of SENSITIVE_COMMENTS.entries()) {
        const response = await ensureResponse({
          point: mainPulse,
          businessId: business._id,
          questions,
          comment,
          positive: false,
          daysAgoSubmitted: 6 - i * 2,
          sensitiveRouted: true,
        });
        const description = `Respondent comment: "${comment}"`;
        const existingCase = await ActionBoardItem.findOne({ businessId: business._id, product: "colleague_experience", sensitive: true, description });
        if (!existingCase) {
          await ActionBoardItem.create({
            parentOrgId: business.parentOrgId ?? null,
            businessId: business._id,
            product: "colleague_experience",
            title: i === 0 ? "Concern about how a senior leader handled a complaint" : "Concern about an HR response to an overtime issue",
            description,
            categoryId: sensitiveCategory._id,
            priority: "high",
            ownerId: contact._id,
            source: "auto_assigned",
            suggestedAction: "",
            sensitive: true,
            sourceResponseIds: [response._id],
          });
          result.sensitiveCases++;
        }
        result.responses++;
      }
    }
  }
  return result;
}
