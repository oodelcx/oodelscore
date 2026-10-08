import type { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { CxPulsePulseResponse } from "../models/CxPulsePulseResponse";
import { AiInsightReport, type AiReportPeriod } from "../models/AiInsightReport";
import type { Product } from "../models/products";
import { currentQuarterLabel, pulseQuestionsFor } from "../cxpulse/selfAssessment";
import { getCxPulseFrameworkOrDefault, recomputeAllCxPulseScores } from "../cxpulse/compute";

/**
 * Last pass of every demo seed. Walks every account that exists and fills
 * whatever the earlier layers left empty, so no screen in a demo is blank:
 *
 *  1. Logins: any demo login that never "signed in" gets a recent sign-in,
 *     because CX Pulse Awareness is measured from login recency.
 *  2. Quarterly self-assessment answered for every group and standalone
 *     business, for each product it runs (feeds the Culture dimension).
 *  3. Business Value inputs for every business that has none.
 *  4. Approved AI Insights reports (weekly + monthly) for any owner and
 *     product that has none (skipped by the full showcase, which generates
 *     real ones right after).
 *  5. CX Pulse recomputed, so Overview and CX Pulse show a level for every
 *     account in both the Customer and Colleague views.
 *
 * Idempotent: every write is "insert if missing".
 */
export interface DemoFinishResult {
  loginsRefreshed: number;
  selfAssessments: number;
  valueInputs: number;
  insightReports: number;
}

const DAY = 24 * 60 * 60 * 1000;

const CX_ANSWERS = [
  "Weekly, in our Monday operations review.",
  "Our regional operations lead, with branch managers owning their own cases.",
  "Added a same-day callback for low ratings and a named owner for each category.",
  "Fairly confident. Scores in the categories we changed have moved up.",
];
const CE_ANSWERS = [
  "Monthly, in the leadership meeting, with a short note to all staff afterwards.",
  "The people operations lead, who reports themes back without any names.",
  "Published rotas earlier and fixed the break rooms that staff kept raising.",
  "Quite confident. Response rates are rising, which suggests people trust it.",
];

const VALUE_BY_INDUSTRY: Record<string, { avg: number; visits: number; cac: number; symbol: string }> = {
  Banking: { avg: 340, visits: 6, cac: 420, symbol: "$" },
  Healthcare: { avg: 95, visits: 3, cac: 140, symbol: "$" },
  Education: { avg: 2400, visits: 1, cac: 600, symbol: "$" },
  Restaurant: { avg: 38, visits: 9, cac: 25, symbol: "$" },
  Telecommunications: { avg: 55, visits: 12, cac: 180, symbol: "$" },
  Aviation: { avg: 310, visits: 3, cac: 90, symbol: "$" },
};

function reportBody(params: { name: string; product: Product; period: AiReportPeriod }): string {
  const who = params.product === "colleague_experience" ? "your colleagues" : "your customers";
  const window = params.period === "weekly" ? "this week" : "this month";
  const topic = params.product === "colleague_experience" ? "management support, rotas and recognition" : "service speed, staff friendliness and cleanliness";
  return [
    `## ${params.name}: what ${who} told you ${window}`,
    "",
    `**Headline.** Overall sentiment held steady ${window}, with the strongest feedback on ${topic}.`,
    "",
    "**What improved**",
    "- Scores in the categories where an improvement initiative is running moved up compared with the previous period.",
    "- Cases opened from low ratings were picked up faster than last period.",
    "",
    "**What needs attention**",
    "- One category keeps recurring across several locations. It is the best candidate for a group-wide initiative.",
    "- A small number of cases are close to their due date. Check the Attention Centre first.",
    "",
    "**Suggested next steps**",
    "1. Review the recurring category and decide whether to turn it into an Improvement Initiative.",
    "2. Close the loop with the people who raised the most recent low scores.",
    "3. Re-check the same categories next period to confirm the change held.",
  ].join("\n");
}

export async function seedDemoFinish(options: { insightReports?: boolean } = {}): Promise<DemoFinishResult> {
  const result: DemoFinishResult = { loginsRefreshed: 0, selfAssessments: 0, valueInputs: 0, insightReports: 0 };
  const now = Date.now();

  // 1. Logins
  const stale = await User.find({
    accountType: { $in: ["business", "parent_org", "team_member"] },
    lastLoginAt: null,
  }).select("_id");
  for (const u of stale) {
    await User.updateOne({ _id: u._id }, { $set: { lastLoginAt: new Date(now - Math.floor(Math.random() * 6 + 1) * DAY) } });
    result.loginsRefreshed++;
  }

  const framework = await getCxPulseFrameworkOrDefault();
  const quarter = currentQuarterLabel();

  const orgs = await ParentOrganization.find().select("_id name enabledProducts");
  const standalone = await Business.find({ parentOrgId: null, active: true }).select("_id name industry enabledProducts");

  // 2. Quarterly self-assessments
  const owners: { ownerType: "parentOrg" | "business"; id: Types.ObjectId; name: string; products: Product[] }[] = [
    ...orgs.map((o) => ({ ownerType: "parentOrg" as const, id: o._id, name: o.name, products: (o.enabledProducts ?? ["customer_experience"]) as Product[] })),
    ...standalone.map((b) => ({ ownerType: "business" as const, id: b._id, name: b.name, products: (b.enabledProducts ?? ["customer_experience"]) as Product[] })),
  ];
  for (const owner of owners) {
    for (const product of owner.products) {
      const questions = pulseQuestionsFor(framework, product);
      if (questions.length === 0) continue;
      const answers = (product === "colleague_experience" ? CE_ANSWERS : CX_ANSWERS).slice(0, questions.length);
      const existing = await CxPulsePulseResponse.findOne({ ownerType: owner.ownerType, ownerId: owner.id, product, quarter }).select("_id");
      if (existing) continue;
      await CxPulsePulseResponse.create({
        ownerType: owner.ownerType,
        ownerId: owner.id,
        product,
        quarter,
        answers: questions.map((question, i) => ({ question, answer: answers[i] ?? answers[answers.length - 1] })),
      });
      result.selfAssessments++;
    }
  }

  // 3. Business Value inputs for every business without them
  const businesses = await Business.find({ active: true }).select("_id industry businessValueInputs");
  for (const b of businesses) {
    const v = b.businessValueInputs;
    if (v && v.avgTransactionValue !== null && v.visitsPerYear !== null && v.acquisitionCost !== null) continue;
    const preset = VALUE_BY_INDUSTRY[b.industry] ?? { avg: 80, visits: 4, cac: 100, symbol: "$" };
    await Business.updateOne(
      { _id: b._id },
      {
        $set: {
          "businessValueInputs.avgTransactionValue": preset.avg,
          "businessValueInputs.visitsPerYear": preset.visits,
          "businessValueInputs.acquisitionCost": preset.cac,
          "businessValueInputs.atRiskStarThreshold": 2,
          "businessValueInputs.currencySymbol": preset.symbol,
        },
      }
    );
    result.valueInputs++;
  }

  // 4. Approved AI Insights reports
  const allOwners = options.insightReports === false ? [] : owners;
  for (const owner of allOwners) {
    for (const product of owner.products) {
      for (const period of ["weekly", "monthly"] as AiReportPeriod[]) {
        const days = period === "weekly" ? 7 : 30;
        const periodEnd = new Date(now - 1 * DAY);
        const periodStart = new Date(periodEnd.getTime() - days * DAY);
        const exists = await AiInsightReport.findOne({ ownerType: owner.ownerType, ownerId: owner.id, product, period }).select("_id");
        if (exists) continue;
        await AiInsightReport.create({
          ownerType: owner.ownerType,
          ownerId: owner.id,
          product,
          period,
          periodStart,
          periodEnd,
          bodyMarkdown: reportBody({ name: owner.name, product, period }),
          status: "approved",
          showChartOnDashboard: true,
          generatedAt: periodEnd,
          reviewedAt: periodEnd,
        });
        result.insightReports++;
      }
    }
  }

  // 5. Pulse scores, last, so they see everything above
  await recomputeAllCxPulseScores();

  return result;
}
