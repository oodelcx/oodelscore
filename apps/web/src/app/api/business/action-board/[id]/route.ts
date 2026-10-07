import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  canViewCase,
  logAuditEvent,
  connectToDatabase,
  ActionBoardItem,
  ActionItemComment,
  Response,
  Playbook,
  User,
  ParentOrganization,
  RecurringIssueFlag,
  Category,
  sendTemplatedEmail,
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  CASE_TYPES,
  logCaseEvent,
  ensureDraftDecisionForResolvedCase,
  buildCaseTimeline,
  CaseEventLogEntry,
  resolveQuestionTextByQuestionId,
  getEscalationConfig,
  resolveEscalationAssignee,
} from "@oodelscore/shared";
import { requireBusinessOwner, caseViewerForBusiness } from "@/lib/ownerAuth";
import { attachPlaybookRunsToItems } from "@/lib/caseStats";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The unified case trail: one case's full audit history — original
 * feedback, comments, escalation history (with each level's holder
 * resolved to an email), linked playbook run, resolution. The same shape
 * every persona's drill-down reads from (see /group/action-board/[id] for
 * the org-scoped twin).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();
  const { id } = await params;
  const viewer = caseViewerForBusiness(session);
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
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

  const [sourceResponses, comments, playbooks, events] = await Promise.all([
    Response.find({ _id: { $in: item.sourceResponseIds } }),
    ActionItemComment.find({ actionItemId: item._id }).sort({ createdAt: 1 }),
    Playbook.find(session.business.parentOrgId ? { parentOrgId: session.business.parentOrgId } : { businessId: session.business._id }),
    CaseEventLogEntry.find({ actionBoardItemId: item._id }).sort({ createdAt: 1 }),
  ]);

  const escalationUserIds = [
    ...new Set(item.escalationHistory.map((h) => h.userId?.toString()).filter((x): x is string => !!x)),
  ];
  const escalationUsers = await User.find({ _id: { $in: escalationUserIds } }).select("email");
  const emailByUserId = new Map(escalationUsers.map((u) => [u._id.toString(), u.email]));
  const timeline = buildCaseTimeline(events, item.escalationHistory, emailByUserId);
  const questionTextById = await resolveQuestionTextByQuestionId(sourceResponses);
  const escalationConfig = await getEscalationConfig(session.business);
  const levels = escalationConfig.levels.slice().sort((a, b) => a.level - b.level);
  const topLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : null;
  // The escalate/de-escalate buttons used to reassign a case blind — the
  // person clicking never saw who they were handing it to until after the
  // fact. Resolving the next/previous level's holder here lets the UI show
  // "this goes to <name>" before the click, not just a level number.
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
    recurringFlag,
  });
}

