import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export const OWNER_SCOPES = ["business", "parentOrg"] as const;
export type OwnerScope = (typeof OWNER_SCOPES)[number];

/**
 * Feeds AI-assisted Action Board triage (spec Section 16): when an Alert
 * Rule fires, the AI picks the category but a human decides who owns items
 * in that category — this is that mapping, one row per (scope, category).
 * Any item in a mapped category is assigned directly to defaultOwnerId,
 * no accept/reassign step involved.
 */
export interface ICategoryOwnerMapping {
  ownerScope: OwnerScope;
  ownerScopeId: Types.ObjectId; // -> businesses._id or parentOrganizations._id
  categoryId: Types.ObjectId;
  defaultOwnerId: Types.ObjectId; // -> users._id
  // How many cases in this category, within repeatWindowDays, before it's
  // flagged as a recurring pattern (see RecurringIssueFlag + patterns/
  // recurringIssues.ts). null = repeat detection off for this category at
  // this scope — an account has to opt in, it's never on by default.
  repeatThresholdCount: number | null;
  repeatWindowDays: number | null;
  // Optional category-specific escalation override, independent of the
  // region-based EscalationAssignment system: "if a case in this category
  // sits unresolved past escalateAfterDays, jump it straight to level
  // escalateToLevel" — for when a category's own severity warrants a
  // different (usually higher, sometimes faster) escalation path than
  // whatever region/level the case would otherwise follow. Both null =
  // this category doesn't opt into a category-specific override; the
  // case just follows the normal region-based escalation config.
  escalateAfterDays: number | null;
  escalateToLevel: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryOwnerMappingSchema = new Schema<ICategoryOwnerMapping>(
  {
    ownerScope: { type: String, enum: OWNER_SCOPES, required: true },
    ownerScopeId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    defaultOwnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    repeatThresholdCount: { type: Number, default: null },
    repeatWindowDays: { type: Number, default: null },
    escalateAfterDays: { type: Number, default: null },
    escalateToLevel: { type: Number, default: null },
  },
  { timestamps: true }
);

CategoryOwnerMappingSchema.index({ ownerScope: 1, ownerScopeId: 1, categoryId: 1 }, { unique: true });

export const CategoryOwnerMapping: Model<ICategoryOwnerMapping> =
  mongoose.models.CategoryOwnerMapping ?? model<ICategoryOwnerMapping>("CategoryOwnerMapping", CategoryOwnerMappingSchema);
