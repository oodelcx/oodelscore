import { NextResponse } from "next/server";
import {
  canViewCase,
  logAuditEvent,
  connectToDatabase,
  ActionBoardItem,
  ActionItemComment,
  Response,
  Playbook,
  User,
  Business,
  RecurringIssueFlag,
  Category,
  sendTemplatedEmail,
  ACTION_STATUSES,
  buildCaseTimeline,
  ensureDraftDecisionForResolvedCase,
  CaseEventLogEntry,
  resolveQuestionTextByQuestionId,
  getEscalationConfig,
  resolveEscalationAssignee,
} from "@oodelscore/shared";
import { requireParentOrgOwner, caseViewerForGroup } from "@/lib/ownerAuth";
import { attachPlaybookRunsToItems } from "@/lib/caseStats";

type RouteParams = { params: Promise<{ id: string }> };

/** The unified case trail, org-scoped — see the business twin for the full shape. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const viewer = caseViewerForGroup(session);
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
  if (!item || !canViewCase(item, viewer)) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  // Opening a Sensitive case is recorded: who looked, and when.
  if (item.sensitive) {
    await logAuditEvent({
      actor: session.user,
      action: "sensitive_case.viewed",
      targetType: "action_board_item",
      targetId: item._id.toString(),
      targetLabel: "Sensitive case",
    });
  }
  if (session.tier === "limited" && item.ownerId?.toString() !== session.user._id.toString()) {
    return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
  }

  const [sourceResponses, comments, playbooks, business, events] = await Promise.all([
    Response.find({ _id: { $in: item.sourceResponseIds } }),
    ActionItemComment.find({ actionItemId: item._id }).sort({ createdAt: 1 }),
    Playbook.find({ parentOrgId: session.org._id }),
    Business.findById(item.businessId).select("name"),
    CaseEventLogEntry.find({ actionBoardItemId: item._id }).sort({ createdAt: 1 }),
  ]);

  const escalationUserIds = [
    ...new Set(
      item.escalationHistory
        .flatMap((h) => [h.userId, h.byUserId, h.toUserId])
        .map((x) => x?.toString())
        .filter((x): x is string => !!x)
    ),
  ];
  const escalationUsers = await User.find({ _id: { $in: escalationUserIds } }).select("email");
  const emailByUserId = new Map(escalationUsers.map((u) => [u._id.toString(), u.email]));
  const timeline = buildCaseTimeline(events, item.escalationHistory, emailByUserId);
  const questionTextById = await resolveQuestionTextByQuestionId(sourceResponses);
  const escalationConfig = await getEscalationConfig({
    parentOrgId: session.org._id,
    escalationLevels: [],
    escalationSlaHours: null,
  });
  const levels = escalationConfig.levels.slice().sort((a, b) => a.level - b.level);
  const topLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : null;
  // See the business route's identical comment — this resolves WHO a click
  // would hand the case to, so the UI never escalates blind.
  const currentIndex = levels.findIndex((l) => l.level === item.currentEscalationLevel);
  const nextLevelConfig = currentIndex === -1 ? levels[0] : levels[currentIndex + 1];
  const prevLevelConfig = currentIndex <= 0 ? null : levels[currentIndex - 1];
  const [nextAssigneeId, prevAssigneeId] = await Promise.all([
    nextLevelConfig ? resolveEscalationAssignee(item.businessId.toString(), nextLevelConfig.level) : null,
    prevLevelConfig ? resolveEscalationAssignee(item.businessId.toString(), prevLevelConfig.level) : null,
  ]);
  const [nextAssignee, prevAssignee] = await Promise.all([
    nextAssigneeId ? User.findById(nextAssigneeId).select("email") : null,
    prevAssigneeId ? User.findById(prevAssigneeId).select("email") : null,
  ]);

  const [itemWithRun] = await attachPlaybookRunsToItems([item], playbooks);

  const flag = await RecurringIssueFlag.findOne({ caseIds: item._id, status: "active" });
  let recurringFlag: {
    _id: string;
    ownerScope: string;
    categoryName: string | null;
    caseCount: number;
    branchCount: number;
  } | null = null;
  if (flag) {
    const category = flag.categoryId ? await Category.findById(flag.categoryId).select("name") : null;
    recurringFlag = {
      _id: flag._id.toString(),
      ownerScope: flag.ownerScope,
      categoryName: category?.name ?? null,
      caseCount: flag.caseIds.length,
      branchCount: flag.businessIds.length,
    };
  }

  return NextResponse.json({
    status: "ok",
    item: {
      ...itemWithRun,
      escalationHistory: item.escalationHistory.map((h) => ({
        level: h.level,
        action: h.action,
        note: h.note,
        at: h.at,
        userEmail: h.userId ? (emailByUserId.get(h.userId.toString()) ?? null) : null,
        byEmail: h.byUserId ? (emailByUserId.get(h.byUserId.toString()) ?? null) : null,
        toEmail: h.toUserId ? (emailByUserId.get(h.toUserId.toString()) ?? null) : null,
        toLevel: h.toLevel ?? null,
        toLabel: h.toLabel ?? "",
      })),
    },
    sourceResponses,
    questionTextById,
    comments,
    timeline,
    escalation: {
      levelsConfigured: escalationConfig.levels.length,
      topLevel,
      canEscalate: topLevel !== null && item.currentEscalationLevel < topLevel,
      canDeEscalate: item.currentEscalationLevel > 1,
      nextLevel: nextLevelConfig
        ? { level: nextLevelConfig.level, label: nextLevelConfig.label, assigneeEmail: nextAssignee?.email ?? null }
        : null,
      prevLevel: prevLevelConfig
        ? { level: prevLevelConfig.level, label: prevLevelConfig.label, assigneeEmail: prevAssignee?.email ?? null }
        : null,
    },
    businessName: business?.name ?? null,
    recurringFlag,
  });
}

/**
 * Product decision: Group is read-only on branch Action Board items —
 * assignment/status/priority/due date is the branch's job, not the org's.
 * A "limited" tier team member is a different concern (someone actually
 * doing the work, keyed to items assigned to them) and keeps its existing
 * status/resolutionNote path. Everyone else at the Group level (the org
 * owner, or a "full" tier team member) can only toggle `escalated` and post
 * comments via the separate /comments route.
 *
 * Escalating notifies a real person: the item's assigned owner if it has
 * one, otherwise the branch's own owner login — there's no "higher up"
 * above the Group in this hierarchy, so escalating means "the org is
 * flagging this for the branch's attention now," not routing it upward.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireParentOrgOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const viewer = caseViewerForGroup(session);
  const item = await ActionBoardItem.findOne({ _id: id, parentOrgId: session.org._id });
  if (!item || !canViewCase(item, viewer)) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  // The confidential contact works a Sensitive case from here (it is not in any branch's list), so they may
  // set its status and resolution note like an assigned limited-tier member. Other group cases stay read-only.
  const isSensitiveContact = item.sensitive && item.ownerId?.toString() === session.user._id.toString();
  if (session.tier === "limited" || isSensitiveContact) {
    if (item.ownerId?.toString() !== session.user._id.toString()) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }
    const previousStatus = item.status;
    if (ACTION_STATUSES.includes(body?.status)) item.status = body.status;
    if (body?.status === "resolved") item.resolvedAt = new Date();
    if (typeof body?.resolutionNote === "string") item.resolutionNote = body.resolutionNote;
    await item.save();
    if (item.status === "resolved" && previousStatus !== "resolved") {
      await ensureDraftDecisionForResolvedCase({ caseId: item._id, actorUserId: session.user._id, actorLabel: session.user.email });
    }
    return NextResponse.json({ status: "ok", item });
  }

  if (typeof body?.escalated === "boolean") {
    if (item.sensitive) return NextResponse.json({ status: "error", message: "A confidential case is handled only by its confidential contact and cannot be escalated." }, { status: 409 });
    item.escalated = body.escalated;
    item.escalatedAt = body.escalated ? new Date() : null;
    if (body.escalated && typeof body?.escalationNote === "string") item.escalationNote = body.escalationNote.trim();
    if (!body.escalated) item.escalationNote = "";
  }

  await item.save();

  if (body?.escalated === true) {
    const recipient = item.ownerId
      ? await User.findById(item.ownerId)
      : await User.findOne({ accountType: "business", parentId: item.businessId });
    const business = await Business.findById(item.businessId);
    if (recipient) {
      await sendTemplatedEmail("item_escalated", recipient.email, {
        name: recipient.email,
        escalator_name: session.user.email,
        org_name: session.org.name,
        business_name: business?.name ?? "your branch",
        action_title: item.title,
        escalation_note: item.escalationNote || "(no note added)",
        action_link: `${process.env.APP_URL ?? ""}/business/action-board`,
      }).catch((err) => console.error("[group-action-board] failed to send item_escalated", err));
    }
  }

  return NextResponse.json({ status: "ok", item });
}
