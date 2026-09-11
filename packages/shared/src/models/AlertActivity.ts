import mongoose, { Schema, model, type Model, type Types } from "mongoose";

/**
 * Powers "fired X times this week" displays and Overview "flagged" counts —
 * those must always be computed from this collection, never hardcoded.
 */
export interface IAlertActivity {
  alertRuleId: Types.ObjectId;
  businessId: Types.ObjectId;
  triggeredAt: Date;
  snapshotValue: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlertActivitySchema = new Schema<IAlertActivity>(
  {
    alertRuleId: { type: Schema.Types.ObjectId, ref: "AlertRule", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    triggeredAt: { type: Date, required: true, default: Date.now },
    snapshotValue: { type: Number, required: true },
  },
  { timestamps: true }
);

AlertActivitySchema.index({ businessId: 1, triggeredAt: -1 });

export const AlertActivity: Model<IAlertActivity> =
  mongoose.models.AlertActivity ?? model<IAlertActivity>("AlertActivity", AlertActivitySchema);
