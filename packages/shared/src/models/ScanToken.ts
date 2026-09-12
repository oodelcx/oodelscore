import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export interface IScanToken {
  token: string;
  feedbackPointId: Types.ObjectId;
  usedAt: Date | null;
  createdAt: Date;
}

// One issued per GET /api/feedback/[qrToken] load (a "scan"), consumed
// exactly once on submit — this is the lock that stops the same page load
// from submitting twice (double-tap, back-button resubmit, retried
// request) without blocking a genuinely new scan/reload from submitting
// its own, separate response.
const ScanTokenSchema = new Schema<IScanToken>({
  token: { type: String, required: true, unique: true },
  feedbackPointId: { type: Schema.Types.ObjectId, ref: "FeedbackPoint", required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // TTL: 10 minutes
});

export const ScanToken: Model<IScanToken> = mongoose.models.ScanToken ?? model<IScanToken>("ScanToken", ScanTokenSchema);
