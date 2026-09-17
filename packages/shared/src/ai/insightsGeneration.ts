import Anthropic from "@anthropic-ai/sdk";
import { Types } from "mongoose";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { AiInsightReport, AI_REPORT_PERIODS, type AiReportPeriod } from "../models/AiInsightReport";
import { computeBusinessMetrics, type BusinessMetrics } from "../scoring/aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * CX Pulse / Act layer roadmap, spec Section 10 (AI Insights generation).
 *
 * One deliberate deviation from the written spec, matching the precedent
 * every other AI call site in this codebase already set (see rootCause.ts's
 * own comment): this uses the regular synchronous Messages API, not the
 * Batch API. The spec calls for Batch API purely as a cost optimization for
 * a bulk multi-owner job — but every other AI feature here (triage,
 * root-cause, theme/sentiment) already uses the synchronous API for
 * simplicity and consistency, and this codebase's actual data volume (a
 * handful of businesses/orgs per period) makes Batch's ~50% saving trivial
 * in absolute terms while its async submit-then-poll lifecycle would add
 * real complexity — a second cron endpoint, a job-tracking collection, and
 * a delay before Admin's queue reflects anything. If real usage ever grows
 * into hundreds of owners, that trade-off is worth revisiting.
 */

// ---- Date/period math -------------------------------------------------

function startOfWeekUTC(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // days back to the Monday of this week
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

/** Which report periods are "due" on a given calendar day, UTC. */
export function duePeriodsFor(date: Date): AiReportPeriod[] {
  const due: AiReportPeriod[] = [];
  if (date.getUTCDay() === 1) due.push("weekly"); // Monday
  if (date.getUTCDate() === 1) {
    due.push("monthly");
    if (date.getUTCMonth() % 3 === 0) due.push("quarterly"); // Jan/Apr/Jul/Oct 1st
    if (date.getUTCMonth() === 0) due.push("yearly"); // Jan 1st
  }
  return due;
}

/**
 * The full prior period's [start, end] for `period`, relative to `asOf`
 * being any date inside the *current* period — e.g. asOf = the Monday a
 * weekly report runs on returns last Mon-Sun. Reflexive: calling this again
 * with `asOf = start` of one period returns the period immediately before
 * it, which is how the "previous period" comparison window below is built.
 */
export function periodRangeFor(period: AiReportPeriod, asOf: Date): { start: Date; end: Date } {
  switch (period) {
    case "weekly": {
      const thisWeekStart = startOfWeekUTC(asOf);
      const start = new Date(thisWeekStart.getTime() - 7 * DAY_MS);
      return { start, end: new Date(thisWeekStart.getTime() - 1) };
    }
    case "monthly": {
      const thisMonthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
      const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1));
      return { start, end: new Date(thisMonthStart.getTime() - 1) };
    }
    case "quarterly": {
      const qStartMonth = Math.floor(asOf.getUTCMonth() / 3) * 3;
      const thisQuarterStart = new Date(Date.UTC(asOf.getUTCFullYear(), qStartMonth, 1));
      const start = new Date(Date.UTC(asOf.getUTCFullYear(), qStartMonth - 3, 1));
      return { start, end: new Date(thisQuarterStart.getTime() - 1) };
    }
    case "yearly": {
      const thisYearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
      const start = new Date(Date.UTC(asOf.getUTCFullYear() - 1, 0, 1));
      return { start, end: new Date(thisYearStart.getTime() - 1) };
    }
  }
}

// ---- Owners --------------------------------------------------------

interface OwnerTarget {
  ownerType: "business" | "parentOrg";
  ownerId: Types.ObjectId;
  name: string;
  businessIds: Types.ObjectId[]; // itself, or every branch for a parentOrg
}

async function resolveOwners(): Promise<OwnerTarget[]> {
  const [standaloneBusinesses, orgs] = await Promise.all([
    Business.find({ parentOrgId: null }).select("_id name"),
    ParentOrganization.find().select("_id name"),
  ]);
  const targets: OwnerTarget[] = standaloneBusinesses.map((b) => ({
    ownerType: "business" as const,
    ownerId: b._id,
    name: b.name,
    businessIds: [b._id],
  }));
  for (const org of orgs) {
    const branches = await Business.find({ parentOrgId: org._id }).select("_id");
    if (branches.length === 0) continue;
    targets.push({ ownerType: "parentOrg", ownerId: org._id, name: org.name, businessIds: branches.map((b) => b._id) });
  }
  return targets;
}

// ---- Metrics ---------------------------------------------------------

interface PeriodMetrics extends BusinessMetrics {
  casesResolved: number;
  casesStillOpenOverdue: number;
}

/** Mirrors periods.ts's aggregateAcrossBusinesses (unweighted mean of each
 * business's own average) for consistency with the rest of the app's
 * multi-branch aggregation, plus the case counts an insight report needs
 * that periods.ts doesn't compute. */
