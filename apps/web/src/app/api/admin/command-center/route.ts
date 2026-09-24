import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import {
  connectToDatabase,
  Business,
  ParentOrganization,
  AlertActivity,
  AlertRule,
  ActionBoardItem,
  ActionItemComment,
  DecisionLogEntry,
  Invoice,
  BillingSubscription,
  CxPulseScore,
  Response as FeedbackResponse,
  computeBusinessMetrics,
  findPortfolioSignals,
  ragBandForStar,
  ragBandForNps,
  DEFAULT_RAG_THRESHOLDS,
  type IRagThresholds,
} from "@oodelscore/shared";
import { requireStaffSession } from "@/lib/adminAuth";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_WINDOW_DAYS = 14;

interface ClientTile {
  clientId: string; // "business:<id>" or "org:<id>"
  ownerType: "business" | "parentOrg";
  businessId: string; // underlying record id, for links back into admin/businesses or admin/parent-orgs
  name: string;
  kind: string; // "Business" or "Parent Org"
  starAverage: number | null;
  npsScore: number | null;
  responseCount: number;
  starDelta: number | null;
  band: "green" | "amber" | "red" | null;
  openActionItems: number;
  overdueActionItems: number;
}

interface FeedEntry {
  kind: "alert" | "action_resolved" | "comment" | "decision" | "billing" | "billing_overdue" | "inactive";
  severity: "crit" | "high" | "med";
  title: string;
  meta: string;
  businessName: string | null;
  at: string;
}

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { role } = session;
  // Platform-wide view — not scoped to "assigned" accounts. Same shape of
  // gate as the Admin Overview page's per-section checks, but since this
  // page rolls every client up at once there's no meaningful "assigned"
  // subset to show, so it requires full ("all"-scope) visibility plus
  // billing oversight (the page surfaces MRR/overdue status).
  const perms = role.permissions;
  const hasPlatformAccess =
    perms.businesses.view &&
    perms.businesses.scope === "all" &&
    perms.parentOrgs.view &&
    perms.parentOrgs.scope === "all" &&
    perms.billingOversight.view;
  if (!hasPlatformAccess) {
    return NextResponse.json(
      { status: "error", message: "Command Center requires platform-wide (all-scope) business, parent org and billing oversight access" },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * DAY_MS);
  const from7 = new Date(now.getTime() - 7 * DAY_MS);
  const prev7Start = new Date(now.getTime() - 14 * DAY_MS);
  const prev7End = from7;
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_WINDOW_DAYS * DAY_MS);

  const [standaloneBusinesses, parentOrgs] = await Promise.all([
    Business.find({ parentOrgId: null, active: true }).select("_id name ragThresholds"),
    ParentOrganization.find().select("_id name ragThresholds"),
  ]);

  // Branches under each org — needed to roll each org up into one client
  // tile (per the task: an org is one client here, branch detail already
  // lives in that org's own Group Command Center).
  const orgBranches = await Promise.all(
    parentOrgs.map((o) => Business.find({ parentOrgId: o._id, active: true }).select("_id"))
  );
  const orgBranchIds = new Map(parentOrgs.map((o, i) => [o._id.toString(), orgBranches[i].map((b) => b._id)]));

  async function metricsForWindow(businessIds: Types.ObjectId[], from: Date, to: Date) {
    if (businessIds.length === 0) return { starAverage: null as number | null, npsScore: null as number | null, responseCount: 0 };
    const perBusiness = await Promise.all(businessIds.map((id) => computeBusinessMetrics(id, from, to)));
    const responseCount = perBusiness.reduce((sum, m) => sum + m.responseCount, 0);
    const starVals = perBusiness.filter((m) => m.starAverage !== null);
    const npsVals = perBusiness.filter((m) => m.npsScore !== null);
    const starAverage =
      starVals.length === 0 ? null : Math.round((starVals.reduce((s, m) => s + (m.starAverage as number), 0) / starVals.length) * 100) / 100;
    const npsScore = npsVals.length === 0 ? null : Math.round(npsVals.reduce((s, m) => s + (m.npsScore as number), 0) / npsVals.length);
    return { starAverage, npsScore, responseCount };
  }

  const clientTiles: ClientTile[] = [];

  for (const b of standaloneBusinesses) {
    const ids = [b._id];
    const [m30, mLastWeek, mPrevWeek] = await Promise.all([
      metricsForWindow(ids, from30, now),
      metricsForWindow(ids, from7, now),
      metricsForWindow(ids, prev7Start, prev7End),
    ]);
    const starDelta = mLastWeek.starAverage !== null && mPrevWeek.starAverage !== null ? mLastWeek.starAverage - mPrevWeek.starAverage : null;
    const thresholds: IRagThresholds = b.ragThresholds ?? DEFAULT_RAG_THRESHOLDS;
    const [openCount, overdueCount] = await Promise.all([
      ActionBoardItem.countDocuments({ businessId: b._id, status: { $ne: "resolved" } }),
      ActionBoardItem.countDocuments({ businessId: b._id, status: { $ne: "resolved" }, dueDate: { $lt: now } }),
    ]);
    clientTiles.push({
      clientId: `business:${b._id.toString()}`,
      ownerType: "business",
      businessId: b._id.toString(),
      name: b.name,
      kind: "Business",
      starAverage: m30.starAverage,
      npsScore: m30.npsScore,
      responseCount: m30.responseCount,
      starDelta,
      band: ragBandForStar(m30.starAverage, thresholds) ?? ragBandForNps(m30.npsScore, thresholds),
      openActionItems: openCount,
      overdueActionItems: overdueCount,
    });
  }

  for (const o of parentOrgs) {
    const branchIds = orgBranchIds.get(o._id.toString()) ?? [];
    const [m30, mLastWeek, mPrevWeek] = await Promise.all([
      metricsForWindow(branchIds, from30, now),
      metricsForWindow(branchIds, from7, now),
      metricsForWindow(branchIds, prev7Start, prev7End),
    ]);
    const starDelta = mLastWeek.starAverage !== null && mPrevWeek.starAverage !== null ? mLastWeek.starAverage - mPrevWeek.starAverage : null;
    const thresholds: IRagThresholds = o.ragThresholds ?? DEFAULT_RAG_THRESHOLDS;
    const [openCount, overdueCount] = await Promise.all([
      ActionBoardItem.countDocuments({ businessId: { $in: branchIds }, status: { $ne: "resolved" } }),
      ActionBoardItem.countDocuments({ businessId: { $in: branchIds }, status: { $ne: "resolved" }, dueDate: { $lt: now } }),
    ]);
    clientTiles.push({
      clientId: `org:${o._id.toString()}`,
      ownerType: "parentOrg",
      businessId: o._id.toString(),
      name: o.name,
      kind: "Parent Org",
      starAverage: m30.starAverage,
      npsScore: m30.npsScore,
      responseCount: m30.responseCount,
      starDelta,
      band: ragBandForStar(m30.starAverage, thresholds) ?? ragBandForNps(m30.npsScore, thresholds),
      openActionItems: openCount,
      overdueActionItems: overdueCount,
    });
  }

  clientTiles.sort((a, b) => a.name.localeCompare(b.name));

  const allBusinessIds = [...standaloneBusinesses.map((b) => b._id), ...orgBranches.flat().map((b) => b._id)];
  const businessNameById = new Map<string, string>();
  for (const b of standaloneBusinesses) businessNameById.set(b._id.toString(), b.name);
  for (let i = 0; i < parentOrgs.length; i++) {
    for (const branchId of orgBranchIds.get(parentOrgs[i]._id.toString()) ?? []) {
      businessNameById.set(branchId.toString(), parentOrgs[i].name);
    }
  }
  const clientNameByBusinessId = businessNameById; // branch ids map to their client's (org's) name for the feed

  // ---- CX Pulse maturity distribution (platform-wide) ----
  // Latest score per owner. There's no existing platform-distribution
  // helper in cxpulse/portfolio.ts (it only flags at-risk/expansion-ready
  // owners with 3+ months of stable history), so the level counts here are
  // a direct read of CxPulseScore, same model portfolio.ts itself reads —
  // findPortfolioSignals() below is reused as-is for the risk/expansion
  // chips rather than reimplementing that "stuck 3 months" rule.
  const owners = [
    ...standaloneBusinesses.map((b) => ({ ownerType: "business" as const, ownerId: b._id })),
    ...parentOrgs.map((o) => ({ ownerType: "parentOrg" as const, ownerId: o._id })),
  ];
  const latestScores = await Promise.all(
    owners.map((o) => CxPulseScore.findOne({ ownerType: o.ownerType, ownerId: o.ownerId, product: "customer_experience" }).sort({ period: -1 }))
  );
  const levelCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const scoredLevels: number[] = [];
  for (const s of latestScores) {
    if (!s) continue;
    levelCounts[s.level] += 1;
    scoredLevels.push(s.compositeScore);
  }
  const compositeScore = scoredLevels.length === 0 ? 0 : Math.round(scoredLevels.reduce((sum, v) => sum + v, 0) / scoredLevels.length);
  // levelFromComposite bands mirror packages/shared/src/cxpulse/compute.ts
  const platformLevel = compositeScore <= 20 ? 1 : compositeScore <= 40 ? 2 : compositeScore <= 60 ? 3 : compositeScore <= 80 ? 4 : 5;

  const portfolioSignals = await findPortfolioSignals();

  // ---- Billing — same aggregation as apps/web/src/app/api/admin/overview/route.ts ----
  const subscriptions = await BillingSubscription.find();
  const platformMrr = subscriptions.filter((s) => !s.isComp).reduce((sum, s) => sum + s.mrrValue, 0);
  const overdueCount = subscriptions.filter((s) => s.status === "overdue").length;
  const compCount = subscriptions.filter((s) => s.isComp).length;
  const overdueSubs = subscriptions.filter((s) => s.status === "overdue");

  // ---- Live platform feed ----
  const [recentAlertActivity, resolvedItems, recentComments, recentDecisions, failedInvoices] = await Promise.all([
    AlertActivity.find({ businessId: { $in: allBusinessIds } }).sort({ triggeredAt: -1 }).limit(15),
    ActionBoardItem.find({ businessId: { $in: allBusinessIds }, status: "resolved" }).sort({ resolvedAt: -1 }).limit(10),
    ActionItemComment.find({}).sort({ createdAt: -1 }).limit(30),
    DecisionLogEntry.find({}).sort({ createdAt: -1 }).limit(10),
    Invoice.find({ status: "failed" }).sort({ issuedAt: -1 }).limit(8),
  ]);

  const ruleIds = [...new Set(recentAlertActivity.map((a) => a.alertRuleId.toString()))];
  const rules = await AlertRule.find({ _id: { $in: ruleIds } }).select("ruleType");
  const ruleTypeById = new Map(rules.map((r) => [r._id.toString(), r.ruleType]));

  const allItemsForComments = await ActionBoardItem.find({}).select("_id businessId title");
  const itemById = new Map(allItemsForComments.map((i) => [i._id.toString(), i]));

  const feed: FeedEntry[] = [];
  for (const a of recentAlertActivity) {
    feed.push({
      kind: "alert",
      severity: a.snapshotValue < 2.5 ? "crit" : "high",
      title: `${(ruleTypeById.get(a.alertRuleId.toString()) ?? "alert").replace(/_/g, " ")} fired — value ${a.snapshotValue}`,
      meta: clientNameByBusinessId.get(a.businessId.toString()) ?? "Unknown client",
      businessName: clientNameByBusinessId.get(a.businessId.toString()) ?? null,
      at: a.triggeredAt.toISOString(),
    });
  }
  for (const item of resolvedItems) {
    if (!item.resolvedAt) continue;
    feed.push({
      kind: "action_resolved",
      severity: "med",
      title: `Resolved — ${item.title}`,
      meta: clientNameByBusinessId.get(item.businessId.toString()) ?? "Unknown client",
      businessName: clientNameByBusinessId.get(item.businessId.toString()) ?? null,
      at: item.resolvedAt.toISOString(),
    });
  }
  for (const c of recentComments) {
    const item = itemById.get(c.actionItemId.toString());
    if (!item) continue;
    feed.push({
      kind: "comment",
      severity: "med",
      title: `New comment — "${c.body.slice(0, 70)}${c.body.length > 70 ? "…" : ""}"`,
      meta: `${c.authorLabel} on ${item.title}`,
      businessName: clientNameByBusinessId.get(item.businessId.toString()) ?? null,
      at: c.createdAt.toISOString(),
    });
  }
  for (const d of recentDecisions) {
    feed.push({
      kind: "decision",
      severity: "med",
      title: `Decision logged — ${d.title}`,
      meta: d.status,
      businessName: null,
      at: d.createdAt.toISOString(),
    });
  }
  for (const inv of failedInvoices) {
    feed.push({
      kind: "billing",
      severity: "crit",
      title: `Payment failed — $${inv.amount.toFixed(2)}`,
      meta: "Billing",
      businessName: null,
      at: inv.issuedAt.toISOString(),
    });
  }
  // Extension: billing gone overdue for a client.
  for (const s of overdueSubs) {
    const ownerName =
      s.ownerType === "business" ? businessNameById.get(s.ownerId.toString()) : parentOrgs.find((o) => o._id.toString() === s.ownerId.toString())?.name;
    feed.push({
      kind: "billing_overdue",
      severity: "high",
      title: `Billing overdue — $${s.mrrValue.toFixed(2)} MRR`,
      meta: ownerName ?? "Unknown account",
      businessName: ownerName ?? null,
      at: s.updatedAt.toISOString(),
    });
  }
  // Extension: no new Response documents in the last INACTIVITY_WINDOW_DAYS
  // for a client — same "needs attention" concept the Admin Overview route
  // already flags (invite-expired, billing-integrity, etc.), extended here
  // with an activity signal it doesn't currently compute.
  for (const tile of clientTiles) {
    const ids = tile.ownerType === "business" ? [tile.businessId] : (orgBranchIds.get(tile.businessId) ?? []).map((id) => id.toString());
    if (ids.length === 0) continue;
    const recentCount = await FeedbackResponse.countDocuments({
      businessId: { $in: ids },
      submittedAt: { $gte: inactivityCutoff },
    });
    if (recentCount === 0) {
      feed.push({
        kind: "inactive",
        severity: "med",
        title: `No responses in ${INACTIVITY_WINDOW_DAYS}+ days`,
        meta: tile.name,
        businessName: tile.name,
        at: now.toISOString(),
      });
    }
  }

  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ---- Sparklines: 7d daily response volume per client ----
  const sparklines = clientTiles.map((t) => ({ clientId: t.clientId, name: t.name, days: [] as number[] }));
  const sparkByClient = new Map(sparklines.map((s) => [s.clientId, s]));
  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date(now.getTime() - d * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    await Promise.all(
      clientTiles.map(async (t) => {
        const ids = t.ownerType === "business" ? [t.businessId] : (orgBranchIds.get(t.businessId) ?? []).map((id) => id.toString());
        const count = ids.length === 0 ? 0 : await FeedbackResponse.countDocuments({ businessId: { $in: ids }, submittedAt: { $gte: dayStart, $lt: dayEnd } });
        sparkByClient.get(t.clientId)?.days.push(count);
      })
    );
  }

  const movers = [...clientTiles].filter((t) => t.starDelta !== null).sort((a, b) => (b.starDelta as number) - (a.starDelta as number));

  return NextResponse.json({
    status: "ok",
    clientTiles,
    cxPulseDistribution: levelCounts,
    cxPulse: { compositeScore, level: platformLevel },
    portfolioSignals,
    billing: { platformMrr, overdueCount, compCount, totalAccounts: subscriptions.length },
    feed: feed.slice(0, 25),
    movers,
    sparklines: [...sparkByClient.values()],
  });
}
