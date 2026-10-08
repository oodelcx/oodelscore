import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { QuestionTemplate } from "../models/QuestionTemplate";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { Response as FeedbackResponse } from "../models/Response";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { ContactMessage } from "../models/ContactMessage";
import { hasProduct } from "../models/products";
import { resolveEscalationAssignee } from "../escalation/engine";
import { answerFor, type TemplateQuestion } from "./colleagueFlowsDemo";

/**
 * Last layer of the showcase, for prospect demos: everything added in the
 * launch build that the older seeds do not show.
 *
 *  1. Every case gets a "Raised by" originator.
 *  2. Cases with a full escalation journey (branch -> level 2 -> level 3) so
 *     the highest level can see where it came from, plus one stepped back.
 *  3. Survey lifecycle: a Draft and a Closed survey (with responses) on each
 *     standalone business.
 *  4. The simple staff survey: one survey per branch of every group that
 *     runs Colleague X, with response counts above and below the 5-response
 *     line so both states are visible.
 *  5. A few messages in the Admin contact inbox.
 *
 * Compass, Evidence Fusion and REACH are computed live from the activity the
 * main showcase created (see compassDemo.ts), so they need no rows here.
 * Idempotent: every block looks for what it would create first.
 */
export interface LaunchDemoResult {
  originators: number;
  escalationJourneys: number;
  draftSurveys: number;
  closedSurveys: number;
  staffSurveys: number;
  staffResponses: number;
  contactMessages: number;
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const STAFF_COMMENTS = [
  "Rotas are published too late for us to plan childcare.",
  "My manager listens and acts. That is rare and I value it.",
  "We are short-staffed on weekends and it shows.",
  "The new handover process saves a lot of time.",
  "I would like clearer paths to promotion.",
  "Equipment in the back office keeps failing.",
  "Training for new starters is good but too quick.",
  "I feel safe raising concerns here.",
  "Recognition is uneven between teams.",
  "Communication from head office is much better this year.",
  "Break rooms need a refit.",
  "Weekend cover should be shared more fairly.",
];

async function firstTemplate(product: "customer_experience" | "colleague_experience") {
  return QuestionTemplate.findOne({ product }).sort({ createdAt: 1 });
}

export async function seedLaunchDemoExtras(): Promise<LaunchDemoResult> {
  const result: LaunchDemoResult = { originators: 0, escalationJourneys: 0, draftSurveys: 0, closedSurveys: 0, staffSurveys: 0, staffResponses: 0, contactMessages: 0 };

  // 1. Originators
  const missing = await ActionBoardItem.find({ $or: [{ originatorLabel: "" }, { originatorLabel: { $exists: false } }] });
  for (const item of missing) {
    item.originatorLabel =
      item.source === "manual" ? "A team member (entered by hand)" : item.source === "escalated" ? "System: escalated rule" : "System: low score or alert rule";
    await item.save();
    result.originators++;
  }

  // 2. Escalation journeys
  for (const org of await ParentOrganization.find({})) {
    const levels = (org.escalationLevels ?? []).slice().sort((a, b) => a.level - b.level);
    if (levels.length < 3) continue;
    const branches = await Business.find({ parentOrgId: org._id }).sort({ name: 1 });
    let done = 0;
    for (const branch of branches) {
      if (done >= 2) break;
      const item = await ActionBoardItem.findOne({
        businessId: branch._id,
        product: "customer_experience",
        status: { $ne: "resolved" },
        sensitive: { $ne: true },
        currentEscalationLevel: 1,
        "escalationHistory.0": { $exists: false },
      });
      if (!item) continue;
      const branchOwner = await User.findOne({ accountType: "business", parentId: branch._id });
      const teamMember = await User.findOne({ accountType: "team_member", teamOfType: "business", parentId: branch._id });
      const l2 = await resolveEscalationAssignee(branch._id.toString(), levels[1].level);
      const l3 = await resolveEscalationAssignee(branch._id.toString(), levels[2].level);
      if (!branchOwner || !l2 || !l3) continue;
      const starter = teamMember ?? branchOwner;
      const stepBack = done === 1;
      item.originatorLabel = starter.email;
      item.escalationHistory.push(
        {
          level: 1, userId: item.ownerId ?? branchOwner._id, action: "escalated", at: daysAgo(6),
          note: "Customer has called twice. I cannot fix this at branch level.",
          byUserId: starter._id, toUserId: l2, toLevel: levels[1].level, toLabel: levels[1].label,
        },
        {
          level: levels[1].level, userId: l2, action: "escalated", at: daysAgo(4),
          note: "Needs a decision on compensation policy.",
          byUserId: l2, toUserId: l3, toLevel: levels[2].level, toLabel: levels[2].label,
        }
      );
      let current = levels[2].level;
      let owner: Types.ObjectId = l3;
      if (stepBack) {
        item.escalationHistory.push({
          level: levels[2].level, userId: l3, action: "de_escalated", at: daysAgo(1),
          note: "Policy confirmed. Back to the regional lead to carry out.",
          byUserId: l3, toUserId: l2, toLevel: levels[1].level, toLabel: levels[1].label,
        });
        current = levels[1].level;
        owner = l2;
      }
      item.currentEscalationLevel = current;
      item.ownerId = owner;
      item.levelEnteredAt = daysAgo(stepBack ? 1 : 4);
      await item.save();
      done++;
      result.escalationJourneys++;
    }
  }

  // 3. Draft and Closed surveys on standalone businesses
  const cxTemplate = await firstTemplate("customer_experience");
  if (cxTemplate) {
    const questions = cxTemplate.questions as unknown as TemplateQuestion[];
    for (const business of await Business.find({ parentOrgId: null })) {
      if (!hasProduct(business, "customer_experience")) continue;
      const base = { businessId: business._id, product: "customer_experience" as const, questionTemplateOverride: cxTemplate._id, distributionMode: "qr_open" as const, scans: 0 };
      if (!(await FeedbackPoint.exists({ businessId: business._id, name: "Seasonal menu feedback (draft)" }))) {
        await FeedbackPoint.create({ ...base, name: "Seasonal menu feedback (draft)", description: "Ready to publish when the new menu launches.", qrToken: randomBytes(16).toString("hex"), isDraft: true, active: true });
        result.draftSurveys++;
      }
      if (!(await FeedbackPoint.exists({ businessId: business._id, name: "Summer event feedback (closed)" }))) {
        const point = await FeedbackPoint.create({ ...base, name: "Summer event feedback (closed)", description: "Collected during the summer event. Closed after the event.", qrToken: randomBytes(16).toString("hex"), active: false, scans: 24 });
        for (let i = 0; i < 9; i++) {
          const positive = i % 4 !== 0;
          await FeedbackResponse.create({
            feedbackPointId: point._id, businessId: business._id, product: "customer_experience",
            answers: questions.map((q) => answerFor(q, positive ? "Lovely evening, friendly staff." : "Queue for drinks was far too long.", positive)),
            respondentName: null, respondentEmail: null, respondentPhone: null, demographics: { ageGroup: "", gender: "" },
            submittedAt: daysAgo(30 + i), deviceType: "mobile", flagged: false,
          });
        }
        result.closedSurveys++;
      }
    }
  }

  // 4. Simple staff survey, one per branch
  const ceTemplate = await firstTemplate("colleague_experience");
  if (ceTemplate) {
    const questions = ceTemplate.questions as unknown as TemplateQuestion[];
    for (const org of await ParentOrganization.find({})) {
      const branches = (await Business.find({ parentOrgId: org._id }).sort({ name: 1 })).filter((b) => hasProduct(b, "colleague_experience"));
      let index = 0;
      for (const branch of branches) {
        const target = [9, 3, 6, 12, 2][index % 5];
        index++;
        const name = "Staff voice survey";
        let point = await FeedbackPoint.findOne({ businessId: branch._id, product: "colleague_experience", name });
        if (!point) {
          point = await FeedbackPoint.create({
            businessId: branch._id, product: "colleague_experience", questionTemplateOverride: ceTemplate._id, name,
            description: "One survey, published by head office to every branch.", qrToken: randomBytes(16).toString("hex"),
            distributionMode: "qr_open", scans: target * 3, active: true,
          });
          result.staffSurveys++;
        }
        const existing = await FeedbackResponse.countDocuments({ feedbackPointId: point._id });
        for (let i = existing; i < target; i++) {
          const positive = i % 3 !== 0;
          await FeedbackResponse.create({
            feedbackPointId: point._id, businessId: branch._id, product: "colleague_experience",
            answers: questions.map((q) => answerFor(q, STAFF_COMMENTS[(i + index) % STAFF_COMMENTS.length], positive)),
            respondentName: null, respondentEmail: null, respondentPhone: null, demographics: { ageGroup: "", gender: "" },
            submittedAt: daysAgo(2 + i * 3), deviceType: "mobile", flagged: false,
          });
          result.staffResponses++;
        }
      }
    }
  }

  // 5. Contact inbox
  if ((await ContactMessage.countDocuments({ email: /\.test$/ })) === 0) {
    await ContactMessage.create([
      { name: "Priya Nair", email: "priya.nair@regionalcare.test", company: "Regional Care Group", message: "We run 14 clinics and want to see how branches compare. Can someone call this week?" },
      { name: "Tom Ellery", email: "tom@brightschools.test", company: "Bright Schools", message: "Do you support parent feedback by QR code at the school gate?" },
      { name: "Lena Okafor", email: "lena@harborretail.test", company: "Harbor Retail", message: "Interested in the staff survey. How is anonymity handled for small stores?" },
    ]);
    result.contactMessages = 3;
  }

  return result;
}
