import type { Types } from "mongoose";
import { CaseEventLogEntry, type CaseEventKind } from "../models/CaseEventLogEntry";
import type { IEscalationHistoryEntry } from "../models/ActionBoardItem";

/**
 * Fire-and-forget by design (mirrors logAuditEvent) — a case's own state
 * change must never fail or block on this write failing.
 */
export async function logCaseEvent(params: {
  actionBoardItemId: Types.ObjectId;
  businessId: Types.ObjectId;
  kind: CaseEventKind;
  fromValue: string | null;
  toValue: string | null;
  actorUserId: Types.ObjectId | null;
  actorLabel: string;
  note?: string;
}): Promise<void> {
  try {
    await CaseEventLogEntry.create({
      actionBoardItemId: params.actionBoardItemId,
      businessId: params.businessId,
      kind: params.kind,
      fromValue: params.fromValue,
      toValue: params.toValue,
      actorUserId: params.actorUserId,
      actorLabel: params.actorLabel,
      note: params.note ?? "",
    });
  } catch (err) {
    console.error("[case-event-log] failed to write entry", params.kind, err);
  }
}

export interface TimelineEntry {
  kind: CaseEventKind | "escalated" | "auto_escalated" | "de_escalated";
  label: string;
  actorLabel: string;
  note: string;
  at: string; // ISO
}

const KIND_LABEL: Record<CaseEventKind, (from: string | null, to: string | null) => string> = {
  status_changed: (from, to) => `Status changed${from ? ` from ${from.replace(/_/g, " ")}` : ""} to ${(to ?? "").replace(/_/g, " ")}`,
  priority_changed: (from, to) => `Priority changed${from ? ` from ${from}` : ""} to ${to ?? ""}`,
  owner_changed: (_from, to) => (to ? `Reassigned to ${to}` : "Unassigned"),
  customer_notified: () => "Customer notified — reply sent",
  comment_added: () => "Comment added",
};

/**
 * Merges this case's append-only CaseEventLogEntry rows with its embedded
 * escalationHistory (also append-only — see ActionBoardItem's own comment)
 * into one chronological timeline. Deliberately reads from both sources
 * rather than duplicating escalation data into this collection too.
 */
export function buildCaseTimeline(
  events: { kind: CaseEventKind; fromValue: string | null; toValue: string | null; actorLabel: string; note: string; createdAt: Date }[],
  escalationHistory: IEscalationHistoryEntry[],
  escalationUserEmailByUserId: Map<string, string>
): TimelineEntry[] {
  const fromEvents: TimelineEntry[] = events.map((e) => ({
    kind: e.kind,
    label: KIND_LABEL[e.kind](e.fromValue, e.toValue),
    actorLabel: e.actorLabel || "System",
    note: e.note,
    at: e.createdAt.toISOString(),
  }));

  const fromEscalation: TimelineEntry[] = escalationHistory.map((h) => ({
    kind: h.action,
    label:
      h.action === "de_escalated"
        ? `De-escalated from level ${h.level}`
        : `Escalated from level ${h.level}${h.action === "auto_escalated" ? " (auto, SLA)" : ""}`,
    actorLabel: h.userId ? (escalationUserEmailByUserId.get(h.userId.toString()) ?? "Unassigned") : "Unassigned",
    note: h.note,
    at: h.at.toISOString(),
  }));

  return [...fromEvents, ...fromEscalation].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
