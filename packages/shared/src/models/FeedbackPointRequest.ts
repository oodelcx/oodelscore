import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const FEEDBACK_POINT_REQUEST_STATUSES = ["pending", "resolved"] as const;
export type FeedbackPointRequestStatus = (typeof FEEDBACK_POINT_REQUEST_STATUSES)[number];

/**
 * A business asking Admin for a new feedback point or a change to an
 * existing one (businesses can't create these themselves — Admin-only,
 * per the permission matrix). Persisted so it can surface as a real
 * in-app "needs attention" item for Admin/the assigned account manager,
 * not just an email that's easy to miss.
 */
export interface IFeedbackPointRequest {
  businessId: Types.ObjectId;
  requestedByUserId: Types.ObjectId;
  note: string;
  status: FeedbackPointRequestStatus;
  resolvedAt: Date | null;
  resolvedByUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackPointRequestSchema = new Schema<IFeedbackPointRequest>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
    status: { type: String, enum: FEEDBACK_POINT_REQUEST_STATUSES, default: "pending" },
    resolvedAt: { type: Date, default: null },
    resolvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

FeedbackPointRequestSchema.index({ status: 1, businessId: 1 });

export const FeedbackPointRequest: Model<IFeedbackPointRequest> =
  mongoose.models.FeedbackPointRequest ?? model<IFeedbackPointRequest>("FeedbackPointRequest", FeedbackPointRequestSchema);
