import { randomBytes } from "crypto";
import { Types } from "mongoose";
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
import { RecurringIssueFlag } from "../models/RecurringIssueFlag";
import { Playbook } from "../models/Playbook";
import { CategoryOwnerMapping } from "../models/CategoryOwnerMapping";
import { autoAttachPlaybook } from "../scoring/caseAutoAttach";
import { CxPulseScore } from "../models/CxPulseScore";
import { CxPulsePulseResponse } from "../models/CxPulsePulseResponse";
import { DEFAULT_CX_PULSE_QUESTIONS } from "./cxPulseFramework";
import { BillingSubscription } from "../models/BillingSubscription";
import { AiInsightReport, type AiReportPeriod, type AiReportStatus } from "../models/AiInsightReport";
import { Invoice } from "../models/Invoice";
import { FeedbackPointRequest } from "../models/FeedbackPointRequest";
import { DemoRequest } from "../models/DemoRequest";
import { CxGoal, type CxGoalMetric, type CxGoalStatus } from "../models/CxGoal";
import { PlaybookRun } from "../models/PlaybookRun";
import { AuditLogEntry } from "../models/AuditLogEntry";
import { hashPassword } from "../auth/password";
import { markOwnerComp } from "../stripe/billing";
import { recomputeAllCxPulseScores } from "../cxpulse/compute";

/**
 * Every account this seed creates uses this password — never routed through
 * the real invite-email flow (spec Section 3's Resend send), so nothing here
 * ever triggers a real email. Contact emails use the IANA-reserved ".test"
 * TLD, guaranteed non-routable, so even a misconfigured send can't reach a
 * real inbox.
 */
export const SHOWCASE_PASSWORD = "ocx123";
const EMAIL_DOMAIN = "showcase.oodel.test";

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

/** The most recent *complete* period of the given cadence — e.g. "weekly" is
 * the last full Mon–Sun week before this one, matching spec Section 10's
 * report-generation schedule (offset 1 = the period before that one, etc). */
function periodRange(period: AiReportPeriod, offset = 0): { start: Date; end: Date } {
  const now = new Date();
  if (period === "weekly") {
    const dayOfWeek = now.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 * (offset + 1));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth() - (offset + 1), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === "quarterly") {
    const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const startMonth = currentQuarterStartMonth - 3 * (offset + 1);
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(now.getFullYear() - (offset + 1), 0, 1);
  const end = new Date(now.getFullYear() - offset, 0, 0, 23, 59, 59, 999);
  return { start, end };
}