async function computeOwnerMetrics(businessIds: Types.ObjectId[], from: Date, to: Date): Promise<PeriodMetrics> {
  const perBusiness = await Promise.all(businessIds.map((id) => computeBusinessMetrics(id, from, to)));
  const responseCount = perBusiness.reduce((sum, r) => sum + r.responseCount, 0);
  const starResults = perBusiness.filter((r) => r.starAverage !== null);
  const npsResults = perBusiness.filter((r) => r.npsScore !== null);

  const [casesResolved, casesStillOpenOverdue] = await Promise.all([
    ActionBoardItem.countDocuments({
      businessId: { $in: businessIds },
      status: "resolved",
      resolvedAt: { $gte: from, $lte: to },
    }),
    ActionBoardItem.countDocuments({
      businessId: { $in: businessIds },
      status: { $ne: "resolved" },
      dueDate: { $ne: null, $lt: to },
    }),
  ]);

  return {
    responseCount,
    starAverage:
      starResults.length === 0 ? null : Math.round((starResults.reduce((s, r) => s + (r.starAverage as number), 0) / starResults.length) * 100) / 100,
    npsScore: npsResults.length === 0 ? null : Math.round(npsResults.reduce((s, r) => s + (r.npsScore as number), 0) / npsResults.length),
    casesResolved,
    casesStillOpenOverdue,
  };
}

// ---- Narrative ---------------------------------------------------------

const PERIOD_LABEL: Record<AiReportPeriod, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

function fallbackNarrative(ownerName: string, label: string, current: PeriodMetrics, previous: PeriodMetrics): string {
  const parts: string[] = [];
  parts.push(`${ownerName} collected ${current.responseCount} response${current.responseCount === 1 ? "" : "s"} this ${label}.`);
  if (current.starAverage !== null) {
    const trend =
      previous.starAverage !== null
        ? ` (${current.starAverage >= previous.starAverage ? "up" : "down"} from ${previous.starAverage} last ${label})`
        : "";
    parts.push(`Average star rating was ${current.starAverage}/5${trend}.`);
  }
  if (current.npsScore !== null) {
    parts.push(`Net Promoter Score was ${current.npsScore}, reported separately from the star average.`);
  }
  parts.push(
    `${current.casesResolved} case${current.casesResolved === 1 ? "" : "s"} resolved in Case Management this ${label}` +
      (current.casesStillOpenOverdue > 0 ? `, ${current.casesStillOpenOverdue} still open past their due date.` : ".")
  );
  return parts.join(" ");
}

async function narrate(ownerName: string, period: AiReportPeriod, current: PeriodMetrics, previous: PeriodMetrics): Promise<string> {
  const label = PERIOD_LABEL[period];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackNarrative(ownerName, label, current, previous);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system:
        "You write a short, plain-English customer-experience performance summary for a business owner, using ONLY the numbers given to you — never invent a fact or number not present in the data. " +
        "2-4 sentences of plain prose, no markdown headers, no bullet points. " +
        "Star rating (1-5) and Net Promoter Score are separate metrics measuring different things — never average them together or imply one derives from the other. " +
        "A null metric means there wasn't enough data for it (e.g. no NPS question answered that period) — say so plainly rather than omitting it silently or inventing a number.",
      messages: [
        {
          role: "user",
          content:
            `Business/organization: ${ownerName}\nPeriod: this ${label}\n` +
            `Current period: ${JSON.stringify(current)}\nPrevious ${label} (for comparison): ${JSON.stringify(previous)}`,
        },
      ],
    });
    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    return text.trim() || fallbackNarrative(ownerName, label, current, previous);
  } catch (err) {
    console.error("[ai-insights] Claude call failed, using fallback narrative", err);
    return fallbackNarrative(ownerName, label, current, previous);
  }
}

// ---- Entry point ---------------------------------------------------------

export interface GenerateInsightsResult {
  periodsRun: AiReportPeriod[];
  reportsCreated: number;
  reportsSkipped: number; // already exists for this owner+period+periodStart, or nothing to report
}

/**
 * Generates every "pending" AiInsightReport due for `asOf` (or the given
 * `periods`, e.g. for a manual Admin-triggered run) across every owner —
 * every standalone Business and every ParentOrganization (aggregated across
 * its branches). Never touches an owner/period/periodStart combination that
 * already has a report, so re-running (the daily cron firing twice, or an
 * Admin manual run on the same day the cron already ran) is a safe no-op
 * for anything already generated.
 */
export async function generateDueInsights(asOf: Date = new Date(), periods?: AiReportPeriod[]): Promise<GenerateInsightsResult> {
  const periodsToRun = periods ?? duePeriodsFor(asOf);
  const owners = await resolveOwners();
  let reportsCreated = 0;
  let reportsSkipped = 0;

  for (const period of periodsToRun) {
    const { start, end } = periodRangeFor(period, asOf);
    const previousRange = periodRangeFor(period, start);

    for (const owner of owners) {
      const alreadyExists = await AiInsightReport.exists({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        period,
        periodStart: start,
      });
      if (alreadyExists) {
        reportsSkipped++;
        continue;
      }

      const [current, previous] = await Promise.all([
        computeOwnerMetrics(owner.businessIds, start, end),
        computeOwnerMetrics(owner.businessIds, previousRange.start, previousRange.end),
      ]);

      if (current.responseCount === 0) {
        // Nothing happened this period — not worth an Admin review or a
        // "you got 0 responses" email to the owner.
        reportsSkipped++;
        continue;
      }

      const bodyMarkdown = await narrate(owner.name, period, current, previous);

      await AiInsightReport.create({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        period,
        periodStart: start,
        periodEnd: end,
        bodyMarkdown,
        status: "pending",
        generatedAt: new Date(),
      });
      reportsCreated++;
    }
  }

  return { periodsRun: periodsToRun, reportsCreated, reportsSkipped };
}

export const ALL_AI_REPORT_PERIODS: readonly AiReportPeriod[] = AI_REPORT_PERIODS;
