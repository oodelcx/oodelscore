import { sensitiveVisibilityClause, type CaseViewer } from "../cases/sensitiveAccess";
import { Types, type FilterQuery } from "mongoose";
import { ActionBoardItem } from "../models/ActionBoardItem";
import { AlertActivity } from "../models/AlertActivity";
import { AlertRule } from "../models/AlertRule";
import { PlaybookRun } from "../models/PlaybookRun";
import { Playbook } from "../models/Playbook";
import { DecisionLogEntry, type IDecisionLogEntry } from "../models/DecisionLogEntry";
import { ImprovementInitiative, type IImprovementInitiative } from "../models/ImprovementInitiative";
import { Business } from "../models/Business";
import { ParentOrganization } from "../models/ParentOrganization";
import { User } from "../models/User";
import { Response as FeedbackResponse } from "../models/Response";
import type { BillingOwnerType } from "../models/BillingSubscription";
import type { Product } from "../models/products";

/**
 * Attention Centre: "what needs a human right now," built entirely from
 * data this app already collects (Cases, Alerts, Playbook Runs, Decision
 * Log, Improvement Initiatives) — no new data source, no AI ranking.
 * Deliberately NOT a duplicate of Command Center (that stays the KPI/trend
 * page) or Alerts (that stays the raw feed this reads FROM, not a second
 * page someone has to separately check).
 *
 * Sort order is fixed and deterministic, never AI-scored: severity band
 * first (critical > high > medium > low), then unassigned before assigned
 * within that band, then longest-waiting first. An item's severity is
 * decided entirely by which rule surfaced it — never by an LLM's opinion of
 * how bad it is.
 */

export const ATTENTION_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type AttentionSeverity = (typeof ATTENTION_SEVERITIES)[number];

export const ATTENTION_KINDS = [
  "overdue_escalated_case",
  "overdue_case",
  "escalation_deadline_approaching",
  "stalled_sensitive_case",
  "awaiting_customer_reply",
  "alert_fired",
  "stalled_playbook",
  "decision_ready_for_review",
  "initiative_not_started",
] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  what: string;
  where: string;
  who: string;
  whyNow: string;
  actionLabel: string;
  actionHref: string;
  at: string; // ISO — the timestamp this item's "why now" is measured from
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;

const ALERT_WINDOW_DAYS = 3;
const SENSITIVE_STALE_HOURS = 48;
const NEGATIVE_STAR_THRESHOLD = 2;
const PLAYBOOK_STALL_DAYS = 7;
const DECISION_REVIEW_WINDOW_DAYS = 14;
const INITIATIVE_STALL_DAYS = 14;
// A case's escalation SLA is "approaching" once it's within this many hours
// of the auto-escalation cron bumping it a level — same threshold either
// side of "still fine" vs. "about to move," not configurable per account.
const ESCALATION_DEADLINE_WARNING_HOURS = 6;

function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
}

export interface AttentionCentreParams {
  // Who is looking: Sensitive cases appear only for their confidential contact (see cases/sensitiveAccess).
  caseViewer: CaseViewer;
  // Cases and Alerts always live on the businesses themselves — every
  // business this owner can see them for (just [businessId] for a
  // standalone business or a single branch; every branch's id for a group).
  businessIds: Types.ObjectId[];
  // Decision Log / Improvement Initiatives are owner-scoped, and a BRANCH's
  // own entries live under its parent org (filtered to affectedBusinessIds),
  // not under the branch's own businessId — see DecisionLogEntry's model
  // comment and /api/business/decision-log's isBranch branch. Callers pass
  // the exact same filter their existing branch-aware GET route already
  // builds, so this never has to re-derive that branching logic itself.
  decisionLogFilter: FilterQuery<IDecisionLogEntry>;
  initiativeFilter: FilterQuery<IImprovementInitiative>;
  // Playbook Runs are tagged with the BillingOwnerType that authored the
  // Playbook — for a branch that's its parent org, same reasoning as above.
  playbookRunOwnerType: BillingOwnerType;
  playbookRunOwnerId: Types.ObjectId;
  // When set (a branch calling this), a stalled run only surfaces if it's
  // tied to a case belonging to one of these businesses — an org-wide
  // ad-hoc run (no linked case) is the org's to see, not a single branch's.
  // Left null for a standalone business or the org's own /group view, where
  // every stalled run at that owner is relevant.
  restrictPlaybookRunsToBusinessIds: Types.ObjectId[] | null;
  product: Product;
  // "/business" or "/group" — which portal's routes the action links point
  // into. Independent of where the underlying data lives (see above).
  portalPrefix: "/business" | "/group";
  // Shown as the "where" for owner-level items (Decision Log, Initiatives,
  // an ad-hoc Playbook run) that aren't tied to one specific business.
  ownerDisplayName: string;
  now?: Date;
}

