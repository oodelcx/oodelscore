import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import type { AccountType } from "./User";

// Free-text dotted keys ("role.permissions_changed", "staff.created") rather
// than an enum — new call sites shouldn't need a schema migration to log
// something. The Admin viewer filters by substring, not exact match.
export interface IAuditLogEntry {
  actorUserId: Types.ObjectId | null;
  actorEmail: string;
  actorAccountType: AccountType | null;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string; // human-readable, e.g. a role's name or a user's email — shown in the viewer without a join
  before: unknown;
  after: unknown;
  createdAt: Date;
}

const AuditLogEntrySchema = new Schema<IAuditLogEntry>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, required: true },
    actorAccountType: { type: String, default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: null },
    targetLabel: { type: String, default: "" },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogEntrySchema.index({ createdAt: -1 });
AuditLogEntrySchema.index({ actorEmail: 1, createdAt: -1 });
AuditLogEntrySchema.index({ action: 1, createdAt: -1 });

export const AuditLogEntry: Model<IAuditLogEntry> =
  mongoose.models.AuditLogEntry ?? model<IAuditLogEntry>("AuditLogEntry", AuditLogEntrySchema);
