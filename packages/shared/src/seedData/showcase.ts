import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { OrgNode } from "../models/OrgNode";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User, type AccountType, type TeamMemberTier } from "../models/User";
import { FeedbackPoint } from "../models/FeedbackPoint";
import { QuestionTemplate, type IQuestion, type QuestionType } from "../models/QuestionTemplate";
import { Category } from "../models/Category";
import { Industry } from "../models/Industry";
import { Response as FeedbackResponse } from "../models/Response";
import { AlertRule, type AlertRuleType } from "../models/AlertRule";
import { AlertActivity } from "../models/AlertActivity";
import { ActionBoardItem, type ActionPriority } from "../models/ActionBoardItem";
import { ActionItemComment } from "../models/ActionItemComment";
import { DecisionLogEntry } from "../models/DecisionLogEntry";
import { ImprovementInitiative } from "../models/ImprovementInitiative";
import { RecurringIssueFlag, type RecurringFlagStatus } from "../models/RecurringIssueFlag";
import { Playbook } from "../models/Playbook";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { autoAttachPlaybook } from "../scoring/caseAutoAttach";
import { CxPulseScore } from "../models/CxPulseScore";
import { CxPulsePulseResponse } from "../models/CxPulsePulseResponse";
import { DEFAULT_CX_PULSE_QUESTIONS } from "./cxPulseFramework";
import { BillingSubscription } from "../models/BillingSubscription";
import { AiInsightReport } from "../models/AiInsightReport";
import { Invoice } from "../models/Invoice";
import { FeedbackPointRequest } from "../models/FeedbackPointRequest";
import { DemoRequest } from "../models/DemoRequest";
import { CxGoal, type CxGoalMetric, type CxGoalStatus } from "../models/CxGoal";
import { PlaybookRun } from "../models/PlaybookRun";
import { AuditLogEntry } from "../models/AuditLogEntry";
import { SupportTicket, type SupportTicketCategory, type SupportTicketStatus } from "../models/SupportTicket";
import { Event as TrainingEvent } from "../models/Event";
import { ClosingLoopUpdate } from "../models/ClosingLoopUpdate";
import { RosterEntry } from "../models/RosterEntry";
import { ProgramEvaluationReport } from "../models/ProgramEvaluationReport";
import { CompassAssessment } from "../models/CompassAssessment";
import { CompassAssessmentHistory } from "../models/CompassAssessmentHistory";
import { seedAmaniPrograms } from "./amaniPrograms";
import { seedLaunchDemoExtras } from "./launchDemo";
import { seedDemoFinish } from "./demoFinish";
import { seedStructureDemo } from "./structureDemo";
import { seedShowcasePolish } from "./showcasePolish";
import { RosterSurveyToken } from "../models/RosterSurveyToken";
import { seedCompassDemo, type CompassDemoOwner, type CompassDemoProfile } from "./compassDemo";
import { generateProgramEvaluationForEvent } from "../scoring/programEvaluation";
import { hashPassword } from "../auth/password";
import { markOwnerComp } from "../stripe/billing";
import { recomputeAllCxPulseScores } from "../cxpulse/compute";
import type { Product } from "../models/products";

/**
 * Every account this seed creates uses this password — never routed through
 * the real invite-email flow (spec Section 3's Resend send), so nothing here
 * ever triggers a real email. Contact emails use the IANA-reserved ".test"
 * TLD, guaranteed non-routable, so even a misconfigured send can't reach a
 * real inbox.
 *
 * This is a full rewrite of the showcase dataset around seven specific
 * organizations spanning both products and every account shape the app
 * supports (parent-org-with-branches, standalone, events-based, CX-only,
 * CE-only, both): Meridian Bank Group, Skyline Telecom, Horizon Schools
 * Trust, Amani Women's Empowerment & Peacebuilding Institute, Aurora
 * Airlines, The Olive Table, and St. Augustine Health Network. Every
 * business gets feedback points, responses, alerts, cases, support tickets
 * and a CX Goal; one business per organization additionally gets a full
 * "recurring problem -> initiative -> decision" narrative with a measured
 * before/after outcome, so the demo can walk a reviewer through a complete
 * case journey rather than just showing isolated rows. AI Insight Reports
 * are deliberately NOT hand-written here — call ai/insightsGeneration.ts's
 * generateDueInsights() after seeding (see scripts/wipe-and-reseed-showcase.ts)
 * to generate them live against this real data via the Claude API.
 */
export const SHOWCASE_PASSWORD = "ocx123";

/**
 * Optional demo-volume knobs (the wipe-and-reseed CLI sets them; every other
 * caller keeps the original small dataset). SCALE multiplies the number of
 * responses per feedback point; HISTORY_DAYS spreads the extra responses back
 * over that many days so the previous week, month, quarter and calendar year
 * (the periods AI Insight Reports cover) all have real data behind them.
 */
const responseScale = (): number => Math.max(1, Number(process.env.SHOWCASE_RESPONSE_SCALE ?? 1) || 1);
const historyDays = (): number => Math.max(0, Number(process.env.SHOWCASE_HISTORY_DAYS ?? 0) || 0);
const EMAIL_DOMAIN = "showcase.oodel.test";
// Demo logins: short and memorable, e.g. meridian@ocx.test, meridian.downtown@ocx.test. Password for all: ocx123.
const LOGIN_DOMAIN = "ocx.test";

/** "Meridian Bank – Downtown" -> "downtown"; "Horizon North Primary" (org "Horizon Schools Trust") -> "northprimary". */
const SHORT_BRANCH_KEYS: Record<string, string> = {
  "Meridian Bank – Airport Road": "airport",
  "Meridian Bank – Harbor Point": "harbor",
  "Precision Diagnostics – Main Lab": "main",
  "Precision Diagnostics – Westside Collection Centre": "westside",
  "Precision Diagnostics – Eastgate Imaging Centre": "eastgate",
  "Precision Diagnostics – Northfield Lab": "northfield",
  "Precision Diagnostics – Harbor Collection Point": "harbor",
  "Precision Diagnostics – Airport Road Lab": "airport",
  "St. Augustine Downtown Medical Center": "downtown",
  "St. Augustine North Clinic": "north",
  "St. Augustine Women's Health Pavilion": "womens",
  "Skyline Telecom – Northgate Store": "northgate",
  "Skyline Telecom – Eastside Store": "eastside",
  "Skyline Telecom – Downtown Service Center": "downtown",
  "Aurora Airlines – JFK Hub": "jfk",
  "Aurora Airlines – LAX Hub": "lax",
  "Aurora Airlines – ORD Hub": "ord",
};

