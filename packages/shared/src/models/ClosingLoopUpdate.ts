import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { PRODUCTS, type Product } from "./products";

export const CLOSING_LOOP_STATUSES = ["draft", "sent"] as const;
export type ClosingLoopStatus = (typeof CLOSING_LOOP_STATUSES)[number];

/**
 * The EX half of "Closing the Loop" — a "you said, we did" broadcast to a
 * business's whole roster. Deliberately NOT a per-response reply like the
 * CX half (respond-to-customer): Colleague Experience never links a
 * submitted response back to who sent it (see RosterSurveyToken's own
 * comment), so there is no individual to reply to. The only anonymity-safe
 * mechanism is a broadcast to the roster distribution list — everyone hears
 * the same update, regardless of whether they personally responded.
 *
 * Exactly one of parentOrgId/businessId is set, same convention as
 * DecisionLogEntry: a Group-created update can target its own branches
 * (via affectedBusinessIds), a standalone business's is scoped to itself.
 */
export interface IClosingLoopUpdate {
  parentOrgId: Types.ObjectId | null;
  businessId: Types.ObjectId | null;
  product: Product; // always colleague_experience in practice; kept for symmetry with the rest of the Act layer
  title: string;
  whatWeHeard: string;
  whatWereDoing: string;
  // Optional ties to the actual work this update reports on — never
  // required, since not every "you said, we did" is backed by a formal
  // initiative or logged decision yet.
  linkedInitiativeId: Types.ObjectId | null;
  linkedDecisionId: Types.ObjectId | null;
  // Which businesses' rosters this update goes to. For a standalone
  // business, always just itself. For a Group-authored update, the branches
  // it chose to include — mirrors DecisionLogEntry.affectedBusinessIds.
  affectedBusinessIds: Types.ObjectId[];
  status: ClosingLoopStatus;
  sentAt: Date | null;
  recipientCount: number; // snapshot at send time — the roster can change after
  createdAt: Date;
  updatedAt: Date;
}

const ClosingLoopUpdateSchema = new Schema<IClosingLoopUpdate>(
  {
    parentOrgId: { type: Schema.Types.ObjectId, ref: "ParentOrganization", default: null },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
    product: { type: String, enum: PRODUCTS, default: "colleague_experience" },
    title: { type: String, required: true, trim: true },
    whatWeHeard: { type: String, default: "" },
    whatWereDoing: { type: String, default: "" },
    linkedInitiativeId: { type: Schema.Types.ObjectId, ref: "ImprovementInitiative", default: null },
    linkedDecisionId: { type: Schema.Types.ObjectId, ref: "DecisionLogEntry", default: null },
    affectedBusinessIds: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    status: { type: String, enum: CLOSING_LOOP_STATUSES, default: "draft" },
    sentAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClosingLoopUpdateSchema.index({ parentOrgId: 1, createdAt: -1 });
ClosingLoopUpdateSchema.index({ businessId: 1, createdAt: -1 });

export const ClosingLoopUpdate: Model<IClosingLoopUpdate> =
  mongoose.models.ClosingLoopUpdate ?? model<IClosingLoopUpdate>("ClosingLoopUpdate", ClosingLoopUpdateSchema);
