import { NextResponse } from "next/server";
import {
  connectToDatabase,
  Business,
  AlertActivity,
  AlertRule,
  ActionBoardItem,
  ActionItemComment,
  DecisionLogEntry,
  Invoice,
  BillingSubscription,
  CxPulseScore,
  Category,
  Response as FeedbackResponse,
  computeNetworkSummaries,
  computeBusinessCategoryBreakdown,
  getCategoriesInUseForParentOrg,
  ragBandForStar,
  ragBandForNps,
  primaryProductFor,
  type IRagThresholds,
} from "@oodelscore/shared";
import { requireParentOrgOwner } from "@/lib/ownerAuth";

const DAY_MS = 24 * 60 * 60 * 1000;

interface FeedEntry {
  kind: "alert" | "action_resolved" | "comment" | "decision" | "billing";
  severity: "crit" | "high" | "med";
  title: string;
  meta: string;
  businessName: string | null;
  at: string;
}

export async function GET() {
  const session = await requireParentOrgOwner();
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  const { org } = session;
  if (!org.commandCenterEnabled) {
    return NextResponse.json({ status: "error", message: "Command Center is not enabled for this organization" }, { status: 403 });
  }

  await connectToDatabase();
  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * DAY_MS);
  const from7 = new Date(now.getTime() - 7 * DAY_MS);
  const prev7Start = new Date(now.getTime() - 14 * DAY_MS);
  const prev7End = from7;

  const thresholds: IRagThresholds = org.ragThresholds;
  // Command Center predates Colleague Experience and only ever shows one
  // product's numbers — Customer Experience when enabled (even alongside
  // Colleague Experience), otherwise Colleague Experience. Without this, an
  // org that turned Customer Experience off kept computing (and showing)
  // its empty Customer Experience metrics forever, never falling back to
  // the Colleague Experience data it actually has.
  const product = primaryProductFor(org);

  const [businesses, summaries30d, summariesLast7d, summariesPrev7d, categoryIds, orgScore, subscription] = await Promise.all([
    Business.find({ parentOrgId: org._id }).select("_id name region"),
    computeNetworkSummaries(org._id, from30, now, product),
    computeNetworkSummaries(org._id, from7, now, product),
    computeNetworkSummaries(org._id, prev7Start, prev7End, product),
    getCategoriesInUseForParentOrg(org._id),
    CxPulseScore.findOne({ ownerType: "parentOrg", ownerId: org._id, product }).sort({ period: -1 }),
    BillingSubscription.findOne({ ownerType: "parentOrg", ownerId: org._id }),
  ]);

  const businessIds = businesses.map((b) => b._id);
  const lastWeekByBusiness = new Map(summariesLast7d.map((s) => [s.businessId, s]));
  const prevWeekByBusiness = new Map(summariesPrev7d.map((s) => [s.businessId, s]));

  const [openCounts, overdueCounts, categoryBreakdowns] = await Promise.all([
    Promise.all(
      businessIds.map((id) => ActionBoardItem.countDocuments({ businessId: id, status: { $ne: "resolved" } }))
    ),
    Promise.all(
      businessIds.map((id) =>
        ActionBoardItem.countDocuments({ businessId: id, status: { $ne: "resolved" }, dueDate: { $lt: now } })
      )
    ),
    Promise.all(businessIds.map((id) => computeBusinessCategoryBreakdown(id, from30, now, product))),
  ]);

  const branchTiles = summaries30d.map((s, i) => {
    const lastWeek = lastWeekByBusiness.get(s.businessId);
    const prevWeek = prevWeekByBusiness.get(s.businessId);
    const starDelta =
      lastWeek?.starAverage != null && prevWeek?.starAverage != null ? lastWeek.starAverage - prevWeek.starAverage : null;
    return {
      businessId: s.businessId,
      name: s.name,
      region: s.region,
      starAverage: s.starAverage,
      npsScore: s.npsScore,
      responseCount: s.responseCount,
      starDelta,
      band: ragBandForStar(s.starAverage, thresholds) ?? ragBandForNps(s.npsScore, thresholds),
      openActionItems: openCounts[i],
      overdueActionItems: overdueCounts[i],
    };
  });

  const categories = await Category.find({ _id: { $in: [...categoryIds] } }).sort({ name: 1 });
  const categoryMatrix = categories.map((c) => ({
    categoryId: c._id.toString(),
    name: c.name,
    byBusiness: businesses.reduce<Record<string, { average: number; band: string | null }>>((acc, b, i) => {
      const entry = categoryBreakdowns[i].find((row) => row.categoryId === c._id.toString());
      if (entry) acc[b._id.toString()] = { average: entry.average, band: ragBandForStar(entry.average, thresholds) };
      return acc;
    }, {}),
  }));

  // ---- Live alert & action feed ----
  const [recentAlertActivity, resolvedItems, recentComments, recentDecisions, failedInvoices] = await Promise.all([
    AlertActivity.find({ businessId: { $in: businessIds } }).sort({ triggeredAt: -1 }).limit(10),
    ActionBoardItem.find({ businessId: { $in: businessIds }, status: "resolved" }).sort({ resolvedAt: -1 }).limit(8),
    ActionItemComment.find({}).sort({ createdAt: -1 }).limit(30), // filtered against this org's items below
    DecisionLogEntry.find({ parentOrgId: org._id }).sort({ createdAt: -1 }).limit(8),
    Invoice.find({ ownerType: "parentOrg", ownerId: org._id, status: "failed" }).sort({ issuedAt: -1 }).limit(5),
  ]);

  const businessNameById = new Map(businesses.map((b) => [b._id.toString(), b.name]));
  const ruleIds = [...new Set(recentAlertActivity.map((a) => a.alertRuleId.toString()))];
  const rules = await AlertRule.find({ _id: { $in: ruleIds } }).select("ruleType");
  const ruleTypeById = new Map(rules.map((r) => [r._id.toString(), r.ruleType]));

  const orgItemIds = new Set(
    (await ActionBoardItem.find({ businessId: { $in: businessIds } }).select("_id businessId")).map((i) => i._id.toString())
  );
  const itemBusinessById = new Map(
    (await ActionBoardItem.find({ businessId: { $in: businessIds } }).select("_id businessId title")).map((i) => [
      i._id.toString(),
      i,
    ])
  );

  const feed: FeedEntry[] = [];
  for (const a of recentAlertActivity) {
    feed.push({
      kind: "alert",
      severity: a.snapshotValue < 2.5 ? "crit" : "high",
      title: `${(ruleTypeById.get(a.alertRuleId.toString()) ?? "alert").replace(/_/g, " ")} fired — value ${a.snapshotValue}`,
      meta: businessNameById.get(a.businessId.toString()) ?? "Unknown branch",
      businessName: businessNameById.get(a.businessId.toString()) ?? null,
      at: a.triggeredAt.toISOString(),
    });
  }
  for (const item of resolvedItems) {
    if (!item.resolvedAt) continue;
    feed.push({
      kind: "action_resolved",
      severity: "med",
      title: `Resolved — ${item.title}`,
      meta: businessNameById.get(item.businessId.toString()) ?? "Unknown branch",
      businessName: businessNameById.get(item.businessId.toString()) ?? null,
      at: item.resolvedAt.toISOString(),
    });
  }
  for (const c of recentComments) {
    if (!orgItemIds.has(c.actionItemId.toString())) continue;
    const item = itemBusinessById.get(c.actionItemId.toString());
    feed.push({
      kind: "comment",
      severity: "med",
      title: `New comment — "${c.body.slice(0, 70)}${c.body.length > 70 ? "…" : ""}"`,
      meta: `${c.authorLabel} on ${item?.title ?? "an action item"}`,
      businessName: item ? businessNameById.get(item.businessId.toString()) ?? null : null,
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
  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ---- Response volume sparkline (7d, daily counts per branch) ----
  const sparklines = summaries30d.map((s) => ({ businessId: s.businessId, name: s.name, days: [] as number[] }));
  const sparkByBusiness = new Map(sparklines.map((s) => [s.businessId, s]));
  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date(now.getTime() - d * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const dayCounts = await Promise.all(
      businessIds.map((id) => FeedbackResponse.countDocuments({ businessId: id, product, submittedAt: { $gte: dayStart, $lt: dayEnd } }))
    );
    businesses.forEach((b, i) => {
      sparkByBusiness.get(b._id.toString())?.days.push(dayCounts[i]);
    });
  }

  const movers = [...branchTiles]
    .filter((b) => b.starDelta !== null)
    .sort((a, b) => (b.starDelta as number) - (a.starDelta as number));

  return NextResponse.json({
    status: "ok",
    orgName: org.name,
    product,
    ragThresholds: thresholds,
    branchTiles,
    categoryMatrix,
    feed: feed.slice(0, 20),
    cxPulse: orgScore ? { compositeScore: orgScore.compositeScore, level: orgScore.level } : null,
    billing: subscription
      ? {
          isComp: subscription.isComp,
          status: subscription.status,
          mrrValue: subscription.mrrValue,
          nextPaymentDate: subscription.nextPaymentDate,
        }
      : null,
    movers,
    sparklines: [...sparkByBusiness.values()],
  });
}