function shortBranchKey(branchName: string, orgName: string): string {
  if (SHORT_BRANCH_KEYS[branchName]) return SHORT_BRANCH_KEYS[branchName];
  const afterDash = branchName.split(/\s[–-]\s/);
  let part: string;
  if (afterDash.length > 1) {
    part = afterDash[afterDash.length - 1];
  } else {
    // Drop the leading words the branch shares with its group's name.
    const orgWords = orgName.toLowerCase().split(/\s+/);
    const words = branchName.split(/\s+/);
    let i = 0;
    while (i < words.length - 1 && words[i].toLowerCase() === orgWords[i]) i++;
    part = words.slice(i).join(" ");
  }
  return part.toLowerCase().replace(/[^a-z0-9]+/g, "") || slug(branchName);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function pickSome<T>(items: readonly T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function currentQuarterLabel(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

async function upsertActiveUser(params: {
  email: string;
  accountType: AccountType;
  parentId: Types.ObjectId;
  teamRole?: string;
  tier?: TeamMemberTier;
  teamOfType?: "business" | "parentOrg";
  products?: Product[] | null;
  lastLoginDaysAgo?: number;
}) {
  const passwordHash = await hashPassword(SHOWCASE_PASSWORD);
  const doc = await User.findOneAndUpdate(
    { email: params.email },
    {
      $set: {
        passwordHash,
        accountType: params.accountType,
        parentId: params.parentId,
        teamRole: params.teamRole ?? "",
        tier: params.accountType === "team_member" ? (params.tier ?? "full") : null,
        teamOfType: params.accountType === "team_member" ? (params.teamOfType ?? null) : null,
        products: params.accountType === "team_member" ? (params.products ?? null) : null,
        inviteStatus: "active",
        inviteTokenHash: null,
        inviteExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: params.lastLoginDaysAgo !== undefined ? daysAgo(params.lastLoginDaysAgo) : null,
      },
      $setOnInsert: { tokenVersion: 0 },
    },
    { upsert: true, new: true }
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Shared category/question infrastructure — Customer Experience
// ---------------------------------------------------------------------------

const CATEGORY_NAMES = [
  "Staff Friendliness",
  "Cleanliness",
  "Service Speed",
  "Value for Money",
  "Communication",
  "Facilities",
  "Product Quality",
  "Digital Experience",
] as const;
type CategoryName = (typeof CATEGORY_NAMES)[number];

const THEMES_BY_CATEGORY: Record<CategoryName, string[]> = {
  "Staff Friendliness": ["staff friendliness", "staff attitude"],
  Cleanliness: ["cleanliness", "restroom cleanliness"],
  "Service Speed": ["wait time", "slow service"],
  "Value for Money": ["value for money", "pricing"],
  Communication: ["communication", "staff communication"],
  Facilities: ["facilities", "seating"],
  "Product Quality": ["product quality", "food quality"],
  "Digital Experience": ["app experience", "checkout experience"],
};

function deriveSentimentAndThemes(
  mood: "bad" | "neutral" | "good",
  categoryName: CategoryName | null,
  hasComment: boolean
): { sentiment: "positive" | "neutral" | "negative" | null; themes: string[] } {
  if (!hasComment) return { sentiment: null, themes: [] };
  const sentiment = mood === "bad" ? "negative" : mood === "good" ? "positive" : "neutral";
  const pool = categoryName ? THEMES_BY_CATEGORY[categoryName] : null;
  const themes = pool && Math.random() < 0.85 ? pickSome(pool, randomInt(1, pool.length)) : [];
  return { sentiment, themes };
}

interface QuestionDef {
  text: string;
  type: QuestionType;
  category: CategoryName | null;
  required?: boolean;
  options?: string[];
  isCsatQuestion?: boolean;
}

interface SectorDef {
  key: string;
  industry: string;
  templateName: string;
  questions: QuestionDef[];
}

const SECTORS: SectorDef[] = [
  {
    key: "banking",
    industry: "Banking",
    templateName: "Banking Branch Survey",
    questions: [
      { text: "How friendly was our staff during your visit?", type: "star_1_5", category: "Staff Friendliness", required: true , isCsatQuestion: true },
      { text: "How clean and well-maintained was the branch?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate the speed of service today?", type: "star_1_5", category: "Service Speed" },
      { text: "How likely are you to recommend us to a friend or colleague?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to get your issue resolved today?", type: "ces_1_5", category: "Service Speed" },
      { text: "Was your issue fully resolved today?", type: "yes_no", category: "Communication" },
      {
        text: "Which services did you use today?",
        type: "multi_select",
        category: "Product Quality",
        options: ["Teller", "ATM", "Loan Desk", "Customer Service", "Online Banking"],
      },
      { text: "Anything else you'd like to tell us?", type: "open_text", category: null },
    ],
  },
  {
    key: "education",
    industry: "Education",
    templateName: "School Feedback Survey",
    questions: [
      { text: "How friendly and approachable was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true , isCsatQuestion: true },
      { text: "How clean and well-maintained are our facilities?", type: "star_1_5", category: "Facilities" },
      { text: "How satisfied are you with communication from the school?", type: "star_1_5", category: "Communication" },
      { text: "How likely are you to recommend this school to another family?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to get the information you needed?", type: "ces_1_5", category: "Communication" },
      { text: "Did you get a response to your inquiry in a timely manner?", type: "yes_no", category: "Service Speed" },
      {
        text: "Which best describes your relationship to the school?",
        type: "dropdown",
        category: null,
        options: ["Parent", "Student", "Staff", "Visitor"],
      },
      { text: "Any suggestions for how we can improve?", type: "open_text", category: null },
    ],
  },
  {
    key: "restaurant",
    industry: "Restaurant",
    templateName: "Restaurant Guest Survey",
    questions: [
      { text: "How friendly was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true , isCsatQuestion: true },
      { text: "How would you rate the food quality?", type: "star_1_5", category: "Product Quality" },
      { text: "How clean was the restaurant?", type: "star_1_5", category: "Cleanliness" },
      { text: "How likely are you to recommend us to a friend?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to get your order the way you wanted it?", type: "ces_1_5", category: "Service Speed" },
      { text: "Was your order served in a reasonable time?", type: "yes_no", category: "Service Speed" },
      {
        text: "How did you dine with us today?",
        type: "multiple_choice",
        category: null,
        options: ["Dine-in", "Takeout", "Delivery"],
      },
      { text: "Anything else you'd like to tell us?", type: "open_text", category: null },
    ],
  },
  {
    key: "hospital",
    industry: "Healthcare",
    templateName: "Patient Experience Survey",
    questions: [
      { text: "How friendly and attentive was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true , isCsatQuestion: true },
      { text: "How clean was the facility?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate the wait time for your visit?", type: "star_1_5", category: "Service Speed" },
      { text: "How likely are you to recommend us to family or friends?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to get the care you needed today?", type: "ces_1_5", category: "Service Speed" },
      { text: "Did our staff clearly explain your diagnosis or treatment plan?", type: "yes_no", category: "Communication" },
      { text: "Overall, how was your visit today?", type: "emoji_scale", category: null },
      { text: "Anything else you'd like us to know?", type: "open_text", category: null },
    ],
  },
  {
    key: "diagnostics",
    industry: "Healthcare",
    templateName: "Diagnostic Lab Visit Survey",
    questions: [
      { text: "How friendly and respectful was our staff at the collection desk?", type: "star_1_5", category: "Staff Friendliness", required: true, isCsatQuestion: true },
      { text: "How clean and hygienic was the collection area?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate the wait before your sample or scan?", type: "star_1_5", category: "Service Speed" },
      { text: "How likely are you to recommend us to family or friends?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to book, get tested and receive your report?", type: "ces_1_5", category: "Service Speed" },
      { text: "Was your report ready within the time promised?", type: "yes_no", category: "Communication" },
      { text: "Overall, how was your visit today?", type: "emoji_scale", category: null },
      { text: "Anything else you'd like us to know?", type: "open_text", category: null },
    ],
  },
  {
    key: "training",
    industry: "Community Development & Training",
    templateName: "Workshop Feedback Survey",
    questions: [
      { text: "How would you rate the facilitator?", type: "star_1_5", category: "Staff Friendliness", required: true , isCsatQuestion: true },
      { text: "How relevant was the content to your work or life?", type: "star_1_5", category: "Product Quality" },
      { text: "How well organized was the session?", type: "star_1_5", category: "Facilities" },
      { text: "How likely are you to recommend this program to others?", type: "nps_0_10", category: null, required: true },
      { text: "How easy was it to sign up and take part in this session?", type: "ces_1_5", category: "Facilities" },
      { text: "Did this session meet your expectations?", type: "yes_no", category: "Communication" },
      {
        text: "Which program track was this?",
        type: "dropdown",
        category: null,
        options: ["Women's Economic Empowerment", "Peacebuilding & Conflict Resolution"],
      },
      { text: "Any suggestions for how we can improve?", type: "open_text", category: null },
    ],
  },
];

const POSITIVE_COMMENTS = [
  "Great experience overall, will be back!",
  "Staff went above and beyond, really appreciated it.",
  "Quick and easy, no complaints at all.",
  "Everything was clean and well organized.",
  "Really happy with the service today.",
];
const NEUTRAL_COMMENTS = [
  "It was fine, nothing special.",
  "Average experience, could be better.",
  "Wait time was a bit long but staff were nice.",
];
const NEGATIVE_COMMENTS = [
  "The staff was extremely rude and dismissive, I won't be coming back.",
  "Waited over 40 minutes with no explanation, completely unacceptable.",
  "The place was dirty and disorganized, very disappointed.",
  "No one seemed to know what they were doing, terrible experience.",
  "I was overcharged and no one would help me fix it.",
];

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDERS = ["Male", "Female", "Prefer not to say"];

function answerValueFor(question: IQuestion, mood: "bad" | "neutral" | "good"): unknown {
  switch (question.type) {
    case "star_1_5":
      return mood === "bad" ? pick([1, 2]) : mood === "neutral" ? 3 : pick([4, 5]);
    case "nps_0_10":
      return mood === "bad" ? randomInt(0, 4) : mood === "neutral" ? randomInt(5, 6) : randomInt(7, 10);
    case "ces_1_5":
      // Inverted scale — 1 is low effort (good), 5 is high effort (bad).
      return mood === "bad" ? pick([4, 5]) : mood === "neutral" ? 3 : pick([1, 2]);
    case "emoji_scale":
      return mood === "bad" ? pick([1, 2]) : mood === "neutral" ? 3 : pick([4, 5]);
    case "slider":
      return mood === "bad" ? randomInt(5, 35) : mood === "neutral" ? randomInt(36, 60) : randomInt(61, 100);
    case "yes_no":
      return mood === "bad" ? pick(["no", "no", "yes"]) : "yes";
    case "dropdown":
    case "multiple_choice":
      return question.options.length ? pick(question.options) : "";
    case "multi_select":
      return question.options.length ? pickSome(question.options, randomInt(1, Math.min(3, question.options.length))) : [];
    case "open_text":
      if (mood === "bad") return pick(NEGATIVE_COMMENTS);
      if (mood === "neutral") return Math.random() < 0.5 ? pick(NEUTRAL_COMMENTS) : "";
      return Math.random() < 0.5 ? pick(POSITIVE_COMMENTS) : "";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared category/question infrastructure — Colleague Experience
// ---------------------------------------------------------------------------

const CE_CATEGORY_NAMES = [
  "Management Support",
  "Growth Opportunities",
  "Work-Life Balance",
  "Team Culture",
  "Compensation Fairness",
] as const;
type CeCategoryName = (typeof CE_CATEGORY_NAMES)[number];
const CE_THEMES_BY_CATEGORY: Record<CeCategoryName, string[]> = {
  "Management Support": ["manager support", "leadership"],
  "Growth Opportunities": ["career growth", "training"],
  "Work-Life Balance": ["work-life balance", "scheduling"],
  "Team Culture": ["team culture", "morale"],
  "Compensation Fairness": ["pay", "compensation"],
};
const CE_POSITIVE_COMMENTS = [
  "My manager has been really supportive this quarter.",
  "I feel like I'm actually growing in this role.",
  "Great team, genuinely enjoy coming to work.",
  "Appreciate the flexibility around scheduling.",
];
const CE_NEUTRAL_COMMENTS = ["It's fine, nothing's changed much.", "Some weeks are better than others."];
const CE_NEGATIVE_COMMENTS = [
  "I've asked for feedback from my manager multiple times and never get it.",
  "There's no clear path for growth here, I feel stuck.",
  "Burnt out — the schedule keeps changing at the last minute.",
  "Pay hasn't kept up with what the role actually requires now.",
];

function ceAnswerValueFor(question: IQuestion, mood: "bad" | "neutral" | "good"): unknown {
  switch (question.type) {
    case "star_1_5":
      return mood === "bad" ? pick([1, 2]) : mood === "neutral" ? 3 : pick([4, 5]);
    case "nps_0_10":
      return mood === "bad" ? randomInt(0, 4) : mood === "neutral" ? randomInt(5, 6) : randomInt(7, 10);
    case "ces_1_5":
      // Inverted scale — 1 is low effort (good), 5 is high effort (bad).
      return mood === "bad" ? pick([4, 5]) : mood === "neutral" ? 3 : pick([1, 2]);
    case "yes_no":
      return mood === "bad" ? pick(["no", "no", "yes"]) : "yes";
    case "dropdown":
      return question.options.length ? pick(question.options) : "";
    case "open_text":
      if (mood === "bad") return pick(CE_NEGATIVE_COMMENTS);
      if (mood === "neutral") return Math.random() < 0.5 ? pick(CE_NEUTRAL_COMMENTS) : "";
      return Math.random() < 0.5 ? pick(CE_POSITIVE_COMMENTS) : "";
    default:
      return null;
  }
}

function deriveCeSentimentAndThemes(
  mood: "bad" | "neutral" | "good",
  categoryName: CeCategoryName | null,
  hasComment: boolean
): { sentiment: "positive" | "neutral" | "negative" | null; themes: string[] } {
  if (!hasComment) return { sentiment: null, themes: [] };
  const sentiment = mood === "bad" ? "negative" : mood === "good" ? "positive" : "neutral";
  const pool = categoryName ? CE_THEMES_BY_CATEGORY[categoryName] : null;
  const themes = pool && Math.random() < 0.85 ? pickSome(pool, randomInt(1, pool.length)) : [];
  return { sentiment, themes };
}

const CE_QUESTIONS: QuestionDef[] = [
  { text: "How supported do you feel by your manager?", type: "star_1_5", category: "Management Support" as unknown as CategoryName, required: true, isCsatQuestion: true },
  { text: "How would you rate your work-life balance right now?", type: "star_1_5", category: "Work-Life Balance" as unknown as CategoryName },
  { text: "How satisfied are you with growth opportunities here?", type: "star_1_5", category: "Growth Opportunities" as unknown as CategoryName },
  { text: "How likely are you to recommend this as a great place to work?", type: "nps_0_10", category: null, required: true },
  { text: "How easy is it to get the support you need from HR or management?", type: "ces_1_5", category: "Management Support" as unknown as CategoryName },
  { text: "Do you feel fairly compensated for your role?", type: "yes_no", category: "Compensation Fairness" as unknown as CategoryName },
  { text: "Which best describes your team?", type: "dropdown", category: null, options: ["Frontline", "Support", "Management", "Remote"] },
  { text: "Anything else you'd like to share?", type: "open_text", category: null },
];

// ---------------------------------------------------------------------------
// Low-score events + result shape
// ---------------------------------------------------------------------------

interface LowScoreEvent {
  businessId: Types.ObjectId;
  parentOrgId: Types.ObjectId | null;
  responseId: Types.ObjectId;
  submittedAt: Date;
  categoryId: Types.ObjectId | null;
  starValue: number;
  comment: string | null;
}

export interface ShowcaseSeedResult {
  parentOrgs: number;
  businesses: number;
  users: number;
  feedbackPoints: number;
  responses: number;
  alertRules: number;
  alertActivity: number;
  actionBoardItems: number;
  actionItemComments: number;
  decisionLogEntries: number;
  improvementInitiatives: number;
  recurringIssueFlags: number;
  playbooks: number;
  categoryOwnerMappings: number;
  billingSubscriptions: number;
  invoices: number;
  feedbackPointRequests: number;
  demoRequests: number;
  aiInsightReports: number;
  cxGoals: number;
  playbookRuns: number;
  auditLogEntries: number;
  supportTickets: number;
  events: number;
  closingLoopUpdates: number;
  rosterEntries: number;
}

interface ProductFeedbackInfo {
  product: Product;
  feedbackPoint: InstanceType<typeof FeedbackPoint>;
  categoryNameById: Map<string, string>;
  lowScoreEvents: LowScoreEvent[];
  alertRule: InstanceType<typeof AlertRule>;
}

interface BuiltBusiness {
  business: InstanceType<typeof Business>;
  ownerUser: InstanceType<typeof User>;
  teamFull: InstanceType<typeof User>;
  teamLimited: InstanceType<typeof User>;
  byProduct: Map<Product, ProductFeedbackInfo>;
}

/**
 * Idempotent-ish: re-running clears out prior showcase-tagged data first
 * (matched by the fixed business/org names below) so repeat clicks don't
 * pile up duplicates, then rebuilds everything fresh. Never sends a real
 * email — accounts are created directly with an active login instead of
 * going through the invite-email flow, and no alert/notification email
 * helper is called anywhere in this file.
 */
export async function seedShowcaseData(adminUserId?: Types.ObjectId): Promise<ShowcaseSeedResult> {
  const result: ShowcaseSeedResult = {
    parentOrgs: 0,
    businesses: 0,
    users: 0,
    feedbackPoints: 0,
    responses: 0,
    alertRules: 0,
    alertActivity: 0,
    actionBoardItems: 0,
    actionItemComments: 0,
    decisionLogEntries: 0,
    improvementInitiatives: 0,
    recurringIssueFlags: 0,
    playbooks: 0,
    categoryOwnerMappings: 0,
    billingSubscriptions: 0,
    invoices: 0,
    feedbackPointRequests: 0,
    demoRequests: 0,
    aiInsightReports: 0,
    cxGoals: 0,
    playbookRuns: 0,
    auditLogEntries: 0,
    supportTickets: 0,
    events: 0,
    closingLoopUpdates: 0,
    rosterEntries: 0,
  };

  // 1. Categories (CX + CE) and industries, upserted by name.
  const categoryByName = new Map<CategoryName, Types.ObjectId>();
  for (const name of CATEGORY_NAMES) {
    const cat = await Category.findOneAndUpdate({ name }, { $setOnInsert: { name } }, { upsert: true, new: true });
    categoryByName.set(name, cat._id);
  }
  const categoryNameByIdCx = new Map<string, CategoryName>();
  for (const [name, id] of categoryByName) categoryNameByIdCx.set(id.toString(), name);

  const ceCategoryByName = new Map<CeCategoryName, Types.ObjectId>();
  for (const name of CE_CATEGORY_NAMES) {
    const cat = await Category.findOneAndUpdate(
      { name, product: "colleague_experience" },
      { $setOnInsert: { name, product: "colleague_experience" } },
      { upsert: true, new: true }
    );
    ceCategoryByName.set(name, cat._id);
  }
  const categoryNameByIdCe = new Map<string, CeCategoryName>();
  for (const [name, id] of ceCategoryByName) categoryNameByIdCe.set(id.toString(), name);

  for (const name of new Set(SECTORS.map((s) => s.industry))) {
    await Industry.findOneAndUpdate({ name }, { $setOnInsert: { name, usedByCount: 0 } }, { upsert: true });
  }
  await Industry.findOneAndUpdate(
    { name: "Telecommunications" },
    { $setOnInsert: { name: "Telecommunications", usedByCount: 0 } },
    { upsert: true }
  );
  await Industry.findOneAndUpdate({ name: "Aviation" }, { $setOnInsert: { name: "Aviation", usedByCount: 0 } }, { upsert: true });

  // 2. One QuestionTemplate per CX sector, plus the single shared CE template.
  const templateBySector = new Map<string, InstanceType<typeof QuestionTemplate>>();
  for (const sector of SECTORS) {
    const questions: IQuestion[] = sector.questions.map((q) => ({
      text: q.text,
      type: q.type,
      categoryId: q.category ? categoryByName.get(q.category)! : null,
      required: q.required ?? false,
      options: q.options ?? [],
      isCsatQuestion: q.isCsatQuestion ?? false,
    }));
    const template = await QuestionTemplate.findOneAndUpdate(
      { name: sector.templateName },
      { $set: { name: sector.templateName, suggestedIndustries: [sector.industry], questions } },
      { upsert: true, new: true }
    );
    templateBySector.set(sector.key, template);
  }
  const ceTemplate = await QuestionTemplate.findOneAndUpdate(
    { name: "Colleague Pulse Survey" },
    {
      $set: {
        name: "Colleague Pulse Survey",
        product: "colleague_experience",
        suggestedIndustries: [],
        questions: CE_QUESTIONS.map((q) => ({
          text: q.text,
          type: q.type,
          categoryId: q.category ? ceCategoryByName.get(q.category as unknown as CeCategoryName)! : null,
          required: q.required ?? false,
          options: q.options ?? [],
          isCsatQuestion: q.isCsatQuestion ?? false,
        })),
      },
    },
    { upsert: true, new: true }
  );

  // 3. Generic response generator — shared by every feedback point, CX or CE.
  async function generateResponses(params: {
    feedbackPoint: InstanceType<typeof FeedbackPoint>;
    businessId: Types.ObjectId;
    parentOrgId: Types.ObjectId | null;
    questions: IQuestion[];
    product: Product;
    count: number;
    dayWindow: number;
  }): Promise<LowScoreEvent[]> {
    const answerFn = params.product === "colleague_experience" ? ceAnswerValueFor : answerValueFor;
    const sentimentFn = params.product === "colleague_experience" ? deriveCeSentimentAndThemes : deriveSentimentAndThemes;
    const categoryNameById = params.product === "colleague_experience" ? categoryNameByIdCe : categoryNameByIdCx;
    const lowScoreEvents: LowScoreEvent[] = [];

    // Extra, history-spanning responses (demo volume). Never for event-linked
    // points (training sessions have their own dated window), and they never
    // feed the low-score case list below, so cases/alerts stay as before.
    const HISTORY_DAYS = historyDays();
    const extraCount = HISTORY_DAYS > 0 && !params.feedbackPoint.eventId ? Math.round(params.count * (responseScale() - 1)) : 0;

    for (let i = 0; i < params.count + extraCount; i++) {
      const isExtra = i >= params.count;
      let ageDays = randomInt(0, params.dayWindow);
      let badShare = 0.16;
      if (isExtra) {
        // 30% land in the last 60 days so the latest week is never empty;
        // the rest spread over the full history with a gentle improvement trend.
        ageDays = Math.random() < 0.3 ? randomInt(0, 60) : randomInt(0, HISTORY_DAYS);
        badShare = 0.12 + 0.16 * (ageDays / HISTORY_DAYS);
      }
      const roll = Math.random();
      const mood: "bad" | "neutral" | "good" = roll < badShare ? "bad" : roll < badShare + 0.16 ? "neutral" : "good";
      const submittedAt = daysAgo(ageDays);

      let lowestStarCategoryId: Types.ObjectId | null = null;
      let lowestStarValue = 5;
      let openTextComment: string | null = null;

      const answers = params.questions.map((question) => {
        const value = answerFn(question, mood);
        if (question.type === "star_1_5" && typeof value === "number" && value < lowestStarValue) {
          lowestStarValue = value;
          lowestStarCategoryId = question.categoryId;
        }
        if (question.type === "open_text" && typeof value === "string" && value) {
          openTextComment = value;
        }
        return { questionId: question._id!, type: question.type, value, categoryId: question.categoryId };
      });

      const themeCategoryName = lowestStarCategoryId === null ? null : categoryNameById.get(String(lowestStarCategoryId)) ?? null;
      const { sentiment, themes } = sentimentFn(mood, themeCategoryName as never, !!openTextComment);

      const response = await FeedbackResponse.create({
        feedbackPointId: params.feedbackPoint._id,
        businessId: params.businessId,
        product: params.product,
        eventId: params.feedbackPoint.eventId ?? null,
        answers,
        respondentName: Math.random() < 0.35 ? pick(["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie"]) : null,
        respondentEmail: Math.random() < 0.22 ? `respondent${randomInt(1000, 9999)}@example.test` : null,
        respondentPhone: null,
        demographics: Math.random() < 0.5 ? { ageGroup: pick(AGE_GROUPS), gender: pick(GENDERS) } : { ageGroup: "", gender: "" },
        submittedAt,
        deviceType: pick(["mobile", "mobile", "mobile", "desktop", "tablet"] as const),
        flagged: false,
        sentiment,
        themes,
        sentimentAnalyzedAt: sentiment ? submittedAt : null,
      });
      result.responses++;

      if (!isExtra && mood === "bad" && lowestStarValue <= 2) {
        lowScoreEvents.push({
          businessId: params.businessId,
          parentOrgId: params.parentOrgId,
          responseId: response._id,
          submittedAt,
          categoryId: lowestStarCategoryId,
          starValue: lowestStarValue,
          comment: openTextComment,
        });
      }
    }
    return lowScoreEvents;
  }

  // 4. Support tickets — every business/org gets a few, spanning open/in
  // progress/resolved, so the Admin Support Queue and every owner's own
  // Support page always show real history.
  async function addSupportTickets(params: {
    ownerType: "business" | "parentOrg";
    ownerId: Types.ObjectId;
    ownerName: string;
    submitter: InstanceType<typeof User>;
  }) {
    const tickets: { category: SupportTicketCategory; subject: string; body: string; status: SupportTicketStatus; daysAgoCreated: number }[] = [
      {
        category: "billing",
        subject: "Question about our next invoice",
        body: "Can someone confirm whether our current plan includes the extra feedback points we added last month?",
        status: "resolved",
        daysAgoCreated: 21,
      },
      {
        category: "bug",
        subject: "QR code not loading on one feedback point",
        body: "One of our feedback point QR codes is showing a blank page on mobile Safari — works fine on desktop.",
        status: "in_progress",
        daysAgoCreated: 4,
      },
      {
        category: "access",
        subject: "New team member needs access",
        body: "We hired someone new and need them added as a full-access team member — can you point me to where to do this?",
        status: "open",
        daysAgoCreated: 1,
      },
      {
        category: "other",
        subject: "Can we get a walkthrough of the reporting export?",
        body: "Would love a quick pointer on how to pull a CSV export for our board meeting next week.",
        status: "resolved",
        daysAgoCreated: 35,
      },
    ];
    for (const t of tickets) {
      const exists = await SupportTicket.findOne({ ownerType: params.ownerType, ownerId: params.ownerId, subject: t.subject });
      if (exists) continue;
      const createdAt = daysAgo(t.daysAgoCreated);
      await SupportTicket.create({
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        ownerName: params.ownerName,
        submittedByUserId: params.submitter._id,
        submittedByEmail: params.submitter.email,
        category: t.category,
        subject: t.subject,
        body: t.body,
        status: t.status,
        adminNote: t.status === "resolved" ? "Confirmed and closed out." : "",
        resolvedAt: t.status === "resolved" ? daysAgo(Math.max(0, t.daysAgoCreated - 2)) : null,
        createdAt,
      });
      result.supportTickets++;
    }
  }

  // 5. Business shell — owner + 2 team members (one full-tier, one
  // limited-tier; the full-tier member's `products` grant is what
  // demonstrates per-person product gating on a dual-product business).
  async function createBusinessShell(params: {
    name: string;
    industry: string;
    parentOrgId: Types.ObjectId | null;
    region: string;
    billingAssignment: "group_pays" | "branch_pays";
    slugKey: string;
    products: Product[];
    questionTemplateId: Types.ObjectId;
    opsRoleLabel: string;
    shiftRoleLabel: string;
    maxFeedbackPoints: number;
  }): Promise<Pick<BuiltBusiness, "business" | "ownerUser" | "teamFull" | "teamLimited">> {
    const contactEmail = `${params.slugKey}@${LOGIN_DOMAIN}`;
    const business = await Business.findOneAndUpdate(
      { name: params.name },
      {
        $set: {
          name: params.name,
          industry: params.industry,
          parentOrgId: params.parentOrgId,
          region: params.region,
          contactName: `${params.name} Manager`,
          contactEmail,
          contactPhone: "",
          billingAssignment: params.billingAssignment,
          plan: "business_monthly",
          maxFeedbackPoints: params.maxFeedbackPoints,
          questionTemplateId: params.questionTemplateId,
          enabledProducts: params.products,
          demographicConfig: { name: "optional", email: "optional", phone: "off", ageGroup: "optional", gender: "optional" },
          accountManagerId: adminUserId ?? null,
          active: true,
          // A branch's own escalationLevels is ignored in favor of its
          // parent org's (set on buildOrg above) — only a standalone
          // business's own chain here actually takes effect. Either way,
          // seeding a real multi-level chain means QA can exercise
          // Escalate/De-escalate instead of hitting a wall on the schema's
          // single-level default.
          ...(params.parentOrgId
            ? {}
            : {
                escalationLevels: [
                  { level: 1, label: "Owner" },
                  { level: 2, label: params.opsRoleLabel },
                ],
                escalationSlaHours: 48,
              }),
          // Business Value inputs are CX-only (a "customer at risk" concept)
          // — filled in wherever a business carries customer_experience so
          // the Business Value page never shows its empty "set these up"
          // state anywhere in the showcase.
          ...(params.products.includes("customer_experience")
            ? { businessValueInputs: { avgTransactionValue: 45, visitsPerYear: 12, acquisitionCost: 120, atRiskStarThreshold: 2, currencySymbol: "$" } }
            : {}),
        },
      },
      { upsert: true, new: true }
    );

    const ownerUser = await upsertActiveUser({ email: contactEmail, accountType: "business", parentId: business._id, lastLoginDaysAgo: randomInt(0, 5) });
    result.users++;
    const teamFull = await upsertActiveUser({
      email: `${params.slugKey}.ops@${LOGIN_DOMAIN}`,
      accountType: "team_member",
      parentId: business._id,
      teamRole: params.opsRoleLabel,
      tier: "full",
      teamOfType: "business",
      products: params.products.length > 1 ? params.products : null,
      lastLoginDaysAgo: randomInt(1, 10),
    });
    result.users++;
    const teamLimited = await upsertActiveUser({
      email: `${params.slugKey}.shift@${LOGIN_DOMAIN}`,
      accountType: "team_member",
      parentId: business._id,
      teamRole: params.shiftRoleLabel,
      tier: "limited",
      teamOfType: "business",
      lastLoginDaysAgo: randomInt(1, 15),
    });
    result.users++;

    await FeedbackPoint.deleteMany({ businessId: business._id });
    result.businesses++;
    return { business, ownerUser, teamFull, teamLimited };
  }

  async function attachCxFeedback(
    business: InstanceType<typeof Business>,
    sectorKey: string,
    pointName: string,
    count: number,
    dayWindow: number,
    parentOrgId: Types.ObjectId | null,
    recipientEmail: string
  ): Promise<ProductFeedbackInfo> {
    const template = templateBySector.get(sectorKey)!;
    const feedbackPoint = await FeedbackPoint.create({
      businessId: business._id,
      product: "customer_experience",
      name: pointName,
      description: `Feedback point at ${business.name} — ${pointName}`,
      qrToken: randomBytes(16).toString("hex"),
      scans: count + randomInt(15, 80),
      active: true,
    });
    result.feedbackPoints++;
    const lowScoreEvents = await generateResponses({
      feedbackPoint,
      businessId: business._id,
      parentOrgId,
      questions: template.questions,
      product: "customer_experience",
      count,
      dayWindow,
    });
    const alertRule = await AlertRule.findOneAndUpdate(
      { scope: "business", ownerId: business._id, ruleType: "fixed_threshold", metric: "star_average" },
      { $set: { threshold: 3, product: "customer_experience", recipients: [recipientEmail], active: true } },
      { upsert: true, new: true }
    );
    result.alertRules++;
    return { product: "customer_experience", feedbackPoint, categoryNameById: categoryNameByIdCx as Map<string, string>, lowScoreEvents, alertRule };
  }

  async function attachCeFeedback(
    business: InstanceType<typeof Business>,
    pointName: string,
    count: number,
    dayWindow: number,
    parentOrgId: Types.ObjectId | null,
    recipientEmail: string
  ): Promise<ProductFeedbackInfo> {
    const feedbackPoint = await FeedbackPoint.create({
      businessId: business._id,
      product: "colleague_experience",
      questionTemplateOverride: ceTemplate._id,
      name: pointName,
      description: `Colleague pulse survey at ${business.name}`,
      qrToken: randomBytes(16).toString("hex"),
      distributionMode: "qr_open",
      scans: count + randomInt(10, 40),
      active: true,
    });
    result.feedbackPoints++;
    const lowScoreEvents = await generateResponses({
      feedbackPoint,
      businessId: business._id,
      parentOrgId,
      questions: ceTemplate.questions,
      product: "colleague_experience",
      count,
      dayWindow,
    });
    const alertRule = await AlertRule.findOneAndUpdate(
      { scope: "business", ownerId: business._id, ruleType: "fixed_threshold", metric: "nps" },
      { $set: { threshold: 20, product: "colleague_experience", recipients: [recipientEmail], active: true } },
      { upsert: true, new: true }
    );
    result.alertRules++;
    return { product: "colleague_experience", feedbackPoint, categoryNameById: categoryNameByIdCe as Map<string, string>, lowScoreEvents, alertRule };
  }

  // 6. Baseline case generation from a business's own low-score events — a
  // handful of ActionBoardItems spanning open/in_progress/resolved, with a
  // comment trail on the ones still being worked, plus the AlertActivity
  // each event fired. Applied to every business/product so Case Management
  // and Alerts never show an empty state anywhere in the showcase.
  async function spawnCasesFromLowScoreEvents(
    business: InstanceType<typeof Business>,
    info: ProductFeedbackInfo,
    parentOrgId: Types.ObjectId | null,
    ownerCandidates: InstanceType<typeof User>[],
    maxCases: number
  ): Promise<InstanceType<typeof ActionBoardItem>[]> {
    const created: InstanceType<typeof ActionBoardItem>[] = [];
    const sample = pickSome(info.lowScoreEvents, Math.min(maxCases, info.lowScoreEvents.length));
    for (const event of sample) {
      await AlertActivity.create({ alertRuleId: info.alertRule._id, businessId: business._id, triggeredAt: event.submittedAt, snapshotValue: event.starValue });
      result.alertActivity++;

      const categoryLabel = event.categoryId ? info.categoryNameById.get(event.categoryId.toString()) ?? "Service" : "Service";
      const status = pick(["open", "in_progress", "resolved"] as const);
      const ownerId = ownerCandidates.length ? pick(ownerCandidates)._id : null;
      // A slice of still-open cases are pre-escalated to level 2 so QA can
      // exercise De-escalate immediately, without having to escalate one
      // first — every org/standalone business now has a real level-2+
      // chain configured (see buildOrg/createBusinessShell above).
      const preEscalated = status !== "resolved" && Math.random() < 0.25;
      const item = await ActionBoardItem.create({
        parentOrgId,
        businessId: business._id,
        product: info.product,
        title: `${categoryLabel} concern reported at ${business.name}`,
        description: event.comment ? `Respondent comment: "${event.comment}"` : `A ${event.starValue}-star rating was logged for ${categoryLabel.toLowerCase()}.`,
        categoryId: event.categoryId,
        priority: event.starValue <= 1 ? "high" : preEscalated ? "high" : "medium",
        status,
        ownerId,
        dueDate: status === "resolved" ? null : daysAgo(-randomInt(2, 10)),
        sourceResponseIds: [event.responseId],
        resolutionNote:
          status === "resolved"
            ? pick([
                "Spoke with the team involved and reinforced our standards during the next shift huddle.",
                "Reached out directly and resolved the concern; also flagged the issue internally.",
                "Root cause identified and corrected — added a checklist step to prevent recurrence.",
              ])
            : "",
        resolvedAt: status === "resolved" ? daysAgo(randomInt(0, 5)) : null,
        source: ownerId ? "auto_assigned" : "auto_suggested",
        createdAt: event.submittedAt,
        currentEscalationLevel: preEscalated ? 2 : 1,
        escalationHistory: preEscalated
          ? [
              {
                level: 1,
                userId: ownerId,
                action: "escalated" as const,
                note: "Escalating — this needs a second set of eyes before it goes any further.",
                at: daysAgo(randomInt(0, 3)),
              },
            ]
          : [],
      });
      result.actionBoardItems++;
      await autoAttachPlaybook(item);
      created.push(item);

      if (status !== "resolved" && ownerCandidates.length) {
        const first = pick(ownerCandidates);
        const second = pick(ownerCandidates);
        await ActionItemComment.create({
          actionItemId: item._id,
          authorId: first._id,
          authorLabel: first.email,
          body: "Looking into this now — following up with the team involved.",
          createdAt: daysAgo(Math.max(0, randomInt(0, 3))),
        });
        await ActionItemComment.create({
          actionItemId: item._id,
          authorId: second._id,
          authorLabel: second.email,
          body: status === "in_progress" ? "Update: spoke with the team, working on a resolution." : "Noted, will keep an eye on this one.",
          createdAt: daysAgo(Math.max(0, randomInt(0, 2))),
        });
        result.actionItemComments += 2;
      }
    }
    return created;
  }

  // 7. CX Goal — one per top-level owner (org or standalone), mixed statuses.
  async function addGoal(params: {
    ownerType: "parentOrg" | "business";
    ownerId: Types.ObjectId;
    label: string;
    metric: CxGoalMetric;
    categoryId?: Types.ObjectId | null;
    startValue: number | null;
    targetValue: number;
    targetDate: Date;
    status: CxGoalStatus;
    createdBy: Types.ObjectId | null;
    product?: Product;
  }) {
    await CxGoal.findOneAndUpdate(
      { ownerType: params.ownerType, ownerId: params.ownerId, label: params.label },
      {
        $set: {
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          product: params.product ?? "customer_experience",
          label: params.label,
          metric: params.metric,
          categoryId: params.categoryId ?? null,
          startValue: params.startValue,
          targetValue: params.targetValue,
          targetDate: params.targetDate,
          status: params.status,
          createdBy: params.createdBy,
        },
      },
      { upsert: true }
    );
    result.cxGoals++;
  }

  // 8. Full case-journey narrative: a run of realistic comments in one
  // category becomes 3-4 ActionBoardItems, a RecurringIssueFlag, an
  // ImprovementInitiative, and (when `measured` is set) a DecisionLogEntry
  // with a real before/after outcome — the "walk a reviewer through one
  // complete case" thread for each of the seven organizations.
  async function buildCaseNarrative(params: {
    parentOrgId: Types.ObjectId | null;
    flagScope: "business" | "parentOrg";
    flagScopeId: Types.ObjectId;
    businessIds: Types.ObjectId[];
    businessNameFor: (businessId: Types.ObjectId) => string;
    product: Product;
    categoryId: Types.ObjectId;
    categoryLabel: string;
    comments: { businessId: Types.ObjectId; text: string; daysAgoCreated: number }[];
    initiativeTitle: string;
    initiativeDescription: string;
    initiativeOwnerId: Types.ObjectId;
    flagStatus: RecurringFlagStatus;
    measured: { before: number; after: number } | null;
  }) {
    // Re-running the showcase seed (the Admin "Seed showcase data" dev
    // tool doesn't wipe first — see wipeAllTenantData for that) must not
    // pile up a second copy of this narrative's cases/initiative/flag/
    // decision-log-entry every time it's clicked. Categories/businesses/
    // orgs above are upserted by name so they're already safe; this is the
    // one spot that used unconditional .create() calls, which is what
    // QA's duplicate-RecurringIssueFlag and duplicate-Improvement-
    // Initiative reports were actually seeing. One flag per
    // (ownerScope, ownerScopeId, categoryId) uniquely identifies "this
    // narrative already ran" — if it's there, load its cases back and
    // hand them to the caller instead of creating anything new.
    const existingFlag = await RecurringIssueFlag.findOne({
      ownerScope: params.flagScope,
      ownerScopeId: params.flagScopeId,
      categoryId: params.categoryId,
    });
    if (existingFlag) {
      return ActionBoardItem.find({ _id: { $in: existingFlag.caseIds } }).sort({ createdAt: 1 });
    }

    const cases: InstanceType<typeof ActionBoardItem>[] = [];
    for (const c of params.comments) {
      const resolved = params.measured !== null || params.flagStatus !== "active";
      const item = await ActionBoardItem.create({
        parentOrgId: params.parentOrgId,
        businessId: c.businessId,
        product: params.product,
        title: `${params.categoryLabel} concern reported at ${params.businessNameFor(c.businessId)}`,
        description: `Respondent comment: "${c.text}"`,
        categoryId: params.categoryId,
        priority: "medium",
        status: resolved ? "resolved" : "open",
        ownerId: null,
        dueDate: resolved ? null : daysAgo(-randomInt(2, 8)),
        sourceResponseIds: [],
        resolutionNote: resolved ? "Logged as part of a broader pattern — see the linked initiative." : "",
        resolvedAt: resolved ? daysAgo(Math.max(0, c.daysAgoCreated - randomInt(1, 4))) : null,
        source: "auto_suggested",
        createdAt: daysAgo(c.daysAgoCreated),
      });
      result.actionBoardItems++;
      cases.push(item);
    }

    const businessIdsInvolved = Array.from(new Set(params.comments.map((c) => c.businessId.toString()))).map((s) => new Types.ObjectId(s));
    const initiative = await ImprovementInitiative.create({
      parentOrgId: params.parentOrgId,
      businessId: params.parentOrgId ? null : params.businessIds[0],
      product: params.product,
      title: params.initiativeTitle,
      description: params.initiativeDescription,
      ownerId: params.initiativeOwnerId,
      affectedBusinessIds: businessIdsInvolved,
      linkedActionIds: cases.map((c) => c._id),
      status: params.measured ? "completed" : params.flagStatus === "dismissed" ? "planned" : "in_progress",
      baselineMetricDescription: `Average ${params.categoryLabel} rating`,
      baselineValue: params.measured ? params.measured.before : null,
      targetValue: params.measured ? params.measured.after + 0.2 : 4.2,
      startedAt: params.flagStatus === "dismissed" ? null : daysAgo(Math.min(...params.comments.map((c) => c.daysAgoCreated))),
      completedAt: params.measured ? daysAgo(2) : null,
      // Backdated the same way ActionBoardItem.create() above is (QA Major
      // #6a) — Mongoose otherwise defaults this to "now" on insert, which
      // meant a freshly-reseeded "planned" initiative could never be older
      // than attentionCentre.ts's 14-day INITIATIVE_STALL_DAYS threshold and
      // so could never actually surface an initiative_not_started item.
      createdAt: daysAgo(Math.max(...params.comments.map((c) => c.daysAgoCreated))),
    });
    result.improvementInitiatives++;

    await RecurringIssueFlag.create({
      ownerScope: params.flagScope,
      ownerScopeId: params.flagScopeId,
      categoryId: params.categoryId,
      caseIds: cases.map((c) => c._id),
      businessIds: businessIdsInvolved,
      count: cases.length,
      windowDays: 30,
      firstCaseAt: daysAgo(Math.max(...params.comments.map((c) => c.daysAgoCreated))),
      lastCaseAt: daysAgo(Math.min(...params.comments.map((c) => c.daysAgoCreated))),
      status: params.flagStatus,
      convertedInitiativeId: params.flagStatus === "converted" ? initiative._id : null,
      dismissedAt: params.flagStatus === "dismissed" ? daysAgo(2) : null,
    });
    result.recurringIssueFlags++;

    if (params.measured) {
      await DecisionLogEntry.create({
        parentOrgId: params.parentOrgId,
        businessId: params.parentOrgId ? null : params.businessIds[0],
        product: params.product,
        title: initiative.title,
        trigger: `${cases.length} ${params.categoryLabel} complaints surfaced via the Recurring Issues flag.`,
        linkedActionIds: cases.map((c) => c._id),
        affectedBusinessIds: businessIdsInvolved,
        ownerId: params.initiativeOwnerId,
        implementationDate: daysAgo(Math.min(...params.comments.map((c) => c.daysAgoCreated))),
        status: "implemented",
        outcomeMetricDescription: `Average ${params.categoryLabel} rating`,
        outcomeMetric: "categoryAverage",
        outcomeCategoryId: params.categoryId,
        outcomeBefore: params.measured.before,
        outcomeAfter: params.measured.after,
        outcomeMeasuredAt: daysAgo(1),
      });
      result.decisionLogEntries++;
    }

    return cases;
  }

  // 9. Playbook tied to a category, plus a linked PlaybookRun on a real case.
  async function addPlaybookWithRun(params: {
    parentOrgId: Types.ObjectId | null;
    businessId: Types.ObjectId | null;
    title: string;
    categoryId: Types.ObjectId;
    trigger: string;
    steps: string[];
    escalationContactId: Types.ObjectId | null;
    run: {
      ownerType: "business" | "parentOrg";
      ownerId: Types.ObjectId;
      actionBoardItem: InstanceType<typeof ActionBoardItem>;
      status: "active" | "completed" | "abandoned";
      startedAt: Date;
      completedAt: Date | null;
      completedStepIndexes: number[];
    };
  }) {
    const playbook = await Playbook.findOneAndUpdate(
      { title: params.title },
      {
        $set: {
          parentOrgId: params.parentOrgId,
          businessId: params.businessId,
          title: params.title,
          categoryId: params.categoryId,
          triggerCondition: params.trigger,
          steps: params.steps,
          escalationContactId: params.escalationContactId,
        },
      },
      { upsert: true, new: true }
    );
    result.playbooks++;

    const isNewRun = !(await PlaybookRun.exists({ playbookId: playbook._id, actionBoardItemId: params.run.actionBoardItem._id }));
    await PlaybookRun.findOneAndUpdate(
      { playbookId: playbook._id, actionBoardItemId: params.run.actionBoardItem._id },
      {
        $set: {
          ownerType: params.run.ownerType,
          ownerId: params.run.ownerId,
          actionBoardItemId: params.run.actionBoardItem._id,
          attachReason: `Auto-attached — this is the standard playbook for ${params.title.split(" ")[0]} cases.`,
          steps: playbook.steps,
          completedStepIndexes: params.run.completedStepIndexes,
          status: params.run.status,
          startedAt: params.run.startedAt,
          completedAt: params.run.completedAt,
        },
      },
      { upsert: true, new: true }
    );
    if (isNewRun) {
      result.playbookRuns++;
      if (params.run.status === "completed") {
        await Playbook.updateOne({ _id: playbook._id }, { $inc: { usageCount: 1 } });
      }
    }
    return playbook;
  }

  // 10. Billing — active/overdue mix across organizations.
  async function addSubscription(params: {
    ownerType: "business" | "parentOrg";
    ownerId: Types.ObjectId;
    plan: string;
    mrrValue: number;
    status: "active" | "overdue";
    paidInvoices: number;
    failedInvoice?: boolean;
  }) {
    const sub = await BillingSubscription.findOneAndUpdate(
      { ownerType: params.ownerType, ownerId: params.ownerId },
      {
        $set: {
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          plan: params.plan,
          isComp: false,
          mrrValue: params.mrrValue,
          nextPaymentDate: daysAgo(-randomInt(5, 25)),
          status: params.status,
          paymentMethodLast4: "4242",
        },
      },
      { upsert: true, new: true }
    );
    result.billingSubscriptions++;

    for (let i = 0; i < params.paidInvoices; i++) {
      await Invoice.findOneAndUpdate(
        { subscriptionId: sub._id, stripeInvoiceId: `seed-${sub._id}-paid-${i}` },
        {
          $set: {
            ownerType: params.ownerType,
            ownerId: params.ownerId,
            amount: params.mrrValue,
            currency: "usd",
            status: "paid",
            paymentMethodLast4: "4242",
            issuedAt: daysAgo(30 * (i + 1)),
          },
        },
        { upsert: true }
      );
      result.invoices++;
    }
    if (params.failedInvoice) {
      await Invoice.findOneAndUpdate(
        { subscriptionId: sub._id, stripeInvoiceId: `seed-${sub._id}-failed` },
        {
          $set: {
            ownerType: params.ownerType,
            ownerId: params.ownerId,
            amount: params.mrrValue,
            currency: "usd",
            status: "failed",
            paymentMethodLast4: "4242",
            issuedAt: daysAgo(3),
          },
        },
        { upsert: true }
      );
      result.invoices++;
    }
  }

  async function mapCategory(
    scope: "business" | "parentOrg",
    scopeId: Types.ObjectId,
    categoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    repeat?: { thresholdCount: number; windowDays: number }
  ) {
    await CategoryOwnerMapping.findOneAndUpdate(
      { ownerScope: scope, ownerScopeId: scopeId, categoryId },
      { $set: { defaultOwnerId: ownerId, repeatThresholdCount: repeat?.thresholdCount ?? null, repeatWindowDays: repeat?.windowDays ?? null } },
      { upsert: true }
    );
    result.categoryOwnerMappings++;
  }

  // ---------------------------------------------------------------------
  // Organizations
  // ---------------------------------------------------------------------

  interface OrgResult {
    org: InstanceType<typeof ParentOrganization>;
    orgOwner: InstanceType<typeof User>;
    opsLead: InstanceType<typeof User>;
    secondLead: InstanceType<typeof User>;
    branches: BuiltBusiness[];
  }

  async function buildOrg(params: {
    key: string;
    name: string;
    industry: string;
    products: Product[];
    branches: { name: string; region: string; billing?: "group_pays" | "branch_pays" }[];
    cxSectorKey?: string;
    cxPointName?: string;
    cePointName: string;
    cxCountRange: [number, number];
    ceCountRange: [number, number];
    opsRoleLabel: string;
    shiftRoleLabel: string;
    secondLeadRoleLabel: string;
  }): Promise<OrgResult> {
    const contactEmail = `${params.key}@${LOGIN_DOMAIN}`;
    const org = await ParentOrganization.findOneAndUpdate(
      { name: params.name },
      {
        $set: {
          name: params.name,
          contactName: `${params.name} HQ`,
          contactEmail,
          contactPhone: "",
          defaultBillingMode: "group_pays",
          enabledProducts: params.products,
          accountManagerId: adminUserId ?? null,
          // A real multi-level chain (not just the schema default single
          // "Owner" level) so QA can actually exercise Escalate/De-escalate
          // instead of hitting the "nothing configured" wall on every case.
          escalationLevels: [
            { level: 1, label: "Owner" },
            { level: 2, label: params.opsRoleLabel },
            { level: 3, label: "Executive" },
          ],
          escalationSlaHours: 48,
        },
      },
      { upsert: true, new: true }
    );
    result.parentOrgs++;

    const orgOwner = await upsertActiveUser({ email: contactEmail, accountType: "parent_org", parentId: org._id, lastLoginDaysAgo: randomInt(0, 4) });
    result.users++;
    const opsLead = await upsertActiveUser({
      email: `${params.key}.ops@${LOGIN_DOMAIN}`,
      accountType: "team_member",
      parentId: org._id,
      teamRole: params.opsRoleLabel,
      tier: "full",
      teamOfType: "parentOrg",
      products: params.products.length > 1 ? params.products : null,
      lastLoginDaysAgo: randomInt(1, 8),
    });
    result.users++;
    const secondLead = await upsertActiveUser({
      email: `${params.key}.lead@${LOGIN_DOMAIN}`,
      accountType: "team_member",
      parentId: org._id,
      teamRole: params.secondLeadRoleLabel,
      tier: "full",
      teamOfType: "parentOrg",
      products: params.products.length > 1 ? params.products : null,
      lastLoginDaysAgo: randomInt(1, 8),
    });
    result.users++;

    const questionTemplateId = params.cxSectorKey ? templateBySector.get(params.cxSectorKey)!._id : ceTemplate._id;
    const branches: BuiltBusiness[] = [];
    for (const branchDef of params.branches) {
      const shell = await createBusinessShell({
        name: branchDef.name,
        industry: params.industry,
        parentOrgId: org._id,
        region: branchDef.region,
        billingAssignment: branchDef.billing ?? "group_pays",
        slugKey: `${params.key}.${shortBranchKey(branchDef.name, params.name)}`,
        products: params.products,
        questionTemplateId,
        opsRoleLabel: params.opsRoleLabel,
        shiftRoleLabel: params.shiftRoleLabel,
        maxFeedbackPoints: 3,
      });
      const byProduct = new Map<Product, ProductFeedbackInfo>();
      if (params.products.includes("customer_experience") && params.cxSectorKey) {
        byProduct.set(
          "customer_experience",
          await attachCxFeedback(
            shell.business,
            params.cxSectorKey,
            params.cxPointName ?? "Front Desk",
            randomInt(...params.cxCountRange),
            59,
            org._id,
            shell.ownerUser.email
          )
        );
      }
      if (params.products.includes("colleague_experience")) {
        byProduct.set(
          "colleague_experience",
          await attachCeFeedback(shell.business, params.cePointName, randomInt(...params.ceCountRange), 59, org._id, shell.ownerUser.email)
        );
      }
      branches.push({ ...shell, byProduct });
    }

    return { org, orgOwner, opsLead, secondLead, branches };
  }

  // --- 1. Meridian Bank Group — Bank, multiple branches, CX + CE ---
  const meridian = await buildOrg({
    key: "meridian",
    name: "Meridian Bank Group",
    industry: "Banking",
    products: ["customer_experience", "colleague_experience"],
    branches: [
      { name: "Meridian Bank – Downtown", region: "Central" },
      { name: "Meridian Bank – Uptown", region: "Central" },
      { name: "Meridian Bank – Airport Road", region: "South" },
      { name: "Meridian Bank – Riverside", region: "West", billing: "branch_pays" },
      { name: "Meridian Bank – Lakeview", region: "North" },
      { name: "Meridian Bank – Harbor Point", region: "East" },
      { name: "Meridian Bank – Greenfield", region: "South" },
      { name: "Meridian Bank – Old Town", region: "West" },
    ],
    cxSectorKey: "banking",
    cxPointName: "Branch Front Desk",
    cePointName: "Team Pulse",
    cxCountRange: [24, 36],
    ceCountRange: [18, 28],
    opsRoleLabel: "Branch Operations Manager",
    shiftRoleLabel: "Teller Lead",
    secondLeadRoleLabel: "Customer Experience Lead",
  });

  // --- 2. Skyline Telecom — Telecom, multiple branches, CE only ---
  const skyline = await buildOrg({
    key: "skyline",
    name: "Skyline Telecom",
    industry: "Telecommunications",
    products: ["colleague_experience"],
    branches: [
      { name: "Skyline Telecom – Northgate Store", region: "North" },
      { name: "Skyline Telecom – Eastside Store", region: "East", billing: "branch_pays" },
      { name: "Skyline Telecom – Downtown Service Center", region: "Central" },
    ],
    cePointName: "Team Pulse",
    cxCountRange: [0, 0],
    ceCountRange: [22, 34],
    opsRoleLabel: "Store Operations Manager",
    shiftRoleLabel: "Retail Shift Lead",
    secondLeadRoleLabel: "People Experience Lead",
  });

  // --- 3. Horizon Schools Trust — Trust of 10 schools, CX only ---
  const horizon = await buildOrg({
    key: "horizon",
    name: "Horizon Schools Trust",
    industry: "Education",
    products: ["customer_experience"],
    branches: [
      { name: "Horizon North Primary", region: "North" },
      { name: "Horizon North Secondary", region: "North" },
      { name: "Horizon East Primary", region: "East" },
      { name: "Horizon East Secondary", region: "East" },
      { name: "Horizon South Primary", region: "South" },
      { name: "Horizon South Secondary", region: "South" },
      { name: "Horizon West Primary", region: "West" },
      { name: "Horizon West Secondary", region: "West" },
      { name: "Horizon STEM Academy", region: "Central", billing: "branch_pays" },
      { name: "Horizon Arts Academy", region: "Central", billing: "branch_pays" },
    ],
    cxSectorKey: "education",
    cxPointName: "Front Office",
    cePointName: "Team Pulse",
    cxCountRange: [16, 26],
    ceCountRange: [0, 0],
    opsRoleLabel: "Campus Operations Manager",
    shiftRoleLabel: "Front Office Lead",
    secondLeadRoleLabel: "Family Engagement Lead",
  });

  // --- 4. Aurora Airlines — Airline, multiple hubs, CE only ---
  const aurora = await buildOrg({
    key: "aurora",
    name: "Aurora Airlines",
    industry: "Aviation",
    products: ["colleague_experience"],
    branches: [
      { name: "Aurora Airlines – JFK Hub", region: "Northeast" },
      { name: "Aurora Airlines – LAX Hub", region: "West" },
      { name: "Aurora Airlines – ORD Hub", region: "Midwest" },
    ],
    cePointName: "Crew Pulse",
    cxCountRange: [0, 0],
    ceCountRange: [20, 30],
    opsRoleLabel: "Hub Operations Manager",
    shiftRoleLabel: "Crew Scheduling Lead",
    secondLeadRoleLabel: "People Experience Lead",
  });

  // --- 5. St. Augustine Health Network — Hospital, multiple branches, CX + CE ---
  const stAugustine = await buildOrg({
    key: "staugustine",
    name: "St. Augustine Health Network",
    industry: "Healthcare",
    products: ["customer_experience", "colleague_experience"],
    branches: [
      { name: "St. Augustine Downtown Medical Center", region: "Central" },
      { name: "St. Augustine North Clinic", region: "North" },
      { name: "St. Augustine Women's Health Pavilion", region: "Central", billing: "branch_pays" },
    ],
    cxSectorKey: "hospital",
    cxPointName: "Patient Check-in",
    cePointName: "Staff Pulse",
    cxCountRange: [22, 34],
    ceCountRange: [16, 26],
    opsRoleLabel: "Clinical Operations Manager",
    shiftRoleLabel: "Charge Nurse",
    secondLeadRoleLabel: "Patient Experience Lead",
  });

  // --- 5b. Precision Diagnostics Network — medical diagnostic chain (labs, collection
  // centres, imaging), multiple branches, CX + CE ---
  const precision = await buildOrg({
    key: "precision",
    name: "Precision Diagnostics Network",
    industry: "Healthcare",
    products: ["customer_experience", "colleague_experience"],
    branches: [
      { name: "Precision Diagnostics – Main Lab", region: "Central" },
      { name: "Precision Diagnostics – Westside Collection Centre", region: "West" },
      { name: "Precision Diagnostics – Eastgate Imaging Centre", region: "East" },
      { name: "Precision Diagnostics – Northfield Lab", region: "North" },
      { name: "Precision Diagnostics – Harbor Collection Point", region: "South", billing: "branch_pays" },
      { name: "Precision Diagnostics – Airport Road Lab", region: "South" },
    ],
    cxSectorKey: "diagnostics",
    cxPointName: "Sample Collection Desk",
    cePointName: "Lab Team Pulse",
    cxCountRange: [26, 40],
    ceCountRange: [16, 26],
    opsRoleLabel: "Lab Operations Manager",
    shiftRoleLabel: "Senior Technologist",
    secondLeadRoleLabel: "Patient Experience Lead",
  });

  // ---------------------------------------------------------------------
  // Standalone businesses
  // ---------------------------------------------------------------------

  // --- 6. The Olive Table — Restaurant, standalone, CX only ---
  const oliveShell = await createBusinessShell({
    name: "The Olive Table",
    industry: "Restaurant",
    parentOrgId: null,
    region: "",
    billingAssignment: "branch_pays",
    slugKey: "olive",
    products: ["customer_experience"],
    questionTemplateId: templateBySector.get("restaurant")!._id,
    opsRoleLabel: "General Manager",
    shiftRoleLabel: "Floor Lead",
    maxFeedbackPoints: 3,
  });
  const oliveCx = await attachCxFeedback(oliveShell.business, "restaurant", "Table Service", 34, 59, null, oliveShell.ownerUser.email);
  const olive: BuiltBusiness = { ...oliveShell, byProduct: new Map([["customer_experience", oliveCx]]) };
  await addSupportTickets({ ownerType: "business", ownerId: olive.business._id, ownerName: olive.business.name, submitter: olive.ownerUser });
  await addSubscription({ ownerType: "business", ownerId: olive.business._id, plan: "business_monthly", mrrValue: 89, status: "active", paidInvoices: 3 });
  await addGoal({
    ownerType: "business",
    ownerId: olive.business._id,
    label: "Raise NPS above 50",
    metric: "nps",
    startValue: 36,
    targetValue: 50,
    targetDate: daysAgo(-40),
    status: "active",
    createdBy: olive.ownerUser._id,
  });

  // --- 7. Amani Women's Empowerment & Peacebuilding Institute — Non-Profit,
  // standalone, events-based (training sessions, not a fixed location), CX only ---
  const amaniEmail = `amani@${LOGIN_DOMAIN}`;
  const amaniBusiness = await Business.findOneAndUpdate(
    { name: "Amani Women's Empowerment & Peacebuilding Institute" },
    {
      $set: {
        name: "Amani Women's Empowerment & Peacebuilding Institute",
        industry: "Community Development & Training",
        parentOrgId: null,
        region: "",
        contactName: "Amani Institute Program Lead",
        contactEmail: amaniEmail,
        contactPhone: "",
        billingAssignment: "branch_pays",
        plan: "business_monthly",
        maxFeedbackPoints: 10,
        questionTemplateId: templateBySector.get("training")!._id,
        enabledProducts: ["customer_experience"],
        demographicConfig: { name: "optional", email: "off", phone: "off", ageGroup: "optional", gender: "off" },
        accountManagerId: adminUserId ?? null,
        active: true,
        businessValueInputs: { avgTransactionValue: 180, visitsPerYear: 1, acquisitionCost: 300, atRiskStarThreshold: 2, currencySymbol: "$" },
      },
    },
    { upsert: true, new: true }
  );
  const amaniOwner = await upsertActiveUser({ email: amaniEmail, accountType: "business", parentId: amaniBusiness._id, lastLoginDaysAgo: 1 });
  result.users++;
  const amaniOps = await upsertActiveUser({
    email: `amani.ops@${LOGIN_DOMAIN}`,
    accountType: "team_member",
    parentId: amaniBusiness._id,
    teamRole: "Program Coordinator",
    tier: "full",
    teamOfType: "business",
    lastLoginDaysAgo: 2,
  });
  result.users++;
  result.businesses++;

  // Programmes, QR codes, links, objective-tied questions and responses (see amaniPrograms.ts).
  const amaniPrograms = await seedAmaniPrograms({ businessId: amaniBusiness._id, categoryByName });
  result.events += amaniPrograms.eventIds.length;
  result.feedbackPoints += amaniPrograms.qrPoints.length + amaniPrograms.followUpPoints;
  const amaniLowScoreEvents: LowScoreEvent[] = amaniPrograms.lowScoreEvents;
  const amaniFeedbackPoints = amaniPrograms.qrPoints;
  const amaniAlertRule = await AlertRule.findOneAndUpdate(
    { scope: "business", ownerId: amaniBusiness._id, ruleType: "fixed_threshold", metric: "star_average" },
    { $set: { threshold: 3.5, product: "customer_experience", recipients: [amaniOwner.email], active: true } },
    { upsert: true, new: true }
  );
  result.alertRules++;
  const amaniInfo: ProductFeedbackInfo = {
    product: "customer_experience",
    feedbackPoint: amaniFeedbackPoints[0],
    categoryNameById: categoryNameByIdCx as Map<string, string>,
    lowScoreEvents: amaniLowScoreEvents,
    alertRule: amaniAlertRule,
  };
  const amani: BuiltBusiness = {
    business: amaniBusiness,
    ownerUser: amaniOwner,
    teamFull: amaniOps,
    teamLimited: amaniOps,
    byProduct: new Map([["customer_experience", amaniInfo]]),
  };
  await spawnCasesFromLowScoreEvents(amaniBusiness, amaniInfo, null, [amaniOwner, amaniOps], 2);
  await addSupportTickets({ ownerType: "business", ownerId: amaniBusiness._id, ownerName: amaniBusiness.name, submitter: amaniOwner });
  await addSubscription({ ownerType: "business", ownerId: amaniBusiness._id, plan: "business_monthly", mrrValue: 129, status: "active", paidInvoices: 2 });
  await addGoal({
    ownerType: "business",
    ownerId: amaniBusiness._id,
    label: "Reach 4.5 average session rating",
    metric: "starAverage",
    startValue: 4.0,
    targetValue: 4.5,
    targetDate: daysAgo(-50),
    status: "active",
    createdBy: amaniOwner._id,
  });

  // ---------------------------------------------------------------------
  // Baseline cases + support tickets across every org branch
  // ---------------------------------------------------------------------

  const allOrgs: OrgResult[] = [meridian, skyline, horizon, aurora, stAugustine, precision];
  for (const org of allOrgs) {
    for (const b of org.branches) {
      for (const [, info] of b.byProduct) {
        await spawnCasesFromLowScoreEvents(b.business, info, org.org._id, [b.ownerUser, b.teamFull], 2);
      }
      await addSupportTickets({ ownerType: "business", ownerId: b.business._id, ownerName: b.business.name, submitter: b.ownerUser });
    }
    await addSupportTickets({ ownerType: "parentOrg", ownerId: org.org._id, ownerName: org.org.name, submitter: org.opsLead });
  }

  // ---------------------------------------------------------------------
  // Category owner mappings
  // ---------------------------------------------------------------------

  await mapCategory("parentOrg", meridian.org._id, categoryByName.get("Staff Friendliness")!, meridian.opsLead._id, { thresholdCount: 4, windowDays: 30 });
  await mapCategory("parentOrg", meridian.org._id, categoryByName.get("Communication")!, meridian.secondLead._id);
  await mapCategory("parentOrg", meridian.org._id, ceCategoryByName.get("Compensation Fairness")!, meridian.opsLead._id, { thresholdCount: 3, windowDays: 30 });
  await mapCategory("parentOrg", skyline.org._id, ceCategoryByName.get("Management Support")!, skyline.opsLead._id, { thresholdCount: 3, windowDays: 30 });
  await mapCategory("parentOrg", horizon.org._id, categoryByName.get("Facilities")!, horizon.opsLead._id);
  await mapCategory("parentOrg", aurora.org._id, ceCategoryByName.get("Work-Life Balance")!, aurora.opsLead._id, { thresholdCount: 3, windowDays: 21 });
  await mapCategory("parentOrg", stAugustine.org._id, categoryByName.get("Service Speed")!, stAugustine.opsLead._id, { thresholdCount: 4, windowDays: 30 });
  await mapCategory("parentOrg", stAugustine.org._id, ceCategoryByName.get("Growth Opportunities")!, stAugustine.opsLead._id, { thresholdCount: 3, windowDays: 30 });
  await mapCategory("parentOrg", precision.org._id, categoryByName.get("Service Speed")!, precision.opsLead._id, { thresholdCount: 4, windowDays: 30 });
  await mapCategory("parentOrg", precision.org._id, ceCategoryByName.get("Management Support")!, precision.opsLead._id, { thresholdCount: 3, windowDays: 30 });
  await mapCategory("business", olive.business._id, categoryByName.get("Product Quality")!, olive.teamFull._id, { thresholdCount: 3, windowDays: 14 });

  // ---------------------------------------------------------------------
  // Full case-journey narratives — one per organization/standalone
  // ---------------------------------------------------------------------

  const meridianDowntown = meridian.branches.find((b) => b.business.name === "Meridian Bank – Downtown")!;
  const meridianUptown = meridian.branches.find((b) => b.business.name === "Meridian Bank – Uptown")!;
  const staffFriendlinessId = categoryByName.get("Staff Friendliness")!;
  const nameByBusinessId = new Map<string, string>();
  for (const org of allOrgs) for (const b of org.branches) nameByBusinessId.set(b.business._id.toString(), b.business.name);
  nameByBusinessId.set(olive.business._id.toString(), olive.business.name);
  nameByBusinessId.set(amani.business._id.toString(), amani.business.name);

  const meridianCases = await buildCaseNarrative({
    parentOrgId: meridian.org._id,
    flagScope: "parentOrg",
    flagScopeId: meridian.org._id,
    businessIds: [meridianDowntown.business._id, meridianUptown.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the branch",
    product: "customer_experience",
    categoryId: staffFriendlinessId,
    categoryLabel: "Staff Friendliness",
    comments: [
      { businessId: meridianDowntown.business._id, text: "The teller was short with me and seemed rushed the whole time.", daysAgoCreated: 18 },
      { businessId: meridianDowntown.business._id, text: "Staff barely acknowledged me at the counter.", daysAgoCreated: 12 },
      { businessId: meridianUptown.business._id, text: "Not the friendliest visit — felt like an inconvenience to the staff.", daysAgoCreated: 9 },
      { businessId: meridianUptown.business._id, text: "Teller was curt and didn't explain the fee.", daysAgoCreated: 4 },
    ],
    initiativeTitle: "Retrain frontline staff on greeting & tone standards",
    initiativeDescription:
      "Staff Friendliness complaints surfaced at both Downtown and Uptown within the same month — this initiative retrains tellers at both branches on the greeting standard and adds a mystery-shopper check.",
    initiativeOwnerId: meridian.opsLead._id,
    flagStatus: "active",
    measured: null,
  });
  const meridianPlaybook = await addPlaybookWithRun({
    parentOrgId: meridian.org._id,
    businessId: null,
    title: "Staff Friendliness Recovery",
    categoryId: staffFriendlinessId,
    trigger: "3+ low friendliness ratings in 2 weeks at one branch",
    steps: [
      "Branch manager reviews the flagged responses within 24 hours",
      "One-on-one coaching session with the staff member involved",
      "Follow up with the customer if contact info was left",
      "Re-check the branch's friendliness score after 2 weeks",
    ],
    escalationContactId: meridian.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: meridian.org._id,
      actionBoardItem: meridianCases[meridianCases.length - 1],
      status: "active",
      startedAt: daysAgo(4),
      completedAt: null,
      completedStepIndexes: [0, 1],
    },
  });

  const meridianCompensationId = ceCategoryByName.get("Compensation Fairness")!;
  const meridianCeCases = await buildCaseNarrative({
    parentOrgId: meridian.org._id,
    flagScope: "parentOrg",
    flagScopeId: meridian.org._id,
    businessIds: [meridianDowntown.business._id, meridianUptown.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the branch",
    product: "colleague_experience",
    categoryId: meridianCompensationId,
    categoryLabel: "Compensation Fairness",
    comments: [
      { businessId: meridianDowntown.business._id, text: "Pay hasn't kept up with what the role actually requires now.", daysAgoCreated: 40 },
      { businessId: meridianDowntown.business._id, text: "Found out tellers at other branches start higher for the same job.", daysAgoCreated: 32 },
      { businessId: meridianUptown.business._id, text: "Raises haven't matched inflation the last two years.", daysAgoCreated: 21 },
      { businessId: meridianUptown.business._id, text: "Feels like new hires are coming in at the same rate as people with years here.", daysAgoCreated: 10 },
    ],
    initiativeTitle: "Benchmark teller pay against comparable branches",
    initiativeDescription:
      "Compensation Fairness complaints surfaced at both Downtown and Uptown — this initiative benchmarks teller pay bands against comparable branches and corrects any gaps found.",
    initiativeOwnerId: meridian.opsLead._id,
    flagStatus: "converted",
    measured: { before: 2.8, after: 3.6 },
  });
  await addPlaybookWithRun({
    parentOrgId: meridian.org._id,
    businessId: null,
    title: "Compensation Fairness Review",
    categoryId: meridianCompensationId,
    trigger: "Compensation Fairness ratings drop below target at a branch",
    steps: [
      "People Ops pulls current pay bands for the flagged branch",
      "Compare against comparable branches in the same region",
      "Submit any correction for approval",
      "Re-check the branch's Compensation Fairness score after the next cycle",
    ],
    escalationContactId: meridian.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: meridian.org._id,
      actionBoardItem: meridianCeCases[meridianCeCases.length - 1],
      status: "completed",
      startedAt: daysAgo(30),
      completedAt: daysAgo(3),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  const skylineCases = await buildCaseNarrative({
    parentOrgId: skyline.org._id,
    flagScope: "parentOrg",
    flagScopeId: skyline.org._id,
    businessIds: skyline.branches.map((b) => b.business._id),
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the store",
    product: "colleague_experience",
    categoryId: ceCategoryByName.get("Management Support")!,
    categoryLabel: "Management Support",
    comments: [
      { businessId: skyline.branches[0].business._id, text: "I've asked for feedback from my manager multiple times and never get it.", daysAgoCreated: 20 },
      { businessId: skyline.branches[0].business._id, text: "Management doesn't seem to notice when we're understaffed.", daysAgoCreated: 13 },
      { businessId: skyline.branches[1].business._id, text: "Never get a straight answer about scheduling from my manager.", daysAgoCreated: 6 },
    ],
    initiativeTitle: "Roll out structured 1:1 cadence for store managers",
    initiativeDescription: "Management Support scores dipped at two stores — this initiative introduces a required biweekly 1:1 cadence with a shared agenda template.",
    initiativeOwnerId: skyline.opsLead._id,
    flagStatus: "active",
    measured: null,
  });
  await addPlaybookWithRun({
    parentOrgId: skyline.org._id,
    businessId: null,
    title: "Manager Support Check-in",
    categoryId: ceCategoryByName.get("Management Support")!,
    trigger: "2+ low Management Support ratings in a month at one store",
    steps: [
      "People Ops reviews the flagged pulse responses",
      "Manager has a private 1:1 with the team to understand specifics",
      "Agree concrete follow-ups and a re-check date",
      "Re-check the store's Management Support score after 4 weeks",
    ],
    escalationContactId: skyline.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: skyline.org._id,
      actionBoardItem: skylineCases[skylineCases.length - 1],
      status: "active",
      startedAt: daysAgo(6),
      completedAt: null,
      completedStepIndexes: [0],
    },
  });

  const horizonSTEM = horizon.branches.find((b) => b.business.name === "Horizon STEM Academy")!;
  const horizonArts = horizon.branches.find((b) => b.business.name === "Horizon Arts Academy")!;
  const facilitiesId = categoryByName.get("Facilities")!;
  const horizonCases = await buildCaseNarrative({
    parentOrgId: horizon.org._id,
    flagScope: "parentOrg",
    flagScopeId: horizon.org._id,
    businessIds: [horizonSTEM.business._id, horizonArts.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the campus",
    product: "customer_experience",
    categoryId: facilitiesId,
    categoryLabel: "Facilities",
    comments: [
      { businessId: horizonSTEM.business._id, text: "The lab equipment in the STEM room looks outdated and some stations don't work.", daysAgoCreated: 55 },
      { businessId: horizonSTEM.business._id, text: "Classroom felt cramped for the number of students.", daysAgoCreated: 47 },
      { businessId: horizonArts.business._id, text: "The art studio needs better ventilation, it gets stuffy fast.", daysAgoCreated: 40 },
      { businessId: horizonArts.business._id, text: "Would love updated supplies in the studio.", daysAgoCreated: 33 },
    ],
    initiativeTitle: "Facilities refresh for STEM and Arts academies",
    initiativeDescription: "Facilities complaints converged on the two specialty academies — this initiative funds a lab/studio refresh at both campuses.",
    initiativeOwnerId: horizon.opsLead._id,
    flagStatus: "converted",
    measured: { before: 3.1, after: 4.2 },
  });
  await addPlaybookWithRun({
    parentOrgId: horizon.org._id,
    businessId: null,
    title: "Facilities Escalation",
    categoryId: facilitiesId,
    trigger: "Repeated facilities complaints at a specialty campus within a term",
    steps: [
      "Campus operations manager inspects and photographs the reported area",
      "Submit a maintenance/refresh request with priority level",
      "Notify families if the fix affects a shared space",
      "Re-check the campus's Facilities score after the next survey cycle",
    ],
    escalationContactId: horizon.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: horizon.org._id,
      actionBoardItem: horizonCases[horizonCases.length - 1],
      status: "completed",
      startedAt: daysAgo(30),
      completedAt: daysAgo(3),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  const auroraJfk = aurora.branches.find((b) => b.business.name === "Aurora Airlines – JFK Hub")!;
  const workLifeId = ceCategoryByName.get("Work-Life Balance")!;
  const auroraCases = await buildCaseNarrative({
    parentOrgId: aurora.org._id,
    flagScope: "business",
    flagScopeId: auroraJfk.business._id,
    businessIds: [auroraJfk.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the hub",
    product: "colleague_experience",
    categoryId: workLifeId,
    categoryLabel: "Work-Life Balance",
    comments: [
      { businessId: auroraJfk.business._id, text: "Burnt out — the schedule keeps changing at the last minute.", daysAgoCreated: 45 },
      { businessId: auroraJfk.business._id, text: "Crew rest periods keep getting cut short between rotations.", daysAgoCreated: 38 },
      { businessId: auroraJfk.business._id, text: "Hard to plan anything outside work with how late the roster comes out.", daysAgoCreated: 30 },
    ],
    initiativeTitle: "Publish crew rosters two weeks in advance",
    initiativeDescription: "Work-Life Balance complaints at JFK repeatedly cited late roster publication — this initiative moves roster publication to 14 days out and adds a minimum-rest buffer.",
    initiativeOwnerId: aurora.opsLead._id,
    flagStatus: "converted",
    measured: { before: 2.9, after: 4.1 },
  });
  await addPlaybookWithRun({
    parentOrgId: aurora.org._id,
    businessId: null,
    title: "Work-Life Balance Recovery",
    categoryId: workLifeId,
    trigger: "Work-Life Balance ratings drop below target at a hub",
    steps: [
      "Hub operations manager reviews recent roster publication timing",
      "Confirm minimum-rest buffers were honored for the flagged period",
      "Publish next roster at least 14 days in advance",
      "Re-check the hub's Work-Life Balance score after 4 weeks",
    ],
    escalationContactId: aurora.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: aurora.org._id,
      actionBoardItem: auroraCases[auroraCases.length - 1],
      status: "completed",
      startedAt: daysAgo(30),
      completedAt: daysAgo(2),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  const stAugustineDowntown = stAugustine.branches.find((b) => b.business.name === "St. Augustine Downtown Medical Center")!;
  const serviceSpeedId = categoryByName.get("Service Speed")!;
  const stAugustineCases = await buildCaseNarrative({
    parentOrgId: stAugustine.org._id,
    flagScope: "business",
    flagScopeId: stAugustineDowntown.business._id,
    businessIds: [stAugustineDowntown.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the clinic",
    product: "customer_experience",
    categoryId: serviceSpeedId,
    categoryLabel: "Service Speed",
    comments: [
      { businessId: stAugustineDowntown.business._id, text: "Waited almost two hours past my appointment time with no update.", daysAgoCreated: 42 },
      { businessId: stAugustineDowntown.business._id, text: "Check-in line was extremely slow this morning.", daysAgoCreated: 35 },
      { businessId: stAugustineDowntown.business._id, text: "Nobody told us how much longer the wait would be.", daysAgoCreated: 26 },
      { businessId: stAugustineDowntown.business._id, text: "Appointment ran over an hour late again.", daysAgoCreated: 15 },
    ],
    initiativeTitle: "Add real-time wait tracker at Downtown check-in",
    initiativeDescription: "Wait-time complaints kept recurring at Downtown — this initiative adds a real-time wait tracker at check-in and a text alert when a patient's room is ready.",
    initiativeOwnerId: stAugustine.opsLead._id,
    flagStatus: "converted",
    measured: { before: 3.0, after: 4.3 },
  });
  await addPlaybookWithRun({
    parentOrgId: stAugustine.org._id,
    businessId: null,
    title: "Wait Time Recovery",
    categoryId: serviceSpeedId,
    trigger: "Service Speed average dips below target at a facility",
    steps: [
      "Clinical operations manager reviews staffing for the flagged time slot",
      "Confirm the real-time wait tracker is active and visible at check-in",
      "Adjust scheduling or add float staff for peak hours",
      "Re-check the facility's Service Speed score after 2 weeks",
    ],
    escalationContactId: stAugustine.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: stAugustine.org._id,
      actionBoardItem: stAugustineCases[stAugustineCases.length - 1],
      status: "completed",
      startedAt: daysAgo(30),
      completedAt: daysAgo(1),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  const stAugustineGrowthId = ceCategoryByName.get("Growth Opportunities")!;
  const stAugustineCeCases = await buildCaseNarrative({
    parentOrgId: stAugustine.org._id,
    flagScope: "parentOrg",
    flagScopeId: stAugustine.org._id,
    businessIds: [stAugustineDowntown.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the clinic",
    product: "colleague_experience",
    categoryId: stAugustineGrowthId,
    categoryLabel: "Growth Opportunities",
    comments: [
      { businessId: stAugustineDowntown.business._id, text: "There's no clear path for growth here, I feel stuck.", daysAgoCreated: 36 },
      { businessId: stAugustineDowntown.business._id, text: "Nobody's talked to me about advancement since I started.", daysAgoCreated: 27 },
      { businessId: stAugustineDowntown.business._id, text: "Would love more training opportunities instead of just more shifts.", daysAgoCreated: 14 },
    ],
    initiativeTitle: "Launch a clinical career-ladder program at Downtown",
    initiativeDescription:
      "Growth Opportunities complaints kept surfacing at Downtown — this initiative introduces a documented career-ladder path with quarterly advancement check-ins.",
    initiativeOwnerId: stAugustine.opsLead._id,
    flagStatus: "converted",
    measured: { before: 2.9, after: 3.8 },
  });
  await addPlaybookWithRun({
    parentOrgId: stAugustine.org._id,
    businessId: null,
    title: "Growth Opportunities Check-in",
    categoryId: stAugustineGrowthId,
    trigger: "Growth Opportunities ratings drop below target at a facility",
    steps: [
      "People Ops reviews the flagged pulse responses",
      "Manager schedules a career-path conversation with the affected staff",
      "Document agreed next steps and training plan",
      "Re-check the facility's Growth Opportunities score after the next quarter",
    ],
    escalationContactId: stAugustine.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: stAugustine.org._id,
      actionBoardItem: stAugustineCeCases[stAugustineCeCases.length - 1],
      status: "completed",
      startedAt: daysAgo(30),
      completedAt: daysAgo(2),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  const precisionMain = precision.branches.find((b) => b.business.name === "Precision Diagnostics – Main Lab")!;
  const precisionManagementId = ceCategoryByName.get("Management Support")!;
  const precisionCases = await buildCaseNarrative({
    parentOrgId: precision.org._id,
    flagScope: "business",
    flagScopeId: precisionMain.business._id,
    businessIds: [precisionMain.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the lab",
    product: "customer_experience",
    categoryId: serviceSpeedId,
    categoryLabel: "Service Speed",
    comments: [
      { businessId: precisionMain.business._id, text: "Waited over an hour for a simple blood draw.", daysAgoCreated: 40 },
      { businessId: precisionMain.business._id, text: "My report was promised in 24 hours and took three days.", daysAgoCreated: 33 },
      { businessId: precisionMain.business._id, text: "No one told us the scan was running late.", daysAgoCreated: 24 },
      { businessId: precisionMain.business._id, text: "Queue at the collection desk went out the door at 8am.", daysAgoCreated: 12 },
    ],
    initiativeTitle: "Online slot booking and SMS report alerts",
    initiativeDescription: "Collection-desk queues and late reports kept recurring at the Main Lab. This initiative adds timed slot booking and an SMS when a report is ready.",
    initiativeOwnerId: precision.opsLead._id,
    flagStatus: "converted",
    measured: { before: 3.1, after: 4.2 },
  });
  await addPlaybookWithRun({
    parentOrgId: precision.org._id,
    businessId: null,
    title: "Report Turnaround Recovery",
    categoryId: serviceSpeedId,
    trigger: "Service Speed or report turnaround falls below target at a lab",
    steps: [
      "Lab operations manager reviews the day's sample volume against technologist cover",
      "Confirm every delayed report has a promised time shared with the patient",
      "Add a float technologist or extend collection hours at peak",
      "Re-check the lab's Service Speed score after two weeks",
    ],
    escalationContactId: precision.opsLead._id,
    run: {
      ownerType: "parentOrg",
      ownerId: precision.org._id,
      actionBoardItem: precisionCases[precisionCases.length - 1],
      status: "completed",
      startedAt: daysAgo(28),
      completedAt: daysAgo(2),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });
  const precisionCeCases = await buildCaseNarrative({
    parentOrgId: precision.org._id,
    flagScope: "parentOrg",
    flagScopeId: precision.org._id,
    businessIds: [precisionMain.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the lab",
    product: "colleague_experience",
    categoryId: precisionManagementId,
    categoryLabel: "Management Support",
    comments: [
      { businessId: precisionMain.business._id, text: "Night-shift technologists have nobody senior to call when equipment fails.", daysAgoCreated: 34 },
      { businessId: precisionMain.business._id, text: "Our supervisor is rarely on the floor during peak hours.", daysAgoCreated: 25 },
      { businessId: precisionMain.business._id, text: "Escalations about analyser downtime go unanswered for days.", daysAgoCreated: 13 },
    ],
    initiativeTitle: "Named on-call supervisor for every shift",
    initiativeDescription: "Management Support complaints at the Main Lab cited no senior contact on nights. This initiative publishes a named on-call supervisor for every shift.",
    initiativeOwnerId: precision.opsLead._id,
    flagStatus: "converted",
    measured: { before: 2.8, after: 3.9 },
  });
  void precisionCeCases;

  const oliveProductQualityId = categoryByName.get("Product Quality")!;
  const oliveCases = await buildCaseNarrative({
    parentOrgId: null,
    flagScope: "business",
    flagScopeId: olive.business._id,
    businessIds: [olive.business._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the restaurant",
    product: "customer_experience",
    categoryId: oliveProductQualityId,
    categoryLabel: "Product Quality",
    comments: [
      { businessId: olive.business._id, text: "My pasta was lukewarm today.", daysAgoCreated: 12 },
      { businessId: olive.business._id, text: "Bread was a bit stale.", daysAgoCreated: 9 },
      { businessId: olive.business._id, text: "Dish tasted different than usual, seasoning was off.", daysAgoCreated: 6 },
    ],
    initiativeTitle: "Kitchen consistency review",
    initiativeDescription: "A short run of Product Quality complaints prompted a kitchen review; found to be a one-off staffing gap rather than a systemic issue.",
    initiativeOwnerId: olive.teamFull._id,
    flagStatus: "dismissed",
    measured: null,
  });
  const foodQualityPlaybook = await addPlaybookWithRun({
    parentOrgId: null,
    businessId: olive.business._id,
    title: "Food Quality Escalation",
    categoryId: oliveProductQualityId,
    trigger: "Any single rating of 1-2 stars on food quality",
    steps: [
      "Kitchen lead reviews the order and ticket from that time",
      "Offer the customer a replacement or refund if contactable",
      "Log the root cause (ingredient, prep, timing) for the week's review",
    ],
    escalationContactId: olive.teamFull._id,
    run: {
      ownerType: "business",
      ownerId: olive.business._id,
      actionBoardItem: oliveCases[oliveCases.length - 1],
      status: "completed",
      startedAt: daysAgo(6),
      completedAt: daysAgo(5),
      completedStepIndexes: [0, 1, 2],
    },
  });

  const amaniProductQualityId = categoryByName.get("Product Quality")!;
  const amaniCases = await buildCaseNarrative({
    parentOrgId: null,
    flagScope: "business",
    flagScopeId: amaniBusiness._id,
    businessIds: [amaniBusiness._id],
    businessNameFor: (id) => nameByBusinessId.get(id.toString()) ?? "the session",
    product: "customer_experience",
    categoryId: amaniProductQualityId,
    categoryLabel: "Product Quality",
    comments: [
      { businessId: amaniBusiness._id, text: "The workshop materials felt outdated compared to what was promised.", daysAgoCreated: 24 },
      { businessId: amaniBusiness._id, text: "Session ran short on time to cover everything in the agenda.", daysAgoCreated: 14 },
      { businessId: amaniBusiness._id, text: "Would have liked more practical exercises, felt lecture-heavy.", daysAgoCreated: 8 },
    ],
    initiativeTitle: "Refresh workshop curriculum and add practical exercises",
    initiativeDescription: "Repeated content feedback across two program runs led to a curriculum refresh with more hands-on exercises and updated materials.",
    initiativeOwnerId: amaniOps._id,
    flagStatus: "converted",
    measured: { before: 3.6, after: 4.4 },
  });
  await addPlaybookWithRun({
    parentOrgId: null,
    businessId: amaniBusiness._id,
    title: "Workshop Content Refresh",
    categoryId: amaniProductQualityId,
    trigger: "Repeated content-quality feedback across two runs of the same program",
    steps: [
      "Program coordinator reviews the flagged session's materials and agenda",
      "Add or update practical exercises for the affected module",
      "Brief the facilitator ahead of the next run",
      "Re-check the program's Product Quality rating after the next session",
    ],
    escalationContactId: amaniOps._id,
    run: {
      ownerType: "business",
      ownerId: amaniBusiness._id,
      actionBoardItem: amaniCases[amaniCases.length - 1],
      status: "completed",
      startedAt: daysAgo(20),
      completedAt: daysAgo(2),
      completedStepIndexes: [0, 1, 2, 3],
    },
  });

  // ---------------------------------------------------------------------
  // Billing for every organization + standalone (mix of active/overdue/comp)
  // ---------------------------------------------------------------------

  await addSubscription({ ownerType: "parentOrg", ownerId: meridian.org._id, plan: "business_monthly", mrrValue: 1199, status: "active", paidInvoices: 3 });
  await addSubscription({ ownerType: "parentOrg", ownerId: skyline.org._id, plan: "business_monthly", mrrValue: 449, status: "overdue", paidInvoices: 1, failedInvoice: true });
  await addSubscription({ ownerType: "parentOrg", ownerId: horizon.org._id, plan: "business_yearly", mrrValue: 1599, status: "active", paidInvoices: 3 });
  await addSubscription({ ownerType: "parentOrg", ownerId: aurora.org._id, plan: "business_monthly", mrrValue: 699, status: "active", paidInvoices: 2 });
  await markOwnerComp({ ownerType: "parentOrg", ownerId: stAugustine.org._id.toString(), period: "unlimited" });
  await addSubscription({ ownerType: "parentOrg", ownerId: precision.org._id, plan: "business_monthly", mrrValue: 899, status: "active", paidInvoices: 3 });
  result.billingSubscriptions++;

  const horizonStemBranch = horizon.branches.find((b) => b.business.name === "Horizon STEM Academy")!;
  await addSubscription({ ownerType: "business", ownerId: horizonStemBranch.business._id, plan: "business_monthly", mrrValue: 179, status: "active", paidInvoices: 2 });
  const horizonArtsBranch = horizon.branches.find((b) => b.business.name === "Horizon Arts Academy")!;
  await addSubscription({ ownerType: "business", ownerId: horizonArtsBranch.business._id, plan: "business_monthly", mrrValue: 149, status: "active", paidInvoices: 2 });
  const meridianRiverside = meridian.branches.find((b) => b.business.name === "Meridian Bank – Riverside")!;
  await addSubscription({ ownerType: "business", ownerId: meridianRiverside.business._id, plan: "business_monthly", mrrValue: 229, status: "active", paidInvoices: 3 });
  const skylineEastside = skyline.branches.find((b) => b.business.name === "Skyline Telecom – Eastside Store")!;
  await addSubscription({ ownerType: "business", ownerId: skylineEastside.business._id, plan: "business_monthly", mrrValue: 119, status: "overdue", paidInvoices: 1, failedInvoice: true });
  const stAugustineWomens = stAugustine.branches.find((b) => b.business.name === "St. Augustine Women's Health Pavilion")!;
  await addSubscription({ ownerType: "business", ownerId: stAugustineWomens.business._id, plan: "business_monthly", mrrValue: 259, status: "active", paidInvoices: 2 });

  // ---------------------------------------------------------------------
  // Org-level and network-wide CX Goals
  // ---------------------------------------------------------------------

  await addGoal({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    label: "Lift overall score network-wide",
    metric: "starAverage",
    startValue: 4.0,
    targetValue: 4.5,
    targetDate: daysAgo(-60),
    status: "active",
    createdBy: meridian.orgOwner._id,
  });
  await addGoal({
    ownerType: "parentOrg",
    ownerId: skyline.org._id,
    label: "Lift eNPS above +30 network-wide",
    metric: "nps",
    startValue: 8,
    targetValue: 30,
    targetDate: daysAgo(-45),
    status: "active",
    createdBy: skyline.orgOwner._id,
    product: "colleague_experience",
  });
  await addGoal({
    ownerType: "parentOrg",
    ownerId: horizon.org._id,
    label: "Improve facilities score across all campuses",
    metric: "categoryAverage",
    categoryId: facilitiesId,
    startValue: 3.3,
    targetValue: 4.2,
    targetDate: daysAgo(-30),
    status: "active",
    createdBy: horizon.orgOwner._id,
  });
  await addGoal({
    ownerType: "parentOrg",
    ownerId: aurora.org._id,
    label: "Clear the overdue action backlog network-wide",
    metric: "overdueActionsCount",
    startValue: 5,
    targetValue: 0,
    targetDate: daysAgo(8),
    status: "missed",
    createdBy: aurora.orgOwner._id,
    product: "colleague_experience",
  });
  await addGoal({
    ownerType: "parentOrg",
    ownerId: stAugustine.org._id,
    label: "Reach CX Pulse Level 3 (Improving) network-wide",
    metric: "cxPulseLevel",
    startValue: 2,
    targetValue: 3,
    targetDate: daysAgo(5),
    status: "achieved",
    createdBy: stAugustine.orgOwner._id,
  });

  await addGoal({
    ownerType: "parentOrg",
    ownerId: precision.org._id,
    label: "Get 90% of reports out on time across all labs",
    metric: "starAverage",
    startValue: 3.6,
    targetValue: 4.4,
    targetDate: daysAgo(-50),
    status: "active",
    createdBy: precision.orgOwner._id,
  });

  // ---------------------------------------------------------------------
  // Marketing/ops inbox samples
  // ---------------------------------------------------------------------

  await FeedbackPointRequest.create({
    businessId: horizonStemBranch.business._id,
    requestedByUserId: horizonStemBranch.ownerUser._id,
    note: "Could we get a second feedback point set up at our new library wing?",
    status: "pending",
  });
  result.feedbackPointRequests++;
  await FeedbackPointRequest.create({
    businessId: olive.business._id,
    requestedByUserId: olive.ownerUser._id,
    note: "We've added an outdoor patio and would like a feedback point there too.",
    status: "pending",
  });
  result.feedbackPointRequests++;

  for (const demo of [
    { name: "Priya Shah", email: "priya@example.test", company: "Northwind Credit Union", message: "Interested in a demo for our 6-branch credit union." },
    { name: "Marcus Webb", email: "marcus@example.test", company: "Webb & Co. Dental", message: "Looking to replace our paper comment cards." },
    { name: "Lena Ortiz", email: "lena@example.test", company: "Ortiz Family Diner", message: "Want to see how the QR feedback flow works." },
  ]) {
    await DemoRequest.create(demo);
    result.demoRequests++;
  }

  // ---------------------------------------------------------------------
  // CX Pulse self-assessment + recompute
  // ---------------------------------------------------------------------

  const pulseAnswerValues = [
    "Weekly, in our Monday ops review.",
    "Our regional operations lead.",
    "Added a same-day callback step for low ratings.",
    "Fairly confident.",
  ];
  await CxPulsePulseResponse.findOneAndUpdate(
    { ownerType: "parentOrg", ownerId: meridian.org._id, product: "customer_experience", quarter: currentQuarterLabel() },
    {
      $set: {
        ownerType: "parentOrg",
        ownerId: meridian.org._id,
        product: "customer_experience",
        quarter: currentQuarterLabel(),
        answers: DEFAULT_CX_PULSE_QUESTIONS.map((question, i) => ({ question, answer: pulseAnswerValues[i] ?? "" })),
      },
    },
    { upsert: true }
  );
  await CxPulsePulseResponse.findOneAndUpdate(
    { ownerType: "parentOrg", ownerId: stAugustine.org._id, product: "customer_experience", quarter: currentQuarterLabel() },
    {
      $set: {
        ownerType: "parentOrg",
        ownerId: stAugustine.org._id,
        product: "customer_experience",
        quarter: currentQuarterLabel(),
        answers: DEFAULT_CX_PULSE_QUESTIONS.map((question, i) => ({ question, answer: pulseAnswerValues[i] ?? "" })),
      },
    },
    { upsert: true }
  );

  await recomputeAllCxPulseScores();

  // ---------------------------------------------------------------------
  // Audit log samples
  // ---------------------------------------------------------------------

  const adminActor = adminUserId ? await User.findById(adminUserId) : await User.findOne({ accountType: "admin_staff" });
  if (adminActor) {
    const auditSamples = [
      {
        action: "role.permissions_changed",
        targetType: "Role",
        targetLabel: "Support Staff",
        before: { permissions: { billingOversight: { edit: false } } },
        after: { permissions: { billingOversight: { edit: true } } },
        createdAt: daysAgo(6),
      },
      {
        action: "billing.comp_granted",
        targetType: "ParentOrganization",
        targetLabel: stAugustine.org.name,
        before: null,
        after: { period: "unlimited" },
        createdAt: daysAgo(14),
      },
      {
        action: "user.email_changed",
        targetType: "User",
        targetLabel: meridian.opsLead.email,
        before: { email: "old.contact@showcase.oodel.test" },
        after: { email: meridian.opsLead.email },
        createdAt: daysAgo(20),
      },
      {
        action: "team_member.access_tier_changed",
        targetType: "User",
        targetLabel: olive.teamLimited.email,
        before: { tier: "limited" },
        after: { tier: "full" },
        createdAt: daysAgo(3),
      },
      {
        action: "user.2fa_enabled",
        targetType: "User",
        targetLabel: adminActor.email,
        before: null,
        after: null,
        createdAt: daysAgo(1),
      },
    ];
    for (const sample of auditSamples) {
      const exists = await AuditLogEntry.findOne({ action: sample.action, targetLabel: sample.targetLabel });
      if (exists) continue;
      await AuditLogEntry.create({
        actorUserId: adminActor._id,
        actorEmail: adminActor.email,
        actorAccountType: adminActor.accountType,
        action: sample.action,
        targetType: sample.targetType,
        targetId: null,
        targetLabel: sample.targetLabel,
        before: sample.before,
        after: sample.after,
        createdAt: sample.createdAt,
      });
      result.auditLogEntries++;
    }
  }

  // Closing the Loop (Colleague Experience only) — one sent broadcast and
  // one still-drafting update per CE-enabled org, so the page never shows
  // its empty state and QA can see both halves of the lifecycle at once.
  const ceOrgs: { org: OrgResult; heard: string; doing: string }[] = [
    {
      org: meridian,
      heard: "Several of you told us the break room coffee situation needed work.",
      doing: "New machines are in at every branch as of this month — let us know what you think.",
    },
    {
      org: skyline,
      heard: "Scheduling changes with too little notice came up a lot in the last pulse.",
      doing: "We're moving to a 2-week minimum notice window for shift changes starting next month.",
    },
    {
      org: aurora,
      heard: "Crew feedback flagged that the JFK hub break area is too small for peak shift overlap.",
      doing: "A larger break space opens at JFK next quarter — layout is finalized and construction has started.",
    },
    {
      org: precision,
      heard: "Lab teams told us night shifts have no senior person to call when equipment fails.",
      doing: "A named on-call supervisor is now published for every shift at every lab.",
    },
    {
      org: stAugustine,
      heard: "Staff asked for clearer escalation paths when a shift is short-staffed.",
      doing: "A new on-call charge nurse rotation launches this month, with the escalation steps posted at every nursing station.",
    },
  ];
  // RosterEntry — Colleague Experience's own employee list, which drives
  // lifecycle-triggered surveys (onboarding day-30/90, exit). A handful of
  // rows per branch: mostly still-active, a couple mid-onboarding, one
  // already exited — so the lifecycle cron has real rows to evaluate and
  // an eventual roster-management UI never shows an empty account.
  for (const { org } of ceOrgs) {
    for (const branch of org.branches) {
      const rows: { email: string; startDaysAgo: number; endDaysAgo: number | null }[] = [
        { email: `roster.1.${slug(branch.business.name)}@${EMAIL_DOMAIN}`, startDaysAgo: 400, endDaysAgo: null },
        { email: `roster.2.${slug(branch.business.name)}@${EMAIL_DOMAIN}`, startDaysAgo: 220, endDaysAgo: null },
        { email: `roster.3.${slug(branch.business.name)}@${EMAIL_DOMAIN}`, startDaysAgo: 60, endDaysAgo: null },
        { email: `roster.4.${slug(branch.business.name)}@${EMAIL_DOMAIN}`, startDaysAgo: 20, endDaysAgo: null },
        { email: `roster.5.${slug(branch.business.name)}@${EMAIL_DOMAIN}`, startDaysAgo: 500, endDaysAgo: 10 },
      ];
      for (const row of rows) {
        await RosterEntry.findOneAndUpdate(
          { businessId: branch.business._id, email: row.email },
          {
            $setOnInsert: {
              businessId: branch.business._id,
              email: row.email,
              startDate: daysAgo(row.startDaysAgo),
              endDate: row.endDaysAgo === null ? null : daysAgo(row.endDaysAgo),
              triggeredStages: row.startDaysAgo >= 90 ? ["onboarding_30", "onboarding_90"] : row.startDaysAgo >= 30 ? ["onboarding_30"] : [],
            },
          },
          { upsert: true }
        );
        result.rosterEntries++;
      }
    }
  }

  for (const { org, heard, doing } of ceOrgs) {
    const branchIds = org.branches.map((b) => b.business._id);
    const rosterSize = org.branches.length * randomInt(8, 18);
    await ClosingLoopUpdate.findOneAndUpdate(
      { parentOrgId: org.org._id, title: `${org.org.name.split(" ")[0]} team update — what we heard` },
      {
        $setOnInsert: {
          parentOrgId: org.org._id,
          product: "colleague_experience",
          title: `${org.org.name.split(" ")[0]} team update — what we heard`,
          whatWeHeard: heard,
          whatWereDoing: doing,
          affectedBusinessIds: branchIds,
          status: "sent",
          sentAt: daysAgo(randomInt(5, 20)),
          recipientCount: rosterSize,
        },
      },
      { upsert: true }
    );
    result.closingLoopUpdates++;

    await ClosingLoopUpdate.findOneAndUpdate(
      { parentOrgId: org.org._id, title: "Next quarter — in progress" },
      {
        $setOnInsert: {
          parentOrgId: org.org._id,
          product: "colleague_experience",
          title: "Next quarter — in progress",
          whatWeHeard: "",
          whatWereDoing: "",
          affectedBusinessIds: branchIds,
          status: "draft",
        },
      },
      { upsert: true }
    );
    result.closingLoopUpdates++;
  }

  void meridianPlaybook;
  void foodQualityPlaybook;
  void skylineCases;
  void horizonCases;
  void auroraCases;
  void stAugustineCases;
  void amaniCases;

  // ---------------------------------------------------------------------
  // OodelCX Compass history + Evidence Fusion, then Program Evaluation runs
  // ---------------------------------------------------------------------
  const allProducts = (b: InstanceType<typeof Business>, o?: InstanceType<typeof ParentOrganization>): Product[] =>
    ((b.enabledProducts ?? o?.enabledProducts ?? ["customer_experience"]) as Product[]);
  const compassOwners: CompassDemoOwner[] = [];
  const orgProfiles: CompassDemoProfile[] = [
    { pattern: "cococo", stage: "established", retakes: 3, currentDaysAgo: 40 },
    { pattern: "ocucco", stage: "emerging", capped: { rhythm: 1 }, retakes: 2, currentDaysAgo: 120 },
    { pattern: "ccouuc", stage: "established", retakes: 2, currentDaysAgo: 60 },
    { pattern: "uccocc", stage: "emerging", capped: { ownership: 1 }, retakes: 1, currentDaysAgo: 30 },
    { pattern: "cccccc", stage: "established", retakes: 2, currentDaysAgo: 75 },
  ];
  allOrgs.forEach((o, i) => {
    compassOwners.push({
      ownerType: "parentOrg",
      ownerId: o.org._id,
      name: o.org.name,
      industry: o.org.industry,
      products: allProducts(o.branches[0].business, o.org),
      profile: orgProfiles[i % orgProfiles.length],
    });
    for (const br of o.branches) {
      compassOwners.push({
        ownerType: "business",
        ownerId: br.business._id,
        name: br.business.name,
        industry: br.business.industry || o.org.industry,
        products: allProducts(br.business, o.org),
      });
    }
  });
  compassOwners.push({
    ownerType: "business",
    ownerId: olive.business._id,
    name: olive.business.name,
    industry: olive.business.industry,
    products: allProducts(olive.business),
    profile: { pattern: "coccuc", stage: "emerging", capped: { hearing: 1 }, retakes: 2, currentDaysAgo: 100 },
  });
  compassOwners.push({
    ownerType: "business",
    ownerId: amaniBusiness._id,
    name: amaniBusiness.name,
    industry: amaniBusiness.industry,
    products: allProducts(amaniBusiness),
    profile: { pattern: "ccucoc", stage: "established", retakes: 2, currentDaysAgo: 55 },
  });
  const compassSeeded = await seedCompassDemo(compassOwners);
  console.log(`[showcase] compass: ${compassSeeded.assessments} assessments, ${compassSeeded.history} history rows`);

  const structureDemo = await seedStructureDemo();
  console.log(`[showcase] structure: ${JSON.stringify(structureDemo)}`);

  const polish = await seedShowcasePolish();
  console.log(`[showcase] polish: ${JSON.stringify(polish)}`);

  const launch = await seedLaunchDemoExtras();
  console.log(`[showcase] launch extras: ${JSON.stringify(launch)}`);

  // Run the evaluation for every programme session that has finished.
  for (const evt of amaniPrograms.eventIds) {
    if (!evt.ended) continue;
    try {
      await generateProgramEvaluationForEvent(evt.id);
    } catch (err) {
      console.error(`[showcase] program evaluation failed for ${evt.name} — ${evt.location}`, err);
    }
  }

  const finish = await seedDemoFinish({ insightReports: false });
  console.log(`[showcase] demo finish: ${JSON.stringify(finish)}`);

  return result;
}

/**
 * Deletes every tenant-scoped document — businesses, orgs, their logins,
 * feedback, alerts, the Act layer, billing, requests — so Admin can start
 * filling in real data from a clean slate. Deliberately keeps admin_staff
 * logins, system Roles, Email Templates, Site Content, and the CX Pulse
 * framework config, since those are platform configuration, not tenant data.
 */
export async function wipeAllTenantData(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  async function del(key: string, fn: () => Promise<{ deletedCount?: number }>) {
    const res = await fn();
    counts[key] = res.deletedCount ?? 0;
  }

  await del("actionItemComments", () => ActionItemComment.deleteMany({}));
  await del("actionBoardItems", () => ActionBoardItem.deleteMany({}));
  await del("decisionLogEntries", () => DecisionLogEntry.deleteMany({}));
  await del("improvementInitiatives", () => ImprovementInitiative.deleteMany({}));
  await del("recurringIssueFlags", () => RecurringIssueFlag.deleteMany({}));
  await del("cxGoals", () => CxGoal.deleteMany({}));
  await del("playbookRuns", () => PlaybookRun.deleteMany({}));
  await del("playbooks", () => Playbook.deleteMany({}));
  await del("categoryOwnerMappings", () => CategoryOwnerMapping.deleteMany({}));
  await del("alertActivity", () => AlertActivity.deleteMany({}));
  await del("alertRules", () => AlertRule.deleteMany({}));
  await del("supportTickets", () => SupportTicket.deleteMany({}));
  await del("closingLoopUpdates", () => ClosingLoopUpdate.deleteMany({}));
  await del("rosterSurveyTokens", () => RosterSurveyToken.deleteMany({}));
  await del("rosterEntries", () => RosterEntry.deleteMany({}));
  await del("events", () => TrainingEvent.deleteMany({}));
  await del("responses", () => FeedbackResponse.deleteMany({}));
  await del("feedbackPoints", () => FeedbackPoint.deleteMany({}));
  await del("feedbackPointRequests", () => FeedbackPointRequest.deleteMany({}));
  await del("invoices", () => Invoice.deleteMany({}));
  await del("billingSubscriptions", () => BillingSubscription.deleteMany({}));
  await del("cxPulseScores", () => CxPulseScore.deleteMany({}));
  await del("cxPulsePulseResponses", () => CxPulsePulseResponse.deleteMany({}));
  await del("questionTemplates", () => QuestionTemplate.deleteMany({}));
  await del("categories", () => Category.deleteMany({}));
  await del("industries", () => Industry.deleteMany({}));
  await del("demoRequests", () => DemoRequest.deleteMany({}));
  await del("aiInsightReports", () => AiInsightReport.deleteMany({}));
  await del("programEvaluationReports", () => ProgramEvaluationReport.deleteMany({}));
  await del("compassAssessments", () => CompassAssessment.deleteMany({}));
  await del("compassAssessmentHistory", () => CompassAssessmentHistory.deleteMany({}));
  await del("orgNodes", () => OrgNode.deleteMany({}));
  await del("businesses", () => Business.deleteMany({}));
  await del("parentOrgs", () => ParentOrganization.deleteMany({}));
  await del("users", () => User.deleteMany({ accountType: { $ne: "admin_staff" } }));

  return counts;
}