async function upsertActiveUser(params: {
  email: string;
  accountType: AccountType;
  parentId: Types.ObjectId;
  teamRole?: string;
  tier?: TeamMemberTier;
  teamOfType?: "business" | "parentOrg";
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

// Deterministic stand-in for what ai/themeSentiment.ts would tag a comment
// with — seeding never calls the real API, so Theme Intelligence has real
// (not empty-state) data to show without needing ANTHROPIC_API_KEY.
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
      { text: "How friendly was our staff during your visit?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How clean and well-maintained was the branch?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate the speed of service today?", type: "star_1_5", category: "Service Speed" },
      { text: "How likely are you to recommend us to a friend or colleague?", type: "nps_0_10", category: null, required: true },
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
      { text: "How friendly and approachable was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How clean and well-maintained are our facilities?", type: "star_1_5", category: "Facilities" },
      { text: "How satisfied are you with communication from the school?", type: "star_1_5", category: "Communication" },
      { text: "How likely are you to recommend this school to another family?", type: "nps_0_10", category: null, required: true },
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
    key: "diagnostics",
    industry: "Healthcare & Diagnostics",
    templateName: "Diagnostics Lab Survey",
    questions: [
      { text: "How friendly was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How clean was the facility?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate the wait time for your test?", type: "star_1_5", category: "Service Speed" },
      { text: "How likely are you to recommend us to family or friends?", type: "nps_0_10", category: null, required: true },
      { text: "Were your results explained clearly?", type: "yes_no", category: "Communication" },
      { text: "Overall, how was your experience today?", type: "emoji_scale", category: null },
      { text: "Anything else you'd like us to know?", type: "open_text", category: null },
    ],
  },
  {
    key: "retail",
    industry: "Retail",
    templateName: "Retail Store Survey",
    questions: [
      { text: "How friendly was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How would you rate store cleanliness?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate value for money?", type: "star_1_5", category: "Value for Money" },
      { text: "How likely are you to recommend us to a friend?", type: "nps_0_10", category: null, required: true },
      { text: "Overall, how was your shopping experience today?", type: "emoji_scale", category: null },
      {
        text: "What did you come in for today?",
        type: "dropdown",
        category: "Product Quality",
        options: ["Browsing", "Specific purchase", "Return/exchange", "Other"],
      },
      { text: "Anything else you'd like to share?", type: "open_text", category: null },
    ],
  },
  {
    key: "restaurant",
    industry: "Restaurant",
    templateName: "Restaurant Guest Survey",
    questions: [
      { text: "How friendly was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How would you rate the food quality?", type: "star_1_5", category: "Product Quality" },
      { text: "How clean was the restaurant?", type: "star_1_5", category: "Cleanliness" },
      { text: "How likely are you to recommend us to a friend?", type: "nps_0_10", category: null, required: true },
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
    key: "fitness",
    industry: "Fitness",
    templateName: "Fitness Club Survey",
    questions: [
      { text: "How friendly was our staff/trainers?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How clean were the facilities/equipment?", type: "star_1_5", category: "Cleanliness" },
      { text: "How would you rate value for money of your membership?", type: "star_1_5", category: "Value for Money" },
      { text: "How likely are you to recommend us to a friend?", type: "nps_0_10", category: null, required: true },
      { text: "Rate your energy level after today's session", type: "slider", category: null },
      { text: "Was the equipment you needed available?", type: "yes_no", category: "Facilities" },
      { text: "Anything else you'd like to share?", type: "open_text", category: null },
    ],
  },
  {
    key: "automotive",
    industry: "Automotive",
    templateName: "Auto Service Survey",
    questions: [
      { text: "How friendly was our staff?", type: "star_1_5", category: "Staff Friendliness", required: true },
      { text: "How would you rate the quality of work performed?", type: "star_1_5", category: "Product Quality" },
      { text: "How would you rate value for money?", type: "star_1_5", category: "Value for Money" },
      { text: "How likely are you to recommend us to a friend?", type: "nps_0_10", category: null, required: true },
      { text: "Was your vehicle ready when promised?", type: "yes_no", category: "Service Speed" },
      {
        text: "What service did you come in for?",
        type: "dropdown",
        category: null,
        options: ["Oil change", "Repair", "Inspection", "Tires", "Other"],
      },
      { text: "Anything else you'd like to tell us?", type: "open_text", category: null },
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

interface BranchDef {
  name: string;
  region: string;
}

interface GroupDef {
  key: string;
  name: string;
  sector: string;
  branches: BranchDef[];
  branchBilling?: Record<string, "group_pays" | "branch_pays">; // per-branch override, default group_pays
}

interface StandaloneDef {
  key: string;
  name: string;
  sector: string;
}

const GROUPS: GroupDef[] = [
  {
    key: "meridian",
    name: "Meridian Bank Group",
    sector: "banking",
    branches: [
      { name: "Meridian Bank – Downtown", region: "Central" },
      { name: "Meridian Bank – Uptown", region: "Central" },
      { name: "Meridian Bank – Airport Road", region: "South" },
    ],
  },
  {
    key: "brightfuture",
    name: "Bright Future Schools Trust",
    sector: "education",
    branches: [
      { name: "Bright Future Elementary", region: "East" },
      { name: "Bright Future High School", region: "East" },
      { name: "Bright Future STEM Academy", region: "West" },
    ],
    branchBilling: { "Bright Future STEM Academy": "branch_pays" },
  },
  {
    key: "precisiondx",
    name: "PrecisionDx Diagnostics",
    sector: "diagnostics",
    branches: [
      { name: "PrecisionDx – Central Lab", region: "Central" },
      { name: "PrecisionDx – North Clinic", region: "Central" },
      { name: "PrecisionDx – Mall Branch", region: "West" },
    ],
  },
  {
    key: "urbanmart",
    name: "UrbanMart Retail",
    sector: "retail",
    branches: [
      { name: "UrbanMart – Mall Plaza", region: "Central" },
      { name: "UrbanMart – High Street", region: "Central" },
      { name: "UrbanMart – Riverside", region: "South" },
    ],
  },
];

const STANDALONES: StandaloneDef[] = [
  { key: "dailygrind", name: "The Daily Grind Café", sector: "restaurant" },
  { key: "spiceroute", name: "Spice Route Kitchen", sector: "restaurant" },
  { key: "zenithfitness", name: "Zenith Fitness Club", sector: "fitness" },
  { key: "quickfixauto", name: "QuickFix Auto Service", sector: "automotive" },
];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function answerValueFor(question: IQuestion, mood: "bad" | "neutral" | "good"): unknown {
  switch (question.type) {
    case "star_1_5":
      return mood === "bad" ? pick([1, 2]) : mood === "neutral" ? 3 : pick([4, 5]);
    case "nps_0_10":
      return mood === "bad" ? randomInt(0, 4) : mood === "neutral" ? randomInt(5, 6) : randomInt(7, 10);
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

interface SeededBusinessInfo {
  business: InstanceType<typeof Business>;
  ownerUser: InstanceType<typeof User>;
  teamFull: InstanceType<typeof User> | null;
  teamLimited: InstanceType<typeof User> | null;
  sector: SectorDef;
  template: InstanceType<typeof QuestionTemplate>;
  feedbackPoints: InstanceType<typeof FeedbackPoint>[];
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
}

/**
 * Idempotent-ish: re-running clears out prior showcase-tagged data first
 * (matched by the fixed business/org names above) so repeat clicks don't
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
  };

  // 1. Categories + industries (global reference data, upserted by name).
  const categoryByName = new Map<CategoryName, Types.ObjectId>();
  for (const name of CATEGORY_NAMES) {
    const cat = await Category.findOneAndUpdate({ name }, { $setOnInsert: { name } }, { upsert: true, new: true });
    categoryByName.set(name, cat._id);
  }
  const sectorIndustries = new Set(SECTORS.map((s) => s.industry));
  for (const name of sectorIndustries) {
    await Industry.findOneAndUpdate({ name }, { $setOnInsert: { name, usedByCount: 0 } }, { upsert: true });
  }

  // 2. One QuestionTemplate per sector.
  const templateBySector = new Map<string, InstanceType<typeof QuestionTemplate>>();
  for (const sector of SECTORS) {
    const questions: IQuestion[] = sector.questions.map((q) => ({
      text: q.text,
      type: q.type,
      categoryId: q.category ? categoryByName.get(q.category)! : null,
      required: q.required ?? false,
      isTracker: q.type === "star_1_5",
      options: q.options ?? [],
    }));
    const template = await QuestionTemplate.findOneAndUpdate(
      { name: sector.templateName },
      { $set: { name: sector.templateName, suggestedIndustries: [sector.industry], questions } },
      { upsert: true, new: true }
    );
    templateBySector.set(sector.key, template);
  }

  const businesses: SeededBusinessInfo[] = [];

  async function createBusiness(params: {
    name: string;
    sectorKey: string;
    parentOrgId: Types.ObjectId | null;
    region: string;
    billingAssignment: "group_pays" | "branch_pays";
    slugKey: string;
  }): Promise<SeededBusinessInfo> {
    const sector = SECTORS.find((s) => s.key === params.sectorKey)!;
    const template = templateBySector.get(params.sectorKey)!;
    const contactEmail = `owner.${params.slugKey}@${EMAIL_DOMAIN}`;

    const business = await Business.findOneAndUpdate(
      { name: params.name },
      {
        $set: {
          name: params.name,
          industry: sector.industry,
          parentOrgId: params.parentOrgId,
          region: params.region,
          contactName: `${params.name} Manager`,
          contactEmail,
          contactPhone: "",
          billingAssignment: params.billingAssignment,
          plan: "business_monthly",
          maxFeedbackPoints: 3,
          questionTemplateId: template._id,
          demographicConfig: { name: "optional", email: "optional", phone: "off", ageGroup: "optional", gender: "optional" },
          accountManagerId: adminUserId ?? null,
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    const ownerUser = await upsertActiveUser({ email: contactEmail, accountType: "business", parentId: business._id, lastLoginDaysAgo: randomInt(0, 5) });
    result.users++;

    const teamFull = await upsertActiveUser({
      email: `ops.${params.slugKey}@${EMAIL_DOMAIN}`,
      accountType: "team_member",
      parentId: business._id,
      teamRole: "Operations Manager",
      tier: "full",
      teamOfType: "business",
      lastLoginDaysAgo: randomInt(1, 10),
    });
    result.users++;
    const teamLimited = await upsertActiveUser({
      email: `shiftlead.${params.slugKey}@${EMAIL_DOMAIN}`,
      accountType: "team_member",
      parentId: business._id,
      teamRole: "Shift Lead",
      tier: "limited",
      teamOfType: "business",
      lastLoginDaysAgo: randomInt(1, 15),
    });
    result.users++;

    await FeedbackPoint.deleteMany({ businessId: business._id });
    const pointNames = params.parentOrgId ? ["Front Desk"] : ["Front Counter", "Checkout"];
    const feedbackPoints: InstanceType<typeof FeedbackPoint>[] = [];
    for (const pointName of pointNames.slice(0, randomInt(1, pointNames.length))) {
      const fp = await FeedbackPoint.create({
        businessId: business._id,
        name: pointName,
        description: `Feedback point at ${params.name} — ${pointName}`,
        qrToken: randomBytes(16).toString("hex"),
        scans: randomInt(40, 400),
        active: true,
      });
      feedbackPoints.push(fp);
      result.feedbackPoints++;
    }

    result.businesses++;
    const info: SeededBusinessInfo = { business, ownerUser, teamFull, teamLimited, sector, template, feedbackPoints };
    businesses.push(info);
    return info;
  }

  // 3. Groups + branches.
  const groupInfoByKey = new Map<string, { org: InstanceType<typeof ParentOrganization>; branches: SeededBusinessInfo[]; teamStaff: InstanceType<typeof User>[] }>();

  for (const group of GROUPS) {
    const contactEmail = `owner.${group.key}@${EMAIL_DOMAIN}`;
    const org = await ParentOrganization.findOneAndUpdate(
      { name: group.name },
      {
        $set: {
          name: group.name,
          contactName: `${group.name} HQ`,
          contactEmail,
          contactPhone: "",
          defaultBillingMode: "group_pays",
          accountManagerId: adminUserId ?? null,
        },
      },
      { upsert: true, new: true }
    );
    result.parentOrgs++;

    const orgOwner = await upsertActiveUser({ email: contactEmail, accountType: "parent_org", parentId: org._id, lastLoginDaysAgo: randomInt(0, 4) });
    result.users++;
    const opsLead = await upsertActiveUser({
      email: `regional.ops.${group.key}@${EMAIL_DOMAIN}`,
      accountType: "team_member",
      parentId: org._id,
      teamRole: "Regional Operations Lead",
      tier: "full",
      teamOfType: "parentOrg",
      lastLoginDaysAgo: randomInt(1, 8),
    });
    result.users++;
    const cxLead = await upsertActiveUser({
      email: `cx.lead.${group.key}@${EMAIL_DOMAIN}`,
      accountType: "team_member",
      parentId: org._id,
      teamRole: "Customer Experience Lead",
      tier: "full",
      teamOfType: "parentOrg",
      lastLoginDaysAgo: randomInt(1, 8),
    });
    result.users++;

    const branchInfos: SeededBusinessInfo[] = [];
    for (const branch of group.branches) {
      const billing = group.branchBilling?.[branch.name] ?? "group_pays";
      const info = await createBusiness({
        name: branch.name,
        sectorKey: group.sector,
        parentOrgId: org._id,
        region: branch.region,
        billingAssignment: billing,
        slugKey: slug(branch.name),
      });
      branchInfos.push(info);
    }

    groupInfoByKey.set(group.key, { org, branches: branchInfos, teamStaff: [orgOwner, opsLead, cxLead] });
  }

  // 4. Standalone businesses.
  const standaloneInfoByKey = new Map<string, SeededBusinessInfo>();
  for (const standalone of STANDALONES) {
    const info = await createBusiness({
      name: standalone.name,
      sectorKey: standalone.sector,
      parentOrgId: null,
      region: "",
      billingAssignment: "branch_pays",
      slugKey: standalone.key,
    });
    standaloneInfoByKey.set(standalone.key, info);
  }

  // 5. Category owner mappings (business + parentOrg scope) — the feature
  // this session just built, so the showcase demonstrates it directly.
  async function mapCategory(
    scope: "business" | "parentOrg",
    scopeId: Types.ObjectId,
    categoryName: CategoryName,
    ownerId: Types.ObjectId,
    repeat?: { thresholdCount: number; windowDays: number }
  ) {
    await CategoryOwnerMapping.findOneAndUpdate(
      { ownerScope: scope, ownerScopeId: scopeId, categoryId: categoryByName.get(categoryName) },
      {
        $set: {
          defaultOwnerId: ownerId,
          repeatThresholdCount: repeat?.thresholdCount ?? null,
          repeatWindowDays: repeat?.windowDays ?? null,
        },
      },
      { upsert: true }
    );
    result.categoryOwnerMappings++;
  }

  const meridian = groupInfoByKey.get("meridian")!;
  await mapCategory("parentOrg", meridian.org._id, "Staff Friendliness", meridian.teamStaff[1]._id, { thresholdCount: 4, windowDays: 30 });
  await mapCategory("parentOrg", meridian.org._id, "Communication", meridian.teamStaff[2]._id);

  const brightfuture = groupInfoByKey.get("brightfuture")!;
  await mapCategory("parentOrg", brightfuture.org._id, "Facilities", brightfuture.teamStaff[1]._id);

  const precisiondx = groupInfoByKey.get("precisiondx")!;
  await mapCategory("parentOrg", precisiondx.org._id, "Cleanliness", precisiondx.teamStaff[1]._id);

  const urbanmart = groupInfoByKey.get("urbanmart")!;
  await mapCategory("parentOrg", urbanmart.org._id, "Value for Money", urbanmart.teamStaff[1]._id);

  const dailygrind = standaloneInfoByKey.get("dailygrind")!;
  await mapCategory("business", dailygrind.business._id, "Product Quality", dailygrind.teamFull!._id, { thresholdCount: 3, windowDays: 14 });
  const zenith = standaloneInfoByKey.get("zenithfitness")!;
  await mapCategory("business", zenith.business._id, "Cleanliness", zenith.teamFull!._id, { thresholdCount: 4, windowDays: 30 });

  // 6. Playbooks tied to the mapped categories.
  async function addPlaybook(params: {
    parentOrgId: Types.ObjectId | null;
    businessId: Types.ObjectId | null;
    title: string;
    category: CategoryName;
    trigger: string;
    steps: string[];
    escalationContactId: Types.ObjectId | null;
  }): Promise<InstanceType<typeof Playbook>> {
    const playbook = await Playbook.findOneAndUpdate(
      { title: params.title },
      {
        $set: {
          parentOrgId: params.parentOrgId,
          businessId: params.businessId,
          title: params.title,
          categoryId: categoryByName.get(params.category),
          triggerCondition: params.trigger,
          steps: params.steps,
          escalationContactId: params.escalationContactId,
        },
      },
      { upsert: true, new: true }
    );
    result.playbooks++;
    return playbook;
  }

  const staffFriendlinessPlaybook = await addPlaybook({
    parentOrgId: meridian.org._id,
    businessId: null,
    title: "Staff Friendliness Recovery",
    category: "Staff Friendliness",
    trigger: "3+ low friendliness ratings in 2 weeks at one branch",
    steps: [
      "Branch manager reviews the flagged responses within 24 hours",
      "One-on-one coaching session with the staff member involved",
      "Follow up with the customer if contact info was left",
      "Re-check the branch's friendliness score after 2 weeks",
    ],
    escalationContactId: meridian.teamStaff[1]._id,
  });
  const foodQualityPlaybook = await addPlaybook({
    parentOrgId: null,
    businessId: dailygrind.business._id,
    title: "Food Quality Escalation",
    category: "Product Quality",
    trigger: "Any single rating of 1-2 stars on food quality",
    steps: [
      "Kitchen lead reviews the order and ticket from that time",
      "Offer the customer a replacement or refund if contactable",
      "Log the root cause (ingredient, prep, timing) for the week's review",
    ],
    escalationContactId: dailygrind.teamFull!._id,
  });
  const serviceSpeedPlaybook = await addPlaybook({
    parentOrgId: meridian.org._id,
    businessId: null,
    title: "Speed of Service Recovery",
    category: "Service Speed",
    trigger: "Service-speed average dips below 3.5 stars over 2 weeks",
    steps: [
      "Branch manager reviews staffing levels for the flagged time slot",
      "Adjust scheduling or add a float staff member for peak hours",
      "Follow up with the customer if contact info was left",
      "Re-check the branch's service-speed score after 2 weeks",
    ],
    escalationContactId: meridian.teamStaff[2]._id,
  });

  // 7. Alert rules — one fixed_threshold (star average) + one fixed_threshold
  // (NPS) per business, plus org-wide sudden_drop and negative_sentiment
  // rules for two groups.
  async function addAlertRule(params: {
    scope: "business" | "parentOrg_all";
    ownerId: Types.ObjectId;
    ruleType: AlertRuleType;
    metric?: string;
    threshold?: number | null;
    sensitivity?: number | null;
    baselineWindowDays?: number | null;
    dropPercent?: number | null;
    recipients: string[];
  }) {
    const rule = await AlertRule.create({
      scope: params.scope,
      ownerId: params.ownerId,
      ruleType: params.ruleType,
      metric: params.metric ?? "",
      threshold: params.threshold ?? null,
      sensitivity: params.sensitivity ?? null,
      baselineWindowDays: params.baselineWindowDays ?? null,
      dropPercent: params.dropPercent ?? null,
      recipients: params.recipients,
      active: true,
    });
    result.alertRules++;
    return rule;
  }

  const alertRuleByBusinessId = new Map<string, InstanceType<typeof AlertRule>>();
  for (const info of businesses) {
    const rule = await addAlertRule({
      scope: "business",
      ownerId: info.business._id,
      ruleType: "fixed_threshold",
      metric: "star_average",
      threshold: 3,
      recipients: [info.ownerUser.email],
    });
    alertRuleByBusinessId.set(info.business._id.toString(), rule);
    await addAlertRule({
      scope: "business",
      ownerId: info.business._id,
      ruleType: "fixed_threshold",
      metric: "nps",
      threshold: 30,
      recipients: [info.ownerUser.email],
    });
  }
  await addAlertRule({
    scope: "parentOrg_all",
    ownerId: meridian.org._id,
    ruleType: "sudden_drop",
    baselineWindowDays: 30,
    dropPercent: 15,
    recipients: [meridian.teamStaff[0].email],
  });
  await addAlertRule({
    scope: "parentOrg_all",
    ownerId: urbanmart.org._id,
    ruleType: "regional_outlier",
    sensitivity: 1.5,
    recipients: [urbanmart.teamStaff[0].email],
  });

  // 8. Responses — spread over the last 60 days, weighted toward positive.
  const categoryNameByIdForThemes = new Map<string, CategoryName>();
  for (const [name, id] of categoryByName) categoryNameByIdForThemes.set(id.toString(), name);
  const commentPoolTeam = new Map<string, InstanceType<typeof User>[]>();
  for (const info of businesses) {
    commentPoolTeam.set(info.business._id.toString(), [info.ownerUser, ...(info.teamFull ? [info.teamFull] : [])]);
  }

  interface LowScoreEvent {
    businessId: Types.ObjectId;
    parentOrgId: Types.ObjectId | null;
    responseId: Types.ObjectId;
    submittedAt: Date;
    categoryId: Types.ObjectId | null;
    starValue: number;
    comment: string | null;
    ownerCandidates: InstanceType<typeof User>[];
  }
  const lowScoreEvents: LowScoreEvent[] = [];

  for (const info of businesses) {
    for (const fp of info.feedbackPoints) {
      const count = randomInt(18, 32);
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const mood: "bad" | "neutral" | "good" = roll < 0.14 ? "bad" : roll < 0.3 ? "neutral" : "good";
        const submittedAt = daysAgo(randomInt(0, 59));

        let lowestStarCategoryId: Types.ObjectId | null = null;
        let lowestStarValue = 5;
        let openTextComment: string | null = null;

        const answers = info.template.questions.map((question) => {
          const value = answerValueFor(question, mood);
          if (question.type === "star_1_5" && typeof value === "number" && value < lowestStarValue) {
            lowestStarValue = value;
            lowestStarCategoryId = question.categoryId;
          }
          if (question.type === "open_text" && typeof value === "string" && value) {
            openTextComment = value;
          }
          return { questionId: new Types.ObjectId(), type: question.type, value, categoryId: question.categoryId };
        });

        const hasDemographics = Math.random() < 0.5;
        const hasName = Math.random() < 0.35;
        const hasEmail = Math.random() < 0.25;

        const themeCategoryName =
          lowestStarCategoryId === null ? null : categoryNameByIdForThemes.get(String(lowestStarCategoryId)) ?? null;
        const { sentiment, themes } = deriveSentimentAndThemes(mood, themeCategoryName, !!openTextComment);

        const response = await FeedbackResponse.create({
          feedbackPointId: fp._id,
          businessId: info.business._id,
          answers,
          respondentName: hasName ? pick(["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie"]) : null,
          respondentEmail: hasEmail ? `respondent${randomInt(1000, 9999)}@example.test` : null,
          respondentPhone: null,
          demographics: hasDemographics ? { ageGroup: pick(AGE_GROUPS), gender: pick(GENDERS) } : { ageGroup: "", gender: "" },
          submittedAt,
          deviceType: pick(["mobile", "mobile", "mobile", "desktop", "tablet"] as const),
          flagged: false,
          sentiment,
          themes,
          sentimentAnalyzedAt: sentiment ? submittedAt : null,
        });
        result.responses++;

        if (mood === "bad" && lowestStarValue <= 2) {
          lowScoreEvents.push({
            businessId: info.business._id,
            parentOrgId: info.business.parentOrgId ?? null,
            responseId: response._id,
            submittedAt,
            categoryId: lowestStarCategoryId,
            starValue: lowestStarValue,
            comment: openTextComment,
            ownerCandidates: commentPoolTeam.get(info.business._id.toString()) ?? [],
          });

          const rule = alertRuleByBusinessId.get(info.business._id.toString());
          if (rule) {
            await AlertActivity.create({
              alertRuleId: rule._id,
              businessId: info.business._id,
              triggeredAt: submittedAt,
              snapshotValue: lowestStarValue,
            });
            result.alertActivity++;
          }
        }
      }
    }
  }

  // 9. Action Board items from a sample of the low-score events, spanning
  // open / in_progress / resolved, with a comment trail on the open ones.
  const categoryNameById = new Map<string, CategoryName>();
  for (const [name, id] of categoryByName) categoryNameById.set(id.toString(), name);

  const mappingCache = new Map<string, Types.ObjectId | null>();
  async function ownerForCategory(
    scope: "business" | "parentOrg",
    scopeId: Types.ObjectId,
    categoryId: Types.ObjectId | null
  ): Promise<Types.ObjectId | null> {
    if (!categoryId) return null;
    const key = `${scope}:${scopeId.toString()}:${categoryId.toString()}`;
    if (mappingCache.has(key)) return mappingCache.get(key)!;
    const mapping = await CategoryOwnerMapping.findOne({ ownerScope: scope, ownerScopeId: scopeId, categoryId });
    const ownerId = mapping?.defaultOwnerId ?? null;
    mappingCache.set(key, ownerId);
    return ownerId;
  }

  const businessById = new Map(businesses.map((b) => [b.business._id.toString(), b]));
  const STATUSES: ("open" | "in_progress" | "resolved")[] = ["open", "in_progress", "resolved", "resolved"];

  const sampledEvents = pickSome(lowScoreEvents, Math.min(lowScoreEvents.length, businesses.length * 2));
  for (const event of sampledEvents) {
    const info = businessById.get(event.businessId.toString())!;
    const scope = event.parentOrgId ? "parentOrg" : "business";
    const scopeId = event.parentOrgId ?? event.businessId;
    let ownerId = await ownerForCategory(scope, scopeId, event.categoryId);
    const source = ownerId ? "auto_assigned" : "auto_suggested";
    if (!ownerId && event.ownerCandidates.length) ownerId = event.ownerCandidates[0]._id;

    const categoryLabel = event.categoryId ? categoryNameById.get(event.categoryId.toString()) ?? "Service" : "Service";
    const priority: ActionPriority = event.starValue <= 1 ? "high" : "medium";
    const status = pick(STATUSES);

    const item = await ActionBoardItem.create({
      parentOrgId: event.parentOrgId,
      businessId: event.businessId,
      title: `${categoryLabel} concern reported at ${info.business.name}`,
      description: event.comment ? `Respondent comment: "${event.comment}"` : `A ${event.starValue}-star rating was logged for ${categoryLabel.toLowerCase()}.`,
      categoryId: event.categoryId,
      priority,
      status,
      ownerId,
      dueDate: status === "resolved" ? null : daysAgo(-randomInt(2, 10)),
      sourceResponseIds: [event.responseId],
      resolutionNote:
        status === "resolved"
          ? pick([
              "Spoke with the team involved and reinforced our service standards during the next shift huddle.",
              "Reached out to the customer directly and resolved their concern; also flagged the issue internally.",
              "Root cause identified and corrected — added a checklist step to prevent recurrence.",
            ])
          : "",
      resolvedAt: status === "resolved" ? daysAgo(randomInt(0, Math.max(1, 59 - Math.floor((Date.now() - event.submittedAt.getTime()) / 86400000)))) : null,
      source,
      createdAt: event.submittedAt,
    });
    result.actionBoardItems++;
    await autoAttachPlaybook(item);

    if (status !== "resolved" && event.ownerCandidates.length) {
      const commenters = event.ownerCandidates;
      const firstAuthor = commenters[0];
      const secondAuthor = commenters[1] ?? commenters[0];
      await ActionItemComment.create({
        actionItemId: item._id,
        authorId: firstAuthor._id,
        authorLabel: firstAuthor.email,
        body: "Looking into this now — following up with the team member involved.",
        createdAt: daysAgo(Math.max(0, randomInt(0, 3))),
      });
      await ActionItemComment.create({
        actionItemId: item._id,
        authorId: secondAuthor._id,
        authorLabel: secondAuthor.email,
        body: status === "in_progress" ? "Update: spoke with the customer, working on a resolution." : "Noted, will keep an eye on this one.",
        createdAt: daysAgo(Math.max(0, randomInt(0, 2))),
      });
      result.actionItemComments += 2;
    }
  }

  // 9b. Systemic patterns — Recurring Issue Flags, the Improvement
  // Initiatives a human converts them into, and the Decision Log entries a
  // completed initiative can produce. Demonstrates the full "repeat case ->
  // flag -> initiative -> decision" pipeline end to end, across all three
  // flag statuses (active/converted/dismissed) and both ownerScopes
  // (single business vs. cross-branch parentOrg).
  async function createPatternCase(params: {
    parentOrgId: Types.ObjectId | null;
    businessId: Types.ObjectId;
    businessName: string;
    categoryId: Types.ObjectId;
    categoryLabel: string;
    comment: string;
    createdDaysAgo: number;
    resolved: boolean;
  }) {
    const item = await ActionBoardItem.create({
      parentOrgId: params.parentOrgId,
      businessId: params.businessId,
      title: `${params.categoryLabel} concern reported at ${params.businessName}`,
      description: `Respondent comment: "${params.comment}"`,
      categoryId: params.categoryId,
      priority: "medium",
      status: params.resolved ? "resolved" : "open",
      ownerId: null,
      dueDate: params.resolved ? null : daysAgo(-randomInt(2, 8)),
      sourceResponseIds: [],
      resolutionNote: params.resolved ? "Logged as part of a broader pattern — see the linked initiative." : "",
      resolvedAt: params.resolved ? daysAgo(Math.max(0, params.createdDaysAgo - randomInt(1, 4))) : null,
      source: "auto_suggested",
      createdAt: daysAgo(params.createdDaysAgo),
    });
    result.actionBoardItems++;
    return item;
  }

  // A. Cross-branch pattern (Meridian Bank Group) — active flag, initiative
  // in progress, no Decision Log entry yet (still being worked).
  const meridianDowntownForPattern = meridian.branches.find((b) => b.business.name === "Meridian Bank – Downtown")!;
  const meridianUptownForPattern = meridian.branches.find((b) => b.business.name === "Meridian Bank – Uptown")!;
  const staffFriendlinessId = categoryByName.get("Staff Friendliness")!;
  const meridianPatternCases = [
    await createPatternCase({
      parentOrgId: meridian.org._id,
      businessId: meridianDowntownForPattern.business._id,
      businessName: meridianDowntownForPattern.business.name,
      categoryId: staffFriendlinessId,
      categoryLabel: "Staff Friendliness",
      comment: "The teller was short with me and seemed rushed the whole time.",
      createdDaysAgo: 18,
      resolved: false,
    }),
    await createPatternCase({
      parentOrgId: meridian.org._id,
      businessId: meridianDowntownForPattern.business._id,
      businessName: meridianDowntownForPattern.business.name,
      categoryId: staffFriendlinessId,
      categoryLabel: "Staff Friendliness",
      comment: "Staff barely acknowledged me at the counter.",
      createdDaysAgo: 12,
      resolved: false,
    }),
    await createPatternCase({
      parentOrgId: meridian.org._id,
      businessId: meridianUptownForPattern.business._id,
      businessName: meridianUptownForPattern.business.name,
      categoryId: staffFriendlinessId,
      categoryLabel: "Staff Friendliness",
      comment: "Not the friendliest visit — felt like an inconvenience to the staff.",
      createdDaysAgo: 9,
      resolved: false,
    }),
    await createPatternCase({
      parentOrgId: meridian.org._id,
      businessId: meridianUptownForPattern.business._id,
      businessName: meridianUptownForPattern.business.name,
      categoryId: staffFriendlinessId,
      categoryLabel: "Staff Friendliness",
      comment: "Teller was curt and didn't explain the fee.",
      createdDaysAgo: 4,
      resolved: false,
    }),
  ];
  await RecurringIssueFlag.create({
    ownerScope: "parentOrg",
    ownerScopeId: meridian.org._id,
    categoryId: staffFriendlinessId,
    caseIds: meridianPatternCases.map((c) => c._id),
    businessIds: [meridianDowntownForPattern.business._id, meridianUptownForPattern.business._id],
    count: meridianPatternCases.length,
    windowDays: 30,
    firstCaseAt: daysAgo(18),
    lastCaseAt: daysAgo(4),
    status: "active",
  });
  result.recurringIssueFlags++;
  await ImprovementInitiative.create({
    parentOrgId: meridian.org._id,
    businessId: null,
    title: "Retrain frontline staff on greeting & tone standards",
    description:
      "Staff Friendliness complaints have surfaced at both Downtown and Uptown within the same month — this initiative retrains tellers at both branches on the greeting standard and adds a mystery-shopper check.",
    ownerId: meridian.teamStaff[1]._id,
    affectedBusinessIds: [meridianDowntownForPattern.business._id, meridianUptownForPattern.business._id],
    linkedActionIds: meridianPatternCases.map((c) => c._id),
    status: "in_progress",
    baselineMetricDescription: "Average Staff Friendliness rating (Downtown & Uptown)",
    baselineValue: 2.6,
    targetValue: 4.2,
    startedAt: daysAgo(3),
    completedAt: null,
  });
  result.improvementInitiatives++;

  // B. Single-branch pattern that's already run its course (Zenith Fitness)
  // — converted flag, completed initiative, implemented Decision Log entry
  // with a measured before/after outcome.
  const cleanlinessId = categoryByName.get("Cleanliness")!;
  const zenithPatternCases = [
    await createPatternCase({
      parentOrgId: null,
      businessId: zenith.business._id,
      businessName: zenith.business.name,
      categoryId: cleanlinessId,
      categoryLabel: "Cleanliness",
      comment: "Locker room floor was wet and towels were out.",
      createdDaysAgo: 52,
      resolved: true,
    }),
    await createPatternCase({
      parentOrgId: null,
      businessId: zenith.business._id,
      businessName: zenith.business.name,
      categoryId: cleanlinessId,
      categoryLabel: "Cleanliness",
      comment: "Equipment wasn't wiped down between uses, and neither were the benches.",
      createdDaysAgo: 47,
      resolved: true,
    }),
    await createPatternCase({
      parentOrgId: null,
      businessId: zenith.business._id,
      businessName: zenith.business.name,
      categoryId: cleanlinessId,
      categoryLabel: "Cleanliness",
      comment: "Locker rooms need a deep clean — smelled pretty bad today.",
      createdDaysAgo: 43,
      resolved: true,
    }),
    await createPatternCase({
      parentOrgId: null,
      businessId: zenith.business._id,
      businessName: zenith.business.name,
      categoryId: cleanlinessId,
      categoryLabel: "Cleanliness",
      comment: "Trash bins were overflowing in the changing area.",
      createdDaysAgo: 40,
      resolved: true,
    }),
  ];
  const zenithInitiative = await ImprovementInitiative.create({
    parentOrgId: null,
    businessId: zenith.business._id,
    title: "Deep-clean and re-audit locker rooms weekly",
    description:
      "Four Cleanliness complaints about the locker rooms within a month prompted a weekly deep-clean schedule and a staff re-audit checklist.",
    ownerId: zenith.ownerUser._id,
    affectedBusinessIds: [zenith.business._id],
    linkedActionIds: zenithPatternCases.map((c) => c._id),
    status: "completed",
    baselineMetricDescription: "Average Cleanliness rating",
    baselineValue: 2.9,
    targetValue: 4.3,
    startedAt: daysAgo(45),
    completedAt: daysAgo(5),
  });
  result.improvementInitiatives++;
  await RecurringIssueFlag.create({
    ownerScope: "business",
    ownerScopeId: zenith.business._id,
    categoryId: cleanlinessId,
    caseIds: zenithPatternCases.map((c) => c._id),
    businessIds: [zenith.business._id],
    count: zenithPatternCases.length,
    windowDays: 30,
    firstCaseAt: daysAgo(52),
    lastCaseAt: daysAgo(40),
    status: "converted",
    convertedInitiativeId: zenithInitiative._id,
  });
  result.recurringIssueFlags++;
  await DecisionLogEntry.create({
    parentOrgId: null,
    businessId: zenith.business._id,
    title: zenithInitiative.title,
    trigger: "Four Cleanliness complaints about the locker rooms within 30 days, surfaced via the Recurring Issues flag.",
    linkedActionIds: zenithPatternCases.map((c) => c._id),
    affectedBusinessIds: [zenith.business._id],
    ownerId: zenith.ownerUser._id,
    implementationDate: daysAgo(40),
    status: "implemented",
    outcomeMetricDescription: "Average Cleanliness rating",
    outcomeMetric: "categoryAverage",
    outcomeCategoryId: cleanlinessId,
    outcomeBefore: 2.9,
    outcomeAfter: 4.3,
    outcomeMeasuredAt: daysAgo(3),
  });
  result.decisionLogEntries++;

  // C. A pattern that was reviewed and dismissed (The Daily Grind Café) —
  // shows the "not every flag becomes an initiative" path.
  const productQualityId = categoryByName.get("Product Quality")!;
  const dailygrindPatternCases = [
    await createPatternCase({
      parentOrgId: null,
      businessId: dailygrind.business._id,
      businessName: dailygrind.business.name,
      categoryId: productQualityId,
      categoryLabel: "Product Quality",
      comment: "My latte was lukewarm today.",
      createdDaysAgo: 12,
      resolved: true,
    }),
    await createPatternCase({
      parentOrgId: null,
      businessId: dailygrind.business._id,
      businessName: dailygrind.business.name,
      categoryId: productQualityId,
      categoryLabel: "Product Quality",
      comment: "Pastry was a bit stale.",
      createdDaysAgo: 9,
      resolved: true,
    }),
    await createPatternCase({
      parentOrgId: null,
      businessId: dailygrind.business._id,
      businessName: dailygrind.business.name,
      categoryId: productQualityId,
      categoryLabel: "Product Quality",
      comment: "Coffee tasted weaker than usual.",
      createdDaysAgo: 6,
      resolved: true,
    }),
  ];
  await RecurringIssueFlag.create({
    ownerScope: "business",
    ownerScopeId: dailygrind.business._id,
    categoryId: productQualityId,
    caseIds: dailygrindPatternCases.map((c) => c._id),
    businessIds: [dailygrind.business._id],
    count: dailygrindPatternCases.length,
    windowDays: 14,
    firstCaseAt: daysAgo(12),
    lastCaseAt: daysAgo(6),
    status: "dismissed",
    dismissedAt: daysAgo(5),
  });
  result.recurringIssueFlags++;

  // D. An initiative created independently, with no linked cases at all —
  // Improvement Initiatives don't require a Recurring Issue flag to start.
  await ImprovementInitiative.create({
    parentOrgId: brightfuture.org._id,
    businessId: null,
    title: "Monthly parent newsletter for all campuses",
    description:
      "A proactive initiative to lift Communication scores by giving every campus a consistent monthly update to families, ahead of any specific complaint pattern.",
    ownerId: brightfuture.teamStaff[2]._id,
    affectedBusinessIds: brightfuture.branches.map((b) => b.business._id),
    linkedActionIds: [],
    status: "planned",
    baselineMetricDescription: "Average Communication rating",
    baselineValue: 3.2,
    targetValue: 4.0,
    startedAt: null,
    completedAt: null,
  });
  result.improvementInitiatives++;

  // 10. Billing — a mix of active, overdue, comp, and no-subscription states.
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
      await Invoice.create({
        subscriptionId: sub._id,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        amount: params.mrrValue,
        currency: "usd",
        status: "paid",
        paymentMethodLast4: "4242",
        issuedAt: daysAgo(30 * (i + 1)),
      });
      result.invoices++;
    }
    if (params.failedInvoice) {
      await Invoice.create({
        subscriptionId: sub._id,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        amount: params.mrrValue,
        currency: "usd",
        status: "failed",
        paymentMethodLast4: "4242",
        issuedAt: daysAgo(3),
      });
      result.invoices++;
    }
  }

  await addSubscription({ ownerType: "parentOrg", ownerId: meridian.org._id, plan: "business_monthly", mrrValue: 899, status: "active", paidInvoices: 3 });
  await addSubscription({ ownerType: "parentOrg", ownerId: brightfuture.org._id, plan: "business_monthly", mrrValue: 599, status: "overdue", paidInvoices: 1, failedInvoice: true });
  await markOwnerComp({ ownerType: "parentOrg", ownerId: precisiondx.org._id.toString(), period: "unlimited" });
  result.billingSubscriptions++;
  await addSubscription({ ownerType: "parentOrg", ownerId: urbanmart.org._id, plan: "business_yearly", mrrValue: 1299, status: "active", paidInvoices: 3 });

  const stemAcademy = brightfuture.branches.find((b) => b.business.name === "Bright Future STEM Academy")!;
  await addSubscription({ ownerType: "business", ownerId: stemAcademy.business._id, plan: "business_monthly", mrrValue: 149, status: "active", paidInvoices: 2 });

  await markOwnerComp({ ownerType: "business", ownerId: dailygrind.business._id.toString(), period: "30_days" });
  result.billingSubscriptions++;
  const spiceroute = standaloneInfoByKey.get("spiceroute")!;
  await addSubscription({ ownerType: "business", ownerId: spiceroute.business._id, plan: "business_monthly", mrrValue: 79, status: "active", paidInvoices: 2 });
  await addSubscription({ ownerType: "business", ownerId: zenith.business._id, plan: "business_monthly", mrrValue: 99, status: "active", paidInvoices: 1 });
  // QuickFix Auto Service intentionally has no subscription yet — demonstrates the "start checkout" empty state.

  // 11. A couple of feedback-point requests and marketing demo requests, so
  // Admin's inbox-style pages aren't empty either.
  await FeedbackPointRequest.create({
    businessId: urbanmart.branches[0].business._id,
    requestedByUserId: urbanmart.branches[0].ownerUser._id,
    note: "Could we get a second feedback point set up at our new checkout lanes?",
    status: "pending",
  });
  result.feedbackPointRequests++;
  await FeedbackPointRequest.create({
    businessId: zenith.business._id,
    requestedByUserId: zenith.ownerUser._id,
    note: "We've added a new studio room and would like a feedback point there too.",
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

  // 12. AI Insights: sample reports across every cadence, in both pending
  // and approved states, so Admin's review queue and every dashboard's
  // Insights tab have example content to preview instead of sitting empty
  // until the real Claude Batch API pipeline (spec Section 10) runs.
  // Star average and NPS are always reported as separate figures here,
  // never blended into one number, per the known bug this rebuild fixes.
  async function addAiReport(params: {
    ownerType: "business" | "parentOrg";
    ownerId: Types.ObjectId;
    period: AiReportPeriod;
    offset?: number;
    bodyMarkdown: string;
    status?: AiReportStatus;
    showChartOnDashboard?: boolean;
  }) {
    const { start, end } = periodRange(params.period, params.offset ?? 0);
    const status = params.status ?? "approved";
    await AiInsightReport.findOneAndUpdate(
      { ownerType: params.ownerType, ownerId: params.ownerId, period: params.period, periodStart: start },
      {
        $set: {
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          period: params.period,
          periodStart: start,
          periodEnd: end,
          bodyMarkdown: params.bodyMarkdown,
          status,
          showChartOnDashboard: params.showChartOnDashboard ?? true,
          generatedAt: daysAgo(1),
          reviewedAt: status === "pending" ? null : daysAgo(1),
          reviewedBy: status === "pending" ? null : adminUserId ?? null,
        },
      },
      { upsert: true }
    );
    result.aiInsightReports++;
  }

  // Meridian Bank Group (parentOrg) — approved, all four cadences.
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    period: "weekly",
    bodyMarkdown:
      "Meridian Bank Group collected 47 responses this week across all 3 branches (Downtown, Riverside, Uptown). Average star rating was 4.6/5, up slightly from 4.5 last week. Net Promoter Score was 58 (reported separately from the star average, as these measure different things), based on 31 respondents who answered the recommendation question. Downtown continues to lead on speed of service. Uptown's wait-time score dipped to 3.9, which triggered one alert already actioned by the regional ops lead. With only 47 responses spread across three branches, week-over-week branch comparisons should be read as directional rather than conclusive — low-confidence given the sample size.",
  });
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    period: "monthly",
    bodyMarkdown:
      "In the past month, Meridian Bank Group collected 203 responses across all branches. Average star rating held steady at 4.6/5. Net Promoter Score rose to 61 (up from 54 last month), based on 128 respondents. Riverside branch had the strongest month, with cleanliness and staff friendliness both above 4.8/5. Uptown's wait-time concerns from earlier in the month were resolved after a staffing change — its score recovered to 4.4/5 by month's end. 4 cases were raised in Case Management this month; 3 are resolved, 1 remains open past its due date and is flagged for regional ops follow-up.",
  });
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    period: "quarterly",
    bodyMarkdown:
      "Over the past quarter, Meridian Bank Group collected 612 responses. Average star rating improved from 4.4/5 to 4.6/5 across the quarter. Net Promoter Score improved from 49 to 60. All three branches are now in the \"Responding\" to \"Improving\" range on CX Pulse, up from \"Reacting\" last quarter — driven mainly by faster median time-to-resolution on flagged feedback (down from 4.1 days to 1.8 days). Riverside is the standout performer; Uptown remains the branch most in need of continued attention on wait times, though its trend line is positive.",
  });
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    period: "yearly",
    bodyMarkdown:
      "Across the past year, Meridian Bank Group collected 2,340 responses spanning all 3 branches. Average star rating rose from 4.2/5 to 4.6/5. Net Promoter Score rose from 38 to 60 — a 22-point improvement, driven primarily by faster complaint resolution and the introduction of category-owner routing in Q2. CX Pulse maturity moved the group from \"Reacting\" to \"Improving\" overall, with Riverside individually reaching \"Embedded\". The clearest opportunity for next year is closing the gap between Uptown and the other two branches, which remains the group's most volatile location on wait-time feedback.",
  });

  // Spice Route (standalone business) — approved, all four cadences.
  await addAiReport({
    ownerType: "business",
    ownerId: spiceroute.business._id,
    period: "weekly",
    bodyMarkdown:
      "Spice Route collected 18 responses this week. Average star rating was 4.5/5. Net Promoter Score was 47, based on 11 respondents who answered the recommendation question. Comments were largely positive about food quality; one response flagged a long wait at peak dinner service, which has been added as a case in Case Management. With only 18 responses this week, this summary should be treated as a low-confidence early read rather than a firm trend.",
  });
  await addAiReport({
    ownerType: "business",
    ownerId: spiceroute.business._id,
    period: "monthly",
    bodyMarkdown:
      "Over the past month, Spice Route collected 74 responses. Average star rating was 4.6/5, consistent with last month. Net Promoter Score was 52, up from 44. Food quality and staff friendliness remain the two highest-rated categories; wait time at peak hours remains the most frequently mentioned area for improvement, appearing in roughly 1 in 6 responses.",
  });
  await addAiReport({
    ownerType: "business",
    ownerId: spiceroute.business._id,
    period: "quarterly",
    bodyMarkdown:
      "Over the past quarter, Spice Route collected 218 responses. Average star rating improved from 4.3/5 to 4.6/5. Net Promoter Score improved from 38 to 52. The business moved from \"Responding\" to \"Improving\" on CX Pulse this quarter, with the clearest gain coming from consistently acting on wait-time feedback — 6 of 7 flagged items this quarter were resolved within a week.",
  });
  await addAiReport({
    ownerType: "business",
    ownerId: spiceroute.business._id,
    period: "yearly",
    bodyMarkdown:
      "Across the past year, Spice Route collected 860 responses. Average star rating rose from 4.1/5 to 4.6/5. Net Promoter Score rose from 29 to 52. The business has been on a consistent upward trend every quarter, with no single quarter showing regression — the most sustained improvement of any standalone business in this showcase dataset.",
  });

  // Pending — awaiting Admin review, to populate the AI Insights Queue's
  // default "Pending" tab with realistic unreviewed drafts.
  await addAiReport({
    ownerType: "business",
    ownerId: zenith.business._id,
    period: "weekly",
    status: "pending",
    bodyMarkdown:
      "Zenith Fitness collected 22 responses this week. Average star rating was 4.3/5. Net Promoter Score was 41, based on 14 respondents. Several comments mentioned the new studio room positively; two responses flagged locker room cleanliness on weekend mornings. Draft — please review the locker room framing before approving, and confirm the weekend-only pattern holds once more data comes in.",
  });
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: urbanmart.org._id,
    period: "monthly",
    status: "pending",
    bodyMarkdown:
      "Over the past month, UrbanMart Retail collected 156 responses across all 3 stores. Average star rating was 4.1/5. Net Promoter Score was 33, based on 98 respondents. Value-for-money comments were mixed this month following a price change — draft flags this as worth a closer look before publishing, since it's a shift from prior months' tone and may need a supporting chart.",
  });

  // Rejected — shows the queue's "Rejected" tab with a real example of why
  // a draft might not pass review (numbers didn't reconcile with responses).
  await addAiReport({
    ownerType: "parentOrg",
    ownerId: precisiondx.org._id,
    period: "quarterly",
    status: "rejected",
    bodyMarkdown:
      "Draft rejected by Admin: the NPS figure in the generated draft did not reconcile with the underlying response counts for this period (likely a batch-window boundary issue) — regenerate once the pipeline's period-boundary fix ships rather than editing by hand.",
  });

  // 12b. Quarterly CX Pulse self-assessment for a couple of owners, then
  // recompute every CX Pulse score from the real data just seeded.
  const pulseAnswerValues = [
    "Weekly, in our Monday ops review.",
    "Our regional CX lead.",
    "Added a same-day callback step for low ratings.",
    "Fairly confident.",
  ];
  await CxPulsePulseResponse.findOneAndUpdate(
    { ownerType: "parentOrg", ownerId: meridian.org._id, quarter: currentQuarterLabel() },
    {
      $set: {
        ownerType: "parentOrg",
        ownerId: meridian.org._id,
        quarter: currentQuarterLabel(),
        answers: DEFAULT_CX_PULSE_QUESTIONS.map((question, i) => ({ question, answer: pulseAnswerValues[i] ?? "" })),
      },
    },
    { upsert: true }
  );

  await recomputeAllCxPulseScores();

  // 13. CX Goals — a mix of active/on-track, active/behind-pace, and
  // achieved, across an org and a couple of standalone businesses, so the
  // CX Goals card never shows an empty state in the showcase.
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
  }) {
    await CxGoal.findOneAndUpdate(
      { ownerType: params.ownerType, ownerId: params.ownerId, label: params.label },
      {
        $set: {
          ownerType: params.ownerType,
          ownerId: params.ownerId,
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

  await addGoal({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    label: "Lift overall score network-wide",
    metric: "starAverage",
    startValue: 4.1,
    targetValue: 4.5,
    targetDate: daysAgo(-60),
    status: "active",
    createdBy: meridian.teamStaff[0]._id,
  });
  await addGoal({
    ownerType: "parentOrg",
    ownerId: meridian.org._id,
    label: "Improve staff friendliness across branches",
    metric: "categoryAverage",
    categoryId: categoryByName.get("Staff Friendliness"),
    startValue: 3.8,
    targetValue: 4.3,
    targetDate: daysAgo(-30),
    status: "active",
    createdBy: meridian.teamStaff[0]._id,
  });
  await addGoal({
    ownerType: "business",
    ownerId: dailygrind.business._id,
    label: "Raise NPS above 50",
    metric: "nps",
    startValue: 38,
    targetValue: 50,
    targetDate: daysAgo(-45),
    status: "active",
    createdBy: dailygrind.ownerUser._id,
  });
  await addGoal({
    ownerType: "business",
    ownerId: zenith.business._id,
    label: "Clear the overdue action backlog",
    metric: "overdueActionsCount",
    startValue: 6,
    targetValue: 0,
    targetDate: daysAgo(10), // already past — demonstrates a "missed" goal
    status: "missed",
    createdBy: zenith.ownerUser._id,
  });
  await addGoal({
    ownerType: "business",
    ownerId: dailygrind.business._id,
    label: "Reach CX Pulse Level 3 (Improving)",
    metric: "cxPulseLevel",
    startValue: 2,
    targetValue: 3,
    targetDate: daysAgo(5),
    status: "achieved",
    createdBy: dailygrind.ownerUser._id,
  });

  // 14. Playbook run history, linked to real Case Management cases via
  // actionBoardItemId — otherwise every case on the live Case Management
  // page shows "No playbook set" even though playbooks/runs exist, since
  // the page joins runs to cases on actionBoardItemId (see caseStats.ts's
  // attachPlaybookRunsToItems). Idempotent: cases are upserted by
  // title+businessId, runs by playbookId+actionBoardItemId.
  const staffFriendlinessCategoryId = categoryByName.get("Staff Friendliness")!;
  const serviceSpeedCategoryId = categoryByName.get("Service Speed")!;
  const productQualityCategoryId = categoryByName.get("Product Quality")!;

  const meridianDowntown = meridian.branches.find((b) => b.business.name === "Meridian Bank – Downtown")!;
  const meridianUptown = meridian.branches.find((b) => b.business.name === "Meridian Bank – Uptown")!;
  const meridianAirportRoad = meridian.branches.find((b) => b.business.name === "Meridian Bank – Airport Road")!;

  const staffFriendlinessOwnerId = await ownerForCategory("parentOrg", meridian.org._id, staffFriendlinessCategoryId);
  const productQualityOwnerId = await ownerForCategory("business", dailygrind.business._id, productQualityCategoryId);

  /** Upserts one demo Case (ActionBoardItem) plus the PlaybookRun attached to it, and links them via actionBoardItemId. */
  async function addCaseWithRun(params: {
    parentOrgId: Types.ObjectId | null;
    businessId: Types.ObjectId;
    title: string;
    description: string;
    categoryId: Types.ObjectId;
    priority: ActionPriority;
    status: "open" | "in_progress" | "resolved";
    ownerId: Types.ObjectId | null;
    createdAt: Date;
    resolvedAt?: Date | null;
    resolutionNote?: string;
    playbook: InstanceType<typeof Playbook>;
    playbookOwnerType: "business" | "parentOrg";
    playbookOwnerId: Types.ObjectId;
    runStartedAt: Date;
    runCompletedAt: Date | null;
    runStatus: "active" | "completed" | "abandoned";
    completedStepIndexes: number[];
    attachReason: string;
  }) {
    const isNewItem = !(await ActionBoardItem.exists({ title: params.title, businessId: params.businessId }));
    const item = await ActionBoardItem.findOneAndUpdate(
      { title: params.title, businessId: params.businessId },
      {
        $set: {
          parentOrgId: params.parentOrgId,
          description: params.description,
          categoryId: params.categoryId,
          priority: params.priority,
          status: params.status,
          ownerId: params.ownerId,
          dueDate: params.status === "resolved" ? null : daysAgo(-randomInt(2, 10)),
          sourceResponseIds: [],
          resolutionNote: params.resolutionNote ?? "",
          resolvedAt: params.resolvedAt ?? null,
          source: params.ownerId ? "auto_assigned" : "auto_suggested",
          createdAt: params.createdAt,
        },
      },
      { upsert: true, new: true }
    );
    if (isNewItem) result.actionBoardItems++;

    const isNewRun = !(await PlaybookRun.exists({ playbookId: params.playbook._id, actionBoardItemId: item._id }));
    await PlaybookRun.findOneAndUpdate(
      { playbookId: params.playbook._id, actionBoardItemId: item._id },
      {
        $set: {
          ownerType: params.playbookOwnerType,
          ownerId: params.playbookOwnerId,
          actionBoardItemId: item._id,
          attachReason: params.attachReason,
          steps: params.playbook.steps,
          completedStepIndexes: params.completedStepIndexes,
          status: params.runStatus,
          startedAt: params.runStartedAt,
          completedAt: params.runCompletedAt,
        },
      },
      { upsert: true, new: true }
    );
    if (isNewRun) {
      result.playbookRuns++;
      if (params.runStatus === "completed") {
        await Playbook.updateOne({ _id: params.playbook._id }, { $inc: { usageCount: 1 } });
      }
    }
    return item;
  }

  const staffFriendlinessAutoAttachReason = "Auto-attached — this is the standard playbook for Staff Friendliness cases.";

  // Airport Road — the original completed run from earlier seed passes, now
  // linked to a resolved case instead of floating unattached.
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianAirportRoad.business._id,
    title: `Staff Friendliness concern reported at ${meridianAirportRoad.business.name}`,
    description: "Respondent comment: \"Teller was curt and seemed annoyed when I asked a follow-up question.\"",
    categoryId: staffFriendlinessCategoryId,
    priority: "medium",
    status: "resolved",
    ownerId: staffFriendlinessOwnerId,
    createdAt: daysAgo(18),
    resolvedAt: daysAgo(11),
    resolutionNote: "Coached the teller one-on-one and re-checked the branch's friendliness score two weeks later — back above target.",
    playbook: staffFriendlinessPlaybook,
    playbookOwnerType: "parentOrg",
    playbookOwnerId: meridian.org._id,
    runStartedAt: daysAgo(18),
    runCompletedAt: daysAgo(11),
    runStatus: "completed",
    completedStepIndexes: staffFriendlinessPlaybook.steps.map((_: string, i: number) => i),
    attachReason: staffFriendlinessAutoAttachReason,
  });

  // Downtown — the same playbook run 3 times for the same branch within the
  // last 30 days, so countOwnerRunsLast30d (playbookUsage.ts) returns >= 3
  // and the "pattern nudge" banner has something real to show.
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianDowntown.business._id,
    title: `Staff Friendliness concern reported at ${meridianDowntown.business.name} (teller line)`,
    description: "Respondent comment: \"Felt rushed and wasn't greeted at the teller line.\"",
    categoryId: staffFriendlinessCategoryId,
    priority: "medium",
    status: "in_progress",
    ownerId: staffFriendlinessOwnerId,
    createdAt: daysAgo(22),
    playbook: staffFriendlinessPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: meridianDowntown.business._id,
    runStartedAt: daysAgo(22),
    runCompletedAt: null,
    runStatus: "active",
    completedStepIndexes: [0],
    attachReason: staffFriendlinessAutoAttachReason,
  });
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianDowntown.business._id,
    title: `Staff Friendliness concern reported at ${meridianDowntown.business.name} (drive-through)`,
    description: "Respondent comment: \"Drive-through staff member was short with me over the intercom.\"",
    categoryId: staffFriendlinessCategoryId,
    priority: "medium",
    status: "in_progress",
    ownerId: staffFriendlinessOwnerId,
    createdAt: daysAgo(12),
    playbook: staffFriendlinessPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: meridianDowntown.business._id,
    runStartedAt: daysAgo(12),
    runCompletedAt: null,
    runStatus: "active",
    completedStepIndexes: [0, 1],
    attachReason: staffFriendlinessAutoAttachReason,
  });
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianDowntown.business._id,
    title: `Staff Friendliness concern reported at ${meridianDowntown.business.name} (new accounts desk)`,
    description: "Respondent comment: \"New accounts rep barely made eye contact the whole time.\"",
    categoryId: staffFriendlinessCategoryId,
    priority: "high",
    status: "resolved",
    ownerId: staffFriendlinessOwnerId,
    createdAt: daysAgo(4),
    resolvedAt: daysAgo(1),
    resolutionNote: "Coached the rep and confirmed with the customer that the follow-up visit went well.",
    playbook: staffFriendlinessPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: meridianDowntown.business._id,
    runStartedAt: daysAgo(4),
    runCompletedAt: daysAgo(1),
    runStatus: "completed",
    completedStepIndexes: staffFriendlinessPlaybook.steps.map((_: string, i: number) => i),
    attachReason: staffFriendlinessAutoAttachReason,
  });

  // Uptown — one abandoned run, so the demo shows that state too, not just
  // active/completed.
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianUptown.business._id,
    title: `Staff Friendliness concern reported at ${meridianUptown.business.name}`,
    description: "Respondent comment: \"Staff member seemed distracted and didn't answer my question.\"",
    categoryId: staffFriendlinessCategoryId,
    priority: "low",
    status: "open",
    ownerId: staffFriendlinessOwnerId,
    createdAt: daysAgo(9),
    playbook: staffFriendlinessPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: meridianUptown.business._id,
    runStartedAt: daysAgo(9),
    runCompletedAt: daysAgo(6),
    runStatus: "abandoned",
    completedStepIndexes: [0],
    attachReason: staffFriendlinessAutoAttachReason,
  });

  // Uptown — a different playbook (Service Speed), so the demo shows
  // playbook variety across categories, not just one repeated example.
  await addCaseWithRun({
    parentOrgId: meridian.org._id,
    businessId: meridianUptown.business._id,
    title: `Service Speed concern reported at ${meridianUptown.business.name}`,
    description: "Respondent comment: \"Waited almost 20 minutes just to speak with a teller.\"",
    categoryId: serviceSpeedCategoryId,
    priority: "medium",
    status: "in_progress",
    ownerId: meridian.teamStaff[2]._id,
    createdAt: daysAgo(6),
    playbook: serviceSpeedPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: meridianUptown.business._id,
    runStartedAt: daysAgo(6),
    runCompletedAt: null,
    runStatus: "active",
    completedStepIndexes: [0],
    attachReason: "Auto-attached — this is the standard playbook for Service Speed cases.",
  });

  // Daily Grind — the original active run from earlier seed passes, now
  // linked to a real in-progress case.
  await addCaseWithRun({
    parentOrgId: null,
    businessId: dailygrind.business._id,
    title: `Product Quality concern reported at ${dailygrind.business.name}`,
    description: "Respondent comment: \"Sandwich was cold and the bread was stale.\"",
    categoryId: productQualityCategoryId,
    priority: "medium",
    status: "in_progress",
    ownerId: productQualityOwnerId,
    createdAt: daysAgo(2),
    playbook: foodQualityPlaybook,
    playbookOwnerType: "business",
    playbookOwnerId: dailygrind.business._id,
    runStartedAt: daysAgo(2),
    runCompletedAt: null,
    runStatus: "active",
    completedStepIndexes: [0],
    attachReason: "Auto-attached — this is the standard playbook for Product Quality cases.",
  });

  // 15. Sample Audit Log entries — enough for the Admin viewer to show real
  // rows across the action types logAuditEvent is actually called with,
  // rather than an empty table until someone happens to trigger one.
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
        targetType: "Business",
        targetLabel: dailygrind.business.name,
        before: null,
        after: { period: "unlimited" },
        createdAt: daysAgo(14),
      },
      {
        action: "user.email_changed",
        targetType: "User",
        targetLabel: meridian.teamStaff[0].email,
        before: { email: "old.contact@showcase.oodel.test" },
        after: { email: meridian.teamStaff[0].email },
        createdAt: daysAgo(20),
      },
      {
        action: "team_member.access_tier_changed",
        targetType: "User",
        targetLabel: dailygrind.teamFull!.email,
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

  return result;
}

function currentQuarterLabel(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
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

  async function del(name: string, fn: () => Promise<{ deletedCount?: number }>) {
    const res = await fn();
    counts[name] = res.deletedCount ?? 0;
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
  await del("businesses", () => Business.deleteMany({}));
  await del("parentOrgs", () => ParentOrganization.deleteMany({}));
  await del("users", () => User.deleteMany({ accountType: { $ne: "admin_staff" } }));

  return counts;
}
