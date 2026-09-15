import { AuditLogEntry } from "../models/AuditLogEntry";
import type { AccountType } from "../models/User";

export interface AuditActor {
  _id: unknown;
  email: string;
  accountType: AccountType;
}

/**
 * Fire-and-forget by design (callers don't await failure into the response) —
 * an audit write failing should never block or fail the underlying action
 * it's recording. Used for permission changes, staff/role edits, billing
 * overrides, and other actions the spec calls out as needing a trail; not
 * every mutation in the app.
 */
export async function logAuditEvent(params: {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await AuditLogEntry.create({
      actorUserId: params.actor._id,
      actorEmail: params.actor.email,
      actorAccountType: params.actor.accountType,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      targetLabel: params.targetLabel ?? "",
      before: params.before ?? null,
      after: params.after ?? null,
    });
  } catch (err) {
    console.error("[audit-log] failed to write entry", params.action, err);
  }
}