/** Fires spec Section 11's action_assigned trigger whenever ownerId is set or changed.
 * A "limited" tier Team Member may only update status/resolutionNote on an item already
 * assigned to them — everything else on this route requires full access (spec Section 16). */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ allowLimitedTeamMember: true, requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const viewer = caseViewerForBusiness(session);
  const item = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!item || !canViewCase(item, viewer)) return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  if (session.tier === "limited") {
    if (item.ownerId?.toString() !== session.user._id.toString()) {
      return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    }
    const previousStatus = item.status;
    if (ACTION_STATUSES.includes(body?.status)) item.status = body.status;
    if (body?.status === "resolved") item.resolvedAt = new Date();
    if (typeof body?.resolutionNote === "string") item.resolutionNote = body.resolutionNote;
    if (typeof body?.suggestedAction === "string") item.suggestedAction = body.suggestedAction;
    await item.save();
    if (item.status === "resolved" && previousStatus !== "resolved") {
      await ensureDraftDecisionForResolvedCase({ caseId: item._id, actorUserId: session.user._id, actorLabel: session.user.email });
    }
    if (item.status !== previousStatus) {
      await logCaseEvent({
        actionBoardItemId: item._id,
        businessId: item.businessId,
        kind: "status_changed",
        fromValue: previousStatus,
        toValue: item.status,
        actorUserId: session.user._id,
        actorLabel: session.user.email,
      });
    }
    return NextResponse.json({ status: "ok", item });
  }

  const previousOwnerId = item.ownerId?.toString() ?? null;
  const previousStatus = item.status;
  const previousPriority = item.priority;

  if (typeof body?.title === "string") item.title = body.title;
  if (typeof body?.description === "string") item.description = body.description;
  if (typeof body?.categoryId === "string") item.categoryId = new Types.ObjectId(body.categoryId);
  if (CASE_TYPES.includes(body?.caseType)) item.caseType = body.caseType;
  if (ACTION_PRIORITIES.includes(body?.priority)) item.priority = body.priority;
  if (ACTION_STATUSES.includes(body?.status)) item.status = body.status;
  if (body?.status === "resolved") {
    item.resolvedAt = new Date();
    if (typeof body?.resolutionNote === "string") item.resolutionNote = body.resolutionNote;
  }
  if (typeof body?.dueDate === "string") item.dueDate = new Date(body.dueDate);
  // Accept/dismiss on the auto-suggested action: "accept" folds it into the
  // item's description and clears the suggestion slot, "dismiss" just
  // clears it — both are just an ordinary field edit, no separate workflow.
  if (typeof body?.suggestedAction === "string") item.suggestedAction = body.suggestedAction;
  if ("ownerId" in (body ?? {})) {
    item.ownerId = typeof body.ownerId === "string" ? new Types.ObjectId(body.ownerId) : null;
  }
  // The other direction from Group's `escalated` flag: a branch flagging
  // its own case for its parent org's attention. Only meaningful when this
  // business actually has a parent org — a standalone business has nobody
  // to escalate to, so the field is silently ignored for it rather than
  // erroring (keeps this one PATCH handler shared instead of forking it).
  if (typeof body?.escalatedToOrg === "boolean" && session.business.parentOrgId) {
    item.escalatedToOrg = body.escalatedToOrg;
    item.escalatedToOrgAt = body.escalatedToOrg ? new Date() : null;
    if (body.escalatedToOrg && typeof body?.escalatedToOrgNote === "string") {
      item.escalatedToOrgNote = body.escalatedToOrgNote.trim();
    }
    if (!body.escalatedToOrg) item.escalatedToOrgNote = "";
  }

  await item.save();

  if (item.status === "resolved" && previousStatus !== "resolved") {
    await ensureDraftDecisionForResolvedCase({ caseId: item._id, actorUserId: session.user._id, actorLabel: session.user.email });
  }

  if (item.status !== previousStatus) {
    await logCaseEvent({
      actionBoardItemId: item._id,
      businessId: item.businessId,
      kind: "status_changed",
      fromValue: previousStatus,
      toValue: item.status,
      actorUserId: session.user._id,
      actorLabel: session.user.email,
    });
  }
  if (item.priority !== previousPriority) {
    await logCaseEvent({
      actionBoardItemId: item._id,
      businessId: item.businessId,
      kind: "priority_changed",
      fromValue: previousPriority,
      toValue: item.priority,
      actorUserId: session.user._id,
      actorLabel: session.user.email,
    });
  }

  const newOwnerId = item.ownerId?.toString() ?? null;
  if (newOwnerId !== previousOwnerId) {
    const newOwner = newOwnerId ? await User.findById(newOwnerId) : null;
    await logCaseEvent({
      actionBoardItemId: item._id,
      businessId: item.businessId,
      kind: "owner_changed",
      fromValue: previousOwnerId,
      toValue: newOwner?.email ?? null,
      actorUserId: session.user._id,
      actorLabel: session.user.email,
    });
    if (newOwner) {
      await sendTemplatedEmail("action_assigned", newOwner.email, {
        name: newOwner.email,
        action_title: item.title,
        due_date: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : "no due date",
        action_link: `${process.env.APP_URL ?? ""}/business`,
      }).catch((err) => console.error("[action-board] failed to send action_assigned", err));
    }
  }

  if (body?.escalatedToOrg === true && session.business.parentOrgId) {
    const org = await ParentOrganization.findById(session.business.parentOrgId);
    const recipient = await User.findOne({ accountType: "parent_org", parentId: session.business.parentOrgId });
    if (org && recipient) {
      await sendTemplatedEmail("case_escalated_to_org", recipient.email, {
        name: recipient.email,
        escalator_name: session.user.email,
        business_name: session.business.name,
        org_name: org.name,
        action_title: item.title,
        escalation_note: item.escalatedToOrgNote || "(no note added)",
        action_link: `${process.env.APP_URL ?? ""}/group/cases`,
      }).catch((err) => console.error("[action-board] failed to send case_escalated_to_org", err));
    }
  }

  return NextResponse.json({ status: "ok", item });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireBusinessOwner({ requirePage: "caseManagement" });
  if (!session) return NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });

  await connectToDatabase();

  const { id } = await params;
  const toRemove = await ActionBoardItem.findOne({ _id: id, businessId: session.business._id });
  if (!toRemove || !canViewCase(toRemove, caseViewerForBusiness(session))) {
    return NextResponse.json({ status: "error", message: "Not found" }, { status: 404 });
  }
  await ActionBoardItem.deleteOne({ _id: toRemove._id });

  return NextResponse.json({ status: "ok" });
}