export async function computeAttentionCentre(params: AttentionCentreParams): Promise<AttentionItem[]> {
  const {
    caseViewer,
    businessIds,
    decisionLogFilter,
    initiativeFilter,
    playbookRunOwnerType,
    playbookRunOwnerId,
    restrictPlaybookRunsToBusinessIds,
    product,
    portalPrefix: prefix,
    ownerDisplayName,
  } = params;
  const now = params.now ?? new Date();
  const items: AttentionItem[] = [];

  const businesses = await Business.find({ _id: { $in: businessIds } }).select("name parentOrgId escalationSlaHours");
  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));

  // Escalation SLA — a branch's own escalationSlaHours is ignored in favor
  // of its parent org's, same inheritance rule as ragThresholds/
  // escalationLevels (see getEscalationConfig's own comment). Resolved here
  // in bulk (one query for every org referenced, not one per case) so a
  // busy account's case list doesn't fan out into N escalation-config
  // lookups.
  const parentOrgIds = [...new Set(businesses.map((b) => b.parentOrgId?.toString()).filter((x): x is string => !!x))];
  const parentOrgs = parentOrgIds.length > 0 ? await ParentOrganization.find({ _id: { $in: parentOrgIds } }).select("escalationSlaHours") : [];
  const slaHoursByOrgId = new Map(parentOrgs.map((o) => [o._id.toString(), o.escalationSlaHours]));
  const slaHoursByBusinessId = new Map(
    businesses.map((b) => [
      b._id.toString(),
      b.parentOrgId ? slaHoursByOrgId.get(b.parentOrgId.toString()) ?? null : (b.escalationSlaHours ?? null),
    ])
  );

  // Collect every ownerId referenced across all sources up front so one
  // User query covers the whole page instead of one per source.
  const userIdsNeeded = new Set<string>();

  // ---- Cases: overdue, split by whether they're already escalated -------
  const openOverdueCases = await ActionBoardItem.find({
    $and: [sensitiveVisibilityClause(caseViewer)],
    businessId: { $in: businessIds },
    product,
    status: { $ne: "resolved" },
    dueDate: { $lt: now },
  }).select("title businessId ownerId dueDate currentEscalationLevel sensitive createdAt status");

  for (const c of openOverdueCases) {
    if (c.ownerId) userIdsNeeded.add(c.ownerId.toString());
  }

  // ---- Cases within a few hours of the auto-escalation cron bumping them
  // a level — a forward-looking SLA warning, distinct from openOverdueCases
  // above (that's a case already past its own dueDate; this is a case
  // still on time but about to move up the escalation chain regardless).
  // Skipped for any business/org with no escalationSlaHours configured —
  // same "nothing configured yet" case autoEscalateOverdueCases itself
  // skips silently.
  const openCasesForSla = await ActionBoardItem.find({
    $and: [sensitiveVisibilityClause(caseViewer)],
    businessId: { $in: businessIds },
    product,
    status: { $ne: "resolved" },
  }).select("title businessId ownerId levelEnteredAt currentEscalationLevel createdAt");
  const approachingDeadlineCases = openCasesForSla
    .map((c) => {
      const slaHours = slaHoursByBusinessId.get(c.businessId.toString()) ?? null;
      if (!slaHours) return null;
      const levelStarted = c.levelEnteredAt ?? c.createdAt;
      const hoursSince = (now.getTime() - new Date(levelStarted).getTime()) / (60 * 60 * 1000);
      const hoursRemaining = slaHours - hoursSince;
      if (hoursRemaining <= 0 || hoursRemaining > ESCALATION_DEADLINE_WARNING_HOURS) return null;
      return { c, hoursRemaining };
    })
    .filter((x): x is { c: (typeof openCasesForSla)[number]; hoursRemaining: number } => x !== null);
  for (const { c } of approachingDeadlineCases) {
    if (c.ownerId) userIdsNeeded.add(c.ownerId.toString());
  }

  // ---- Cases: sensitive-routed and still untouched after 48h ------------
  const staleSensitiveThreshold = new Date(now.getTime() - SENSITIVE_STALE_HOURS * 60 * 60 * 1000);
  const staleSensitiveCases = await ActionBoardItem.find({
    $and: [sensitiveVisibilityClause(caseViewer)],
    businessId: { $in: businessIds },
    product,
    status: "open",
    sensitive: true,
    createdAt: { $lt: staleSensitiveThreshold },
  }).select("title businessId ownerId createdAt");

  for (const c of staleSensitiveCases) {
    if (c.ownerId) userIdsNeeded.add(c.ownerId.toString());
  }

  // ---- CX half of Closing the Loop: negative feedback never personally
  // replied to. The proactive counterpart to the existing respond-to-
  // customer button — that mechanism already exists and works, it just
  // never surfaced itself; this makes it a prompt instead of something a
  // business only finds by happening to open the right case. Colleague
  // Experience is excluded entirely: it never captures a respondent email
  // in the first place (anonymity floor), so there's nothing to reply to —
  // see ClosingLoopUpdate's own comment for that product's broadcast-only
  // mechanism instead.
  //
  // Deliberately no creation-date window here (QA-flagged bug, product
  // decision confirmed): this tracks "still unreplied," which by
  // definition never resolves itself with time — a case sitting unreplied
  // for 40 days is MORE overdue than one at 5, not something that should
  // silently drop off the list once it crosses an arbitrary cutoff. It
  // only ever leaves this list the same two ways every other queue empties
  // — someone sends the reply (customerNotifiedAt gets set) or the case is
  // otherwise resolved.
  const candidateCases = await ActionBoardItem.find({
    $and: [sensitiveVisibilityClause(caseViewer)],
    businessId: { $in: businessIds },
    product: "customer_experience",
    status: { $ne: "resolved" },
    customerNotifiedAt: null,
    sourceResponseIds: { $ne: [] },
  }).select("title businessId ownerId createdAt sourceResponseIds sensitive");

  const candidateResponseIds = [...new Set(candidateCases.flatMap((c) => c.sourceResponseIds.map((id) => id.toString())))];
  const candidateResponses =
    candidateResponseIds.length > 0
      ? await FeedbackResponse.find({ _id: { $in: candidateResponseIds }, respondentEmail: { $ne: null } }).select(
          "answers respondentEmail"
        )
      : [];
  const responseById = new Map(candidateResponses.map((r) => [r._id.toString(), r]));

  const awaitingReplyCases = candidateCases.filter((c) => {
    const response = c.sourceResponseIds.map((id) => responseById.get(id.toString())).find((r) => r);
    if (!response) return false; // no captured email on any linked response — nothing to reply to
    if (c.sensitive) return true;
    return response.answers.some((a) => a.type === "star_1_5" && typeof a.value === "number" && a.value <= NEGATIVE_STAR_THRESHOLD);
  });
  for (const c of awaitingReplyCases) {
    if (c.ownerId) userIdsNeeded.add(c.ownerId.toString());
  }

  // ---- Alerts fired recently ----------------------------------------------
  const alertWindowStart = new Date(now.getTime() - ALERT_WINDOW_DAYS * DAY_MS);
  const recentAlerts = await AlertActivity.find({
    businessId: { $in: businessIds },
    triggeredAt: { $gte: alertWindowStart },
  })
    .sort({ triggeredAt: -1 })
    .limit(25);
  const alertRuleIds = [...new Set(recentAlerts.map((a) => a.alertRuleId.toString()))];
  const rules = await AlertRule.find({ _id: { $in: alertRuleIds } }).select("ruleType metric");
  const ruleById = new Map(rules.map((r) => [r._id.toString(), r]));

  // ---- Stalled playbook runs ----------------------------------------------
  const playbookStallThreshold = new Date(now.getTime() - PLAYBOOK_STALL_DAYS * DAY_MS);
  const stalledRunsRaw = await PlaybookRun.find({
    ownerType: playbookRunOwnerType,
    ownerId: playbookRunOwnerId,
    status: "active",
    startedAt: { $lt: playbookStallThreshold },
  }).select("playbookId actionBoardItemId startedAt");
  const stalledRunCaseIds = stalledRunsRaw.filter((r) => r.actionBoardItemId).map((r) => r.actionBoardItemId as Types.ObjectId);
  const stalledRunCases =
    stalledRunCaseIds.length > 0
      ? await ActionBoardItem.find({ _id: { $in: stalledRunCaseIds } }).select("title businessId")
      : [];
  const caseById = new Map(stalledRunCases.map((c) => [c._id.toString(), c]));

  const restrictSet = restrictPlaybookRunsToBusinessIds
    ? new Set(restrictPlaybookRunsToBusinessIds.map((id) => id.toString()))
    : null;
  const stalledRuns = stalledRunsRaw.filter((r) => {
    if (!restrictSet) return true; // standalone business or the org's own /group view — everything at this owner is relevant
    if (!r.actionBoardItemId) return false; // org-wide ad-hoc run — not this branch's to see
    const linkedCase = caseById.get(r.actionBoardItemId.toString());
    return !!linkedCase && restrictSet.has(linkedCase.businessId.toString());
  });

  const playbookIds = [...new Set(stalledRuns.map((r) => r.playbookId.toString()))];
  const playbooks = playbookIds.length > 0 ? await Playbook.find({ _id: { $in: playbookIds } }).select("title") : [];
  const playbookById = new Map(playbooks.map((p) => [p._id.toString(), p]));

  // ---- Decision Log entries with a fresh verdict ready to review ---------
  const decisionReviewStart = new Date(now.getTime() - DECISION_REVIEW_WINDOW_DAYS * DAY_MS);
  const decisionsReady = await DecisionLogEntry.find({
    ...decisionLogFilter,
    product,
    outcomeMeasuredAt: { $gte: decisionReviewStart },
  }).select("title ownerId outcomeMeasuredAt outcomeMetricDescription outcomeBefore outcomeAfter");
  for (const d of decisionsReady) {
    if (d.ownerId) userIdsNeeded.add(d.ownerId.toString());
  }

  // ---- Improvement Initiatives never kicked off ---------------------------
  const initiativeStallThreshold = new Date(now.getTime() - INITIATIVE_STALL_DAYS * DAY_MS);
  const stalledInitiatives = await ImprovementInitiative.find({
    ...initiativeFilter,
    product,
    status: "planned",
    startedAt: null,
    createdAt: { $lt: initiativeStallThreshold },
  }).select("title ownerId createdAt");
  for (const i of stalledInitiatives) {
    if (i.ownerId) userIdsNeeded.add(i.ownerId.toString());
  }

  const users = userIdsNeeded.size > 0 ? await User.find({ _id: { $in: [...userIdsNeeded] } }).select("email") : [];
  const userNameById = new Map(users.map((u) => [u._id.toString(), u.email]));
  const who = (id: Types.ObjectId | null): string => (id ? userNameById.get(id.toString()) ?? "Unassigned" : "Unassigned");
  const where = (id: Types.ObjectId): string => businessNameById.get(id.toString()) ?? "Unknown branch";

  for (const c of openOverdueCases) {
    const overdueDays = Math.max(1, daysAgo(c.dueDate!.toISOString(), now));
    const escalated = c.currentEscalationLevel > 1;
    items.push({
      id: `case:${c._id.toString()}`,
      kind: escalated ? "overdue_escalated_case" : "overdue_case",
      severity: escalated ? "critical" : "high",
      what: c.title,
      where: where(c.businessId),
      who: who(c.ownerId),
      whyNow: escalated
        ? `Escalated to level ${c.currentEscalationLevel} and still ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
        : `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      actionLabel: "Open case",
      actionHref: `${prefix}/cases/${c._id.toString()}`,
      at: c.dueDate!.toISOString(),
    });
  }

  for (const { c, hoursRemaining } of approachingDeadlineCases) {
    const hours = Math.max(1, Math.round(hoursRemaining));
    items.push({
      id: `sla:${c._id.toString()}`,
      kind: "escalation_deadline_approaching",
      severity: "high",
      what: c.title,
      where: where(c.businessId),
      who: who(c.ownerId),
      whyNow: `Escalation deadline in ${hours} hour${hours === 1 ? "" : "s"}`,
      actionLabel: "Open case",
      actionHref: `${prefix}/cases/${c._id.toString()}`,
      at: (c.levelEnteredAt ?? c.createdAt).toISOString(),
    });
  }

  for (const c of staleSensitiveCases) {
    const waitingDays = daysAgo(c.createdAt.toISOString(), now);
    items.push({
      id: `sensitive:${c._id.toString()}`,
      kind: "stalled_sensitive_case",
      severity: "high",
      what: c.title,
      where: where(c.businessId),
      who: who(c.ownerId),
      whyNow: `Sensitive case, untouched for ${waitingDays} day${waitingDays === 1 ? "" : "s"}`,
      actionLabel: "Open case",
      actionHref: `${prefix}/cases/${c._id.toString()}`,
      at: c.createdAt.toISOString(),
    });
  }

  for (const c of awaitingReplyCases) {
    const waitingDays = daysAgo(c.createdAt.toISOString(), now);
    items.push({
      id: `awaiting-reply:${c._id.toString()}`,
      kind: "awaiting_customer_reply",
      severity: "medium",
      what: c.title,
      where: where(c.businessId),
      who: who(c.ownerId),
      whyNow: `Negative feedback with a captured email, no personal reply sent yet — ${waitingDays} day${waitingDays === 1 ? "" : "s"} since`,
      actionLabel: "Reply to customer",
      actionHref: `${prefix}/cases/${c._id.toString()}`,
      at: c.createdAt.toISOString(),
    });
  }

  for (const a of recentAlerts) {
    const rule = ruleById.get(a.alertRuleId.toString());
    const label = rule ? rule.ruleType.replace(/_/g, " ") : "Alert";
    items.push({
      id: `alert:${a._id.toString()}`,
      kind: "alert_fired",
      severity: "medium",
      what: `${label} fired — value ${a.snapshotValue}`,
      where: where(a.businessId),
      who: "Unassigned",
      whyNow: `Fired ${daysAgo(a.triggeredAt.toISOString(), now)} day(s) ago`,
      actionLabel: "Review alert",
      actionHref: `${prefix}/alerts`,
      at: a.triggeredAt.toISOString(),
    });
  }

  for (const r of stalledRuns) {
    const linkedCase = r.actionBoardItemId ? caseById.get(r.actionBoardItemId.toString()) : null;
    const playbook = playbookById.get(r.playbookId.toString());
    const stalledDays = daysAgo(r.startedAt.toISOString(), now);
    items.push({
      id: `playbook:${r._id.toString()}`,
      kind: "stalled_playbook",
      severity: "medium",
      what: `Playbook "${playbook?.title ?? "Untitled"}" still in progress`,
      where: linkedCase ? where(linkedCase.businessId) : ownerDisplayName,
      who: "Unassigned",
      whyNow: `Started ${stalledDays} days ago, no steps completed since — needs a nudge or should be marked abandoned`,
      actionLabel: linkedCase ? "Open case" : "Open Playbook Library",
      actionHref: linkedCase ? `${prefix}/cases/${linkedCase._id.toString()}` : `${prefix}/playbooks`,
      at: r.startedAt.toISOString(),
    });
  }

  for (const d of decisionsReady) {
    const delta =
      d.outcomeBefore !== null && d.outcomeAfter !== null ? Math.round((d.outcomeAfter - d.outcomeBefore) * 100) / 100 : null;
    items.push({
      id: `decision:${d._id.toString()}`,
      kind: "decision_ready_for_review",
      severity: "low",
      what: `"${d.title}" — outcome measured`,
      where: ownerDisplayName,
      who: who(d.ownerId),
      whyNow:
        delta !== null
          ? `${d.outcomeMetricDescription || "Result"} moved ${delta > 0 ? "+" : ""}${delta}`
          : "New before/after measurement is in",
      actionLabel: "Review decision",
      actionHref: `${prefix}/decision-log`,
      at: d.outcomeMeasuredAt!.toISOString(),
    });
  }

  for (const i of stalledInitiatives) {
    const waitingDays = daysAgo(i.createdAt.toISOString(), now);
    items.push({
      id: `initiative:${i._id.toString()}`,
      kind: "initiative_not_started",
      severity: "low",
      what: `"${i.title}" — planned but not started`,
      where: ownerDisplayName,
      who: who(i.ownerId),
      whyNow: `Logged ${waitingDays} days ago, no start date set yet`,
      actionLabel: "Open initiative",
      actionHref: `${prefix}/improvement-initiatives`,
      at: i.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    // Within a severity band, an unassigned item goes first — "unassigned
    // high-severity cases" is its own named priority tier in the rule
    // order, not just whatever happens to be oldest.
    const unassignedDiff = Number(a.who !== "Unassigned") - Number(b.who !== "Unassigned");
    if (unassignedDiff !== 0) return unassignedDiff;
    return new Date(a.at).getTime() - new Date(b.at).getTime(); // oldest/longest-waiting first within a band
  });

  return items;
}
