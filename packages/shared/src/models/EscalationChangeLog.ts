import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * Who changed whom in a group's (or standalone business's) escalation
 * people, and when. Shown to the group and to OodelCX Admin, so a change
 * made in either place is visible in both.
 */
export interface IEscalationChangeLog {
  ownerType: "parentOrg" | "business";
  ownerId: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  actorEmail: string;
  actorKind: "group" | "admin" | "system";
  action: string; // set_branches | set_person | set_sla | add_person | remove_person | import | convert | request_seats
  summary: string;
  createdAt: Date;
}

const EscalationChangeLogSchema = new Schema<IEscalationChangeLog>(
  {
    ownerType: { type: String, enum: ["parentOrg", "business"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: "" },
    actorKind: { type: String, enum: ["group", "admin", "system"], default: "system" },
    action: { type: String, required: true },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EscalationChangeLogSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });

export const EscalationChangeLog: Model<IEscalationChangeLog> =
  mongoose.models.EscalationChangeLog ?? model<IEscalationChangeLog>("EscalationChangeLog", EscalationChangeLogSchema);
